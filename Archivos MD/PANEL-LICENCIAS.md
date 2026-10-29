# Panel web de licencias (`/licencias`)

Una pantalla para administrar las licencias de Control Driver desde el
celular o la compu: quién está al día, cuánto has cobrado, renovar con un
toque y mandar el mensaje por WhatsApp. El único administrador eres tú.

## Configuración (Vercel → Project → Settings → Environment Variables)

| Variable | Qué es | Notas |
|---|---|---|
| `LICENCIAS_PASSWORD` | La contraseña del panel | Larga (16+ caracteres) y única. Cambiarla cierra todas las sesiones abiertas. |
| `LICENCIA_CLAVE_PRIVADA` | El contenido de `~/.rutas-a/licencia-privada.jwk` (el JSON en una línea) | Márcala como **Sensitive** en Vercel. Solo se lee en el servidor, en el instante de firmar. |
| `TURSO_DATABASE_URL` | `libsql://…turso.io` | Se crea con `turso db create` / el panel de Turso. |
| `TURSO_AUTH_TOKEN` | Token de la base | `turso db tokens create <base>`. |

Las mismas cuatro en `.env.local` si quieres probar en tu Mac (`npm run licencia`
lee `.env.local`). Tras cambiarlas en Vercel hay que **redesplegar**.

Las tablas se crean/actualizan solas la primera vez (migración idempotente en
`src/lib/licencia/turso.ts`): `licencias`, `pagos` (con monto, método y
anulación), `auditoria` e `intentos_login`. No hay que correr nada a mano.

## Cómo se usa

- **Tablero**: usuarios activos, vencen en 7 días, vencidos, ingresos del mes,
  acumulados y ticket medio, más las gráficas de ingresos y de usuarios
  activos de los últimos 12 meses.
- **Lista**: buscador y filtros de color (Todos / Al día / Por vencer / En
  gracia / Vencidos). Toca una fila para abrir la **ficha**.
- **Emitir licencia nueva**: código del teléfono (UUID que copian en *Ajustes →
  Tu licencia*), nombre, meses, monto y método. Sale el mensaje listo para
  WhatsApp con botón de copiar.
- **Ficha**: historial de pagos, **Renovar** (el mes nuevo se suma a lo que le
  quedaba), **Preparar mensaje para WhatsApp** (vuelve a firmar la fecha actual
  sin cobrar), copiar el código, contacto y notas, y **Anular último pago**
  (dos pasos; devuelve la vigencia al pago anterior).
- **Exportar CSV** de usuarios y de pagos (abre bien en Excel).
- Desde la terminal sigue funcionando y escribe en la misma base:
  `npm run licencia -- emitir <código> "Nombre" 1 --monto 15 --metodo yape`
  (también `--telefono` y `--notas`).

Anular un pago corrige el registro y las cifras, pero **no revoca** el
mensaje ya enviado: ese certificado sigue funcionando en el teléfono hasta su
fecha. Una licencia no se puede "des-firmar".

## Seguridad: qué hay y por qué

- **Sesión comprobada en cada server action y en el route handler de CSV**, no
  solo en la página (`exigirSesion` en `src/lib/licencia/acceso.ts`).
- Cookie `httpOnly`, `secure` (en producción), `sameSite=strict`, ruta
  `/licencias`. Guarda un token firmado con HMAC que **caduca a las 12 h**; no
  contiene la contraseña ni su hash.
- Contraseña comparada en **tiempo constante**.
- **Límite de intentos**: 5 fallidos por IP cada 15 min (y 40 en total), guardado
  en Turso para que valga entre instancias.
- **Auditoría** (tabla `auditoria`: fecha, acción, código, IP resumida a `a.b.c.x`):
  login, intentos fallidos, emitir, renovar, reenviar, anular, contacto y
  exportaciones. No se guarda nunca la clave ni el certificado.
- Entradas validadas con zod: código = UUID, meses 1–24, monto 0–5000 con máx. 2
  decimales, método/teléfono/notas con largo y caracteres acotados.
- **Tope de firmas**: máximo 40 por hora. Si alguien entrara al panel, no
  podría fabricar licencias en masa de golpe.
- La página lleva `no-store` y `noindex`; los CSV neutralizan fórmulas de Excel.
- Los errores de firma devuelven un mensaje genérico (jamás el texto de la
  excepción, que podría arrastrar partes de la clave).

## Riesgos de tener la clave privada en la nube

La clave que firma ahora vive en tres sitios: tu Mac, tu copia de seguridad y
Vercel. Cada copia es una puerta.

**Qué pasa si se filtra** (alguien obtiene `LICENCIA_CLAVE_PRIVADA`): puede
fabricarse licencias de por vida para cualquier teléfono, sin pasar por el
panel, y no hay forma de revocarlas una a una. La única salida es **rotar el
par de claves**.

**Cómo reducir la probabilidad**
1. Variable *Sensitive* en Vercel; no la pegues en chats, capturas ni commits.
2. Contraseña del panel larga y única; no la reutilices.
3. Da acceso al proyecto de Vercel y al repo solo a ti, con 2FA.
4. Revisa la tabla `auditoria` (o la ficha de cada usuario) de vez en cuando:
   emisiones que no reconoces = alarma.
5. Rota el token de Turso si sospechas de él: da acceso a los datos, no a la clave.

**Cómo rotar la clave** (si se filtra, o por higiene):
1. Respalda `~/.rutas-a`, mueve `licencia-privada.jwk` a otro nombre.
2. `npm run licencia -- claves` crea el par nuevo y reescribe
   `src/lib/licencia/clave-publica.ts`.
3. Pon la privada nueva en `LICENCIA_CLAVE_PRIVADA` (Vercel y `.env.local`) y
   redespliega.
4. **Publica una versión nueva de la app (APK)** con la clave pública nueva.
   Hasta que cada compañero la instale, sus licencias firmadas con la clave
   vieja dejan de validar; hay que **re-emitir** a todos (el panel permite
   «Preparar mensaje para WhatsApp» por usuario, sin cobrar).

Si prefieres cero riesgo en la nube: quita `LICENCIA_CLAVE_PRIVADA` de Vercel.
El panel sigue mostrando todo (lectura, estadísticas, CSV) y solo se pierde
firmar desde la web; seguirías emitiendo con `npm run licencia` en tu Mac.
