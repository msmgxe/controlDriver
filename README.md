# RutaLog

PWA de registro de rutas y pedidos para drivers de reparto. Al final del día el
driver sube las capturas de la app de reparto, la aplicación extrae los datos con
un modelo de visión, deduplica, valida, guarda y calcula la liquidación semanal.

Una sola acción diaria: subir fotos → revisar → confirmar. Todo lo demás es
consulta.

- **Especificación completa:** [`ESPECIFICACION_APP_RUTAS.md`](ESPECIFICACION_APP_RUTAS.md)
- **Dónde nos apartamos de ella y por qué:** [`NOTAS-DE-IMPLEMENTACION.md`](NOTAS-DE-IMPLEMENTACION.md)
- **Prototipo de Fase 0:** [`prototipo/rutalog-prototipo.html`](prototipo/rutalog-prototipo.html)

## Puesta en marcha

```bash
npm install
cp .env.example .env.local   # y rellenar los valores
npm run dev
```

**Sin las variables de entorno la app no arranca**: necesita un proyecto Supabase
y una clave de Anthropic. Los pasos están abajo.

| Comando | Qué hace |
|---|---|
| `npm run dev` | Servidor de desarrollo |
| `npm run build` | Build de producción |
| `npm test` | Pruebas unitarias (vitest) |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | ESLint |

### Supabase

1. Crear un proyecto en [supabase.com](https://supabase.com).
2. Aplicar `supabase/schema.sql` desde el SQL Editor. Crea tablas, índices,
   políticas RLS, la vista de resumen diario y la tarifa inicial.
3. Configurar Authentication como indica la cabecera de ese archivo. **El paso
   que se olvida siempre:** la plantilla de Magic Link tiene que usar
   `{{ .Token }}`, o Supabase manda un enlace en vez del código de 6 dígitos.
4. Copiar URL y claves a `.env.local`.
5. Crear tu propia cuenta de admin. Como el registro público está cerrado, la
   primera cuenta se hace a mano: crea el usuario desde Authentication → Users y
   luego inserta su perfil con `rol = 'admin'`:

   ```sql
   insert into perfiles (id, email, nombre, rol)
   values ('<uuid del usuario>', 'tu@correo.com', 'Tu nombre', 'admin');
   ```

   A partir de ahí, los demás drivers se dan de alta desde `/admin`.

## Cómo está organizado

```
src/
  app/
    (app)/                    App del driver — dirección visual Moderna
      page.tsx                Hoy: la única acción diaria
      revision/               Revisión de la carga, tramo por pedido
      historial/              Listado en tabla y vista por día
      pagos/                  Semana en curso, cierre y conciliación
      estadisticas/           Gráfico por día, tiempos, ingresos y récords
      ajustes/                Bloqueo con PIN y huella
    acceso/                   Correo + código de 6 dígitos
    admin/                    Panel web — dirección visual Profesional
    api/extraer/              Llamada al modelo de visión, una por imagen
    globals.css               Tokens de diseño de §9, las dos superficies
  components/                 Armazón, gráfico, tablas, piezas comunes
  lib/
    fechas.ts                 Fechas de jornada, semanas lunes–domingo, Lima
    bloqueo.ts                PIN y huella locales del dispositivo
    limites.ts                Límite de gasto de API por usuario
    extraccion/               Prompt, esquema Zod, fusión y validaciones
    pagos/                    Tarifas por tramo y liquidación semanal
    db/                       Consultas y escrituras, todas bajo RLS
    supabase/                 Clientes de navegador, servidor y service role
  proxy.ts                    Protección de rutas (en Next 16 sustituye a middleware.ts)
supabase/schema.sql           Esquema, RLS y tarifa inicial
```

## Decisiones que conviene conocer antes de tocar el código

- **El acceso es por correo y código**, no por contraseña. Eso cambia §12 entero:
  no hay contraseñas temporales ni restablecimiento. Detalle y consecuencias en
  las notas de implementación.
- **La sesión dura**: el código se pide una vez por dispositivo, no cada día. El
  día a día lo protege un PIN local de 4 dígitos, que no es un factor de sesión
  y el servidor no comprueba.
- **El dinero va en céntimos enteros** en todo el cálculo. Los decimales solo
  aparecen al formatear o al escribir en una columna `numeric`. Hay una prueba
  que lo fija.
- **Los montos se calculan en servidor**, a partir del tramo y de la regla
  vigente. Nunca se acepta el importe que manda el cliente.
- **El admin no ve los datos de trabajo de nadie.** Solo cuentas y uso. Está en
  §12 como argumento de venta y lo hacen cumplir las políticas RLS.
- **Las capturas no se guardan.** Se comprimen en el celular —lo que de paso
  borra el EXIF y la ubicación—, se procesan en memoria y se descartan.

## Estado por fases

| Fase | Entregable | Estado |
|---|---|---|
| 0 | Prototipo navegable | Hecho |
| 1 | Login, RLS, carga, extracción, fusión, validación, revisión, guardado | Hecho |
| 2 | Historial, listado por rango | Hecho. Falta la exportación a Excel y PDF |
| 3 | Gestión de usuarios (admin) | Hecho |
| 4 | Pagos semanales: cálculo, cierre, conciliación | Hecho |
| 5 | Estadísticas y récords | Hecho. Falta la exportación a PDF |
| 6 | PWA: manifest e iconos hechos. Faltan service worker, share target y offline | Parcial |
| 7 | Endurecimiento: rate limit hecho. Faltan cabeceras CSP, E2E y retención de imágenes | Parcial |

## Pruebas

48 pruebas unitarias sobre funciones puras:

- **Fusión y deduplicación** con el caso de §16: 5 capturas solapadas colapsan en
  7 rutas y 14 pedidos, incluidas tarjetas cortadas y capturas en desorden.
- **Validaciones de §6**, una por regla, separando bloqueos de avisos.
- **Liquidación de §13**, incluido el caso de §16 (S/ 141.50), que todos los
  pedidos se pagan sea cual sea su estado, y que no se acumula error de coma
  flotante.
- **Límites de semana**: domingo frente a lunes, carga tardía del domingo hecha
  el lunes, y semanas que cruzan de mes y de año.

```bash
npm test
```

Lo que **no** está cubierto por pruebas todavía: el flujo completo en navegador
(Playwright, §15) y la verificación de RLS con dos usuarios distintos. Las dos
necesitan un proyecto Supabase real.
