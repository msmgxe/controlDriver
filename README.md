# Rutas-A

App Android para drivers de reparto. Al final del día el driver sube las capturas
de la app de reparto; Rutas-A las lee **en el propio teléfono**, revisa que
cuadren, guarda el día y calcula lo que le toca cobrar cada semana.

Una sola acción diaria: subir capturas → revisar → confirmar. Todo lo demás es
consulta.

- **Especificación completa:** [`ESPECIFICACION_APP_RUTAS.md`](ESPECIFICACION_APP_RUTAS.md)
- **Dónde nos apartamos de ella y por qué:** [`NOTAS-DE-IMPLEMENTACION.md`](NOTAS-DE-IMPLEMENTACION.md)
- **Qué cambió en cada versión:** [`VERSIONES.md`](VERSIONES.md)
- **Instalar el APK en un celular:** [`README-ANDROID.md`](README-ANDROID.md)
- **Licencias:** [`LICENCIAS.md`](LICENCIAS.md)
- **Diseño (prototipos):** [`prototipo/`](prototipo/) — `prototipo-final.html` es el de las pantallas actuales

## Cómo funciona

Todo ocurre dentro del teléfono, sin servidor:

| Qué | Cómo |
|---|---|
| **Pantallas** | Next.js (exportación estática) empaquetado con Capacitor dentro del APK |
| **Datos** | SQLite local; nada sale del teléfono salvo el respaldo que tú compartes |
| **Leer capturas** | Lector de texto del propio Android (ML Kit), sin internet |
| **Leer comandas** | El mismo lector, más el buscador de direcciones de Android |
| **Exportar** | Excel y PDF generados en el teléfono |
| **Bloqueo** | PIN y huella locales |
| **Licencia** | Certificado firmado que se activa sin conexión (ver `LICENCIAS.md`) |

Los datos de los clientes (nombre, teléfono, dirección) son de terceras personas:
se quedan en el teléfono, protegidos por el PIN, y **no viajan en el respaldo**
salvo que lo actives en Ajustes.

## Comandos

| Comando | Qué hace |
|---|---|
| `npm run apk` | Compila el APK: sube el número de versión y deja `Rutas-A-v<N>.apk` |
| `npm run apk:instalar` | Igual, y lo instala en el celular conectado por USB |
| `npm test` | Pruebas unitarias (vitest) contra SQLite de verdad, en memoria |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | ESLint |
| `npm run licencia` | Emite la licencia de un teléfono (ver `LICENCIAS.md`) |

Para compilar hace falta el JDK 21 y el SDK de Android (`scripts/apk.sh` los
busca solo y avisa si faltan).

### Ver la app en el navegador

Lo que **no** corre fuera del teléfono es el lector de capturas, el buscador de
direcciones y el GPS. Las pantallas y la base de datos sí, con SQLite compilado a
WebAssembly:

1. Sirve `sql-wasm.wasm` de **sql.js 1.11.0** en `public/assets/` (la 1.14 que trae
   `node_modules` no encaja con `jeep-sqlite`).
2. `npm run dev` y abre `http://localhost:3000`.
3. Borra `public/assets/` y `.next/` al terminar: los tipos que deja `next dev`
   rompen el siguiente `npm run apk`.

## Cómo está organizado

```
src/
  app/(app)/
    page.tsx                 Inicio: tira de semanas, tarjeta del día, cargar, detalle
    pagos/                   Semana elegida, cobro, tarifa y otras semanas
    revision/                Revisar lo leído antes de guardar (suma sobre lo ya guardado)
    historial/  buscar/      Consulta por día, por pedido, cliente, teléfono o dirección
    estadisticas/            Gráfico por día, tiempos, ingresos, distancia y récords
    ajustes/                 Apariencia, tienda y tarifa, comandas, PIN, licencia, respaldo
    compartir/               Destino de «compartir» de Android: galería → Rutas-A
  components/                Tira de semanas, hoja del pedido, comandas, acordeones, pestañas
  hooks/
  lib/
    db/sqlite/               Toda la base: esquema, jornadas, pagos, clientes, respaldo
    extraccion/              Lector de capturas: intérprete, fusión, arrastre y validaciones
    comanda/                 Lector de hojas de despacho y cómo se guardan
    geo/                     Distancia, tramo automático, enlaces de mapas y GPS
    pagos/                   Tarifas por tramo, permanencia y liquidación semanal
    licencia/                Certificado firmado, activación sin conexión
    exportar/                Excel (ExcelJS) y PDF (jsPDF)
    fechas.ts                Fechas de jornada, semanas lunes–domingo, hora de Lima
android/                     Proyecto Android: el lector de texto y el buscador de direcciones
scripts/                     apk.sh (compilar) y licencia.ts (emitir licencias)
prototipo/                   Prototipos de diseño en HTML, no forman parte de la app
```

## Sobre la capa web

El repositorio conserva además una **capa web** de cuando la app se pensó como
servicio en la nube: panel de administrador (`src/app/admin`), acceso por correo
(`src/app/acceso`), la API de extracción con modelo de visión (`src/app/api`),
`src/proxy.ts`, `src/lib/supabase/` y las migraciones de `supabase/`.

**El APK no la usa**: `scripts/apk.sh` la aparta durante la compilación. Sigue aquí
porque quitarla es una decisión aparte; ninguna pantalla de la app depende de ella.
