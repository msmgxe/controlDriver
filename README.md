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

Hay dos caminos. **Empieza por el local**: no depende de la nube de Supabase,
no gasta cuota y arranca en un comando.

### Local (recomendado para desarrollar)

Necesitas [Docker Desktop](https://www.docker.com/products/docker-desktop/)
instalado y abierto. Después:

```bash
npm install
npm run local     # levanta Supabase, aplica el esquema y escribe .env.local
npm run dev
```

Entra en `http://localhost:3000` con `msmgxe@gmail.com` — el seed ya crea esa
cuenta como administrador, asignada a «Wong - Aldabas» con horario de 9:00 a
22:00.

**El código de 6 dígitos no llega a tu correo.** El Supabase local captura los
envíos: ábrelos en `http://127.0.0.1:54324`. El panel local de la base, que es
el equivalente al dashboard, está en `http://127.0.0.1:54323`.

Para parar todo: `npm run local:stop`.

| Comando | Qué hace |
|---|---|
| `npm run local` | Supabase local + esquema + semilla + `.env.local` |
| `npm run dev` | Servidor de desarrollo |
| `npm run build` | Build de producción |
| `npm test` | Pruebas unitarias (vitest) |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | ESLint |

### Nube (para producción)

1. Crear un proyecto en [supabase.com](https://supabase.com).
2. Enlazar y subir el esquema, sin tocar el dashboard:

   ```bash
   supabase link --project-ref <ref-del-proyecto>
   supabase db push
   ```

3. En Authentication, configurar lo que indica la cabecera de
   `supabase/migrations/20260918000000_esquema_inicial.sql`. **El paso que se
   olvida siempre:** la plantilla de Magic Link tiene que usar `{{ .Token }}`, o
   Supabase manda un enlace en vez del código de 6 dígitos.
4. Poner las variables en Vercel y desplegar:

   ```bash
   vercel env add NEXT_PUBLIC_SUPABASE_URL production
   vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY production
   vercel env add SUPABASE_SERVICE_ROLE_KEY production
   vercel env add ANTHROPIC_API_KEY production
   vercel --prod
   ```

5. Crear tu cuenta de admin. Como el registro público está cerrado, la primera
   se hace a mano desde el SQL Editor:

   ```sql
   insert into perfiles (id, email, nombre, rol, tienda_id, hora_entrada, hora_salida)
   select '<uuid del usuario>', 'tu@correo.com', 'Tu nombre', 'admin',
          t.id, '09:00', '22:00'
   from tiendas t where t.nombre = 'Wong - Aldabas';
   ```

   El horario es el de permanencia en tienda: sin él no se calcula la garantía
   y los días flojos se pagarían de menos.

## Cómo está organizado

```
src/
  app/
    (app)/                    App del driver — dirección visual Moderna
      page.tsx                Hoy: la única acción diaria
      revision/               Revisión de la carga, tramo por pedido
      historial/              Listado en tabla, vista por día y búsqueda por código
      jornada/[fecha]/        Detalle de un día: corregir tramos, horario o borrar
      pagos/                  Semana en curso, cierre y conciliación
      estadisticas/           Gráfico por día, tiempos, ingresos y récords
      ajustes/                Bloqueo con PIN y huella
    acceso/                   Correo + código de 6 dígitos
    admin/                    Panel web — dirección visual Profesional
    api/extraer/              Llamada al modelo de visión, una por imagen
    globals.css               Tokens de diseño de §9, las dos superficies
    configuracion/            Qué variables faltan, en vez de un 500 sin explicación
    compartir/                Destino de compartir de Android: galería → RutaLog
    sin-conexion/             Lo que sirve el service worker cuando no hay red
  components/                 Armazón, gráfico, tablas, piezas comunes
  lib/
    fechas.ts                 Fechas de jornada, semanas lunes–domingo, Lima
    bloqueo.ts                PIN y huella locales del dispositivo
    limites.ts                Límite de gasto de API por usuario
    exportar/                 Excel (ExcelJS) y PDF (jsPDF), generados en el celular
    extraccion/               Prompt, esquema Zod, fusión y validaciones
    pagos/                    Tarifas por tramo, permanencia y liquidación semanal
    db/                       Consultas y escrituras, todas bajo RLS
    supabase/                 Clientes de navegador, servidor y service role
  proxy.ts                    Protección de rutas y CSP con nonce (en Next 16 sustituye a middleware.ts)
public/sw.js                  Service worker escrito a mano (Serwist no soporta Turbopack)
supabase/
  migrations/                 Esquema, RLS y tarifa inicial
  seed.sql                    Cuenta de admin para el entorno local
  verificar-rls.sql           Comprueba que un driver no ve nada de otro (§15)
```

## Decisiones que conviene conocer antes de tocar el código

- **El acceso es por correo y código**, no por contraseña. Eso cambia §12 entero:
  no hay contraseñas temporales ni restablecimiento. Detalle y consecuencias en
  las notas de implementación.
- **La sesión dura**: el código se pide una vez por dispositivo, no cada día. El
  día a día lo protege un PIN local de 4 dígitos, que no es un factor de sesión
  y el servidor no comprueba.
- **Cada tienda tiene sus reglas.** La de «Wong - Aldabas» paga por permanencia:
  S/ 10 por hora, y cada día se cobra **el mayor** de los dos —pedidos o
  permanencia—, nunca la suma. Las horas se cuentan completas hacia abajo y
  salen del horario del perfil, no de las capturas.
- **El dinero va en céntimos enteros** en todo el cálculo. Los decimales solo
  aparecen al formatear o al escribir en una columna `numeric`. Hay una prueba
  que lo fija.
- **Los montos se calculan en servidor**, a partir del tramo y de la regla
  vigente. Nunca se acepta el importe que manda el cliente.
- **El admin no ve los datos de trabajo de nadie.** Solo cuentas y uso. Está en
  §12 como argumento de venta y lo hacen cumplir las políticas RLS.
- **La CSP lleva nonce por petición** y se arma en `proxy.ts`, no en
  `next.config.ts`, porque cambia en cada request. Los estilos en línea sí se
  permiten: el gráfico calcula alturas con atributos `style`.
- **Hay dos puertas de entrada a la carga**: el botón de Hoy y compartir desde
  la galería de Android. Las dos usan el mismo flujo, en `src/lib/carga.ts`.
- **Las capturas no se guardan.** Se comprimen en el celular —lo que de paso
  borra el EXIF y la ubicación—, se procesan en memoria y se descartan.

## Estado por fases

| Fase | Entregable | Estado |
|---|---|---|
| 0 | Prototipo navegable | Hecho |
| 1 | Login, RLS, carga, extracción, fusión, validación, revisión, guardado | Hecho |
| 2 | Historial, detalle de jornada, edición, listado por rango, exportación | Hecho |
| 3 | Gestión de usuarios (admin) | Hecho |
| 4 | Pagos semanales: cálculo, cierre, conciliación | Hecho |
| 5 | Estadísticas, récords y exportación a PDF | Hecho |
| 6 | PWA: instalación, service worker, offline, share target y aviso de versión | Hecho |
| 7 | Endurecimiento: rate limit, cabeceras y verificación de RLS. Falta la retención opcional de imágenes | Casi |

## Verificar la RLS

Es la garantía más importante de la app y la que peor se detecta a ojo: una
política mal escrita no da error, simplemente devuelve datos que no debería.

Pega `supabase/verificar-rls.sql` entero en el SQL Editor —el de la nube, o el
local en `http://127.0.0.1:54323`. Monta dos
drivers de prueba, actúa como uno de ellos y comprueba diez cosas —que no ve las
jornadas del otro, que no encuentra sus pedidos buscando por código, que no
puede modificarlos ni suplantarlo—. Corta con error si alguna falla y hace
rollback siempre: no deja nada.

## Pruebas

61 pruebas unitarias sobre funciones puras:

- **Fusión y deduplicación** con el caso de §16: 5 capturas solapadas colapsan en
  7 rutas y 14 pedidos, incluidas tarjetas cortadas y capturas en desorden.
- **Validaciones de §6**, una por regla, separando bloqueos de avisos.
- **Liquidación de §13**, incluido el caso de §16 (S/ 141.50), que todos los
  pedidos se pagan sea cual sea su estado, y que no se acumula error de coma
  flotante.
- **Límites de semana**: domingo frente a lunes, carga tardía del domingo hecha
  el lunes, y semanas que cruzan de mes y de año.
- **Garantía por permanencia**: que es un piso y no un extra, que las horas se
  truncan, y que comparar por semana en vez de día a día costaría dinero.

```bash
npm test
```

Lo que **no** está cubierto por pruebas todavía: el flujo completo en navegador
(Playwright, §15) y la verificación de RLS con dos usuarios distintos. Las dos
necesitan un proyecto Supabase real.
