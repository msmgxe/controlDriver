# Panel web de licencias y usuarios

Reemplaza el flujo por terminal de `LICENCIAS.md` por una pantalla web, sin
Supabase: SQLite alojado (Turso) + Next.js en Vercel, tal como ya está montada
la web de este proyecto. La clave privada que firma las licencias **no se
mueve de la Mac** — eso es lo que hace que sea seguro además de fácil.

## Los pasos

- [ ] **1. Cuenta y base en Turso.** Gratis, sin tarjeta. Da 100 bases, 5 GB,
      500 millones de lecturas y 10 millones de escrituras al mes — de sobra
      para esto.
- [ ] **2. Dos tablas**, calcadas de `licencias.csv`:
  ```sql
  create table licencias (
    codigo text primary key,
    nombre text not null,
    vigente_hasta text not null,
    dias_de_gracia integer not null default 7
  );
  create table pagos (
    id integer primary key autoincrement,
    codigo text not null,
    fecha text not null,
    meses integer not null,
    hasta text not null
  );
  ```
- [ ] **3. Importar** el `licencias.csv` que ya existe en `~/.rutas-a`, una
      sola vez, para no perder el historial.
- [ ] **4. `scripts/licencia.ts` gana una línea:** después de firmar y guardar
      en el CSV (que se queda como respaldo), también escribe lo mismo en
      Turso. La firma no cambia en nada.
- [ ] **5. Pantalla nueva `/licencias`** (reemplaza el `/admin` viejo): una
      tabla de quién está al día, con nombre, código y vencimiento. Al
      principio, de solo lectura.
- [ ] **6. Login simple:** una contraseña guardada como variable de entorno,
      nada de cuentas de Supabase.
- [ ] **7. (Más adelante, opcional) Emitir desde la web.** Solo si algún día
      pesa el paso manual: mueve la clave privada a una variable de entorno
      del servidor, lo que sube el riesgo. No dar este paso sin pensarlo bien.
- [ ] **8. Limpieza final:** borrar `/admin`, `/acceso`, `/api`,
      `/configuracion`, `src/lib/supabase/` y las dependencias `@supabase/*`
      una vez que el panel nuevo funcione de verdad.

## Primer caso real

Antes de que el panel esté listo, ya se puede alargar una licencia por
terminal: `npm run licencia -- emitir <código> "<nombre>" <meses>`. El primer
código a usar es el del propio celular de prueba (Ajustes → Tu licencia →
Copiar en la app).

## Decisiones ya tomadas

- **Sin Supabase.** Ni para la base, ni para el login.
- **La clave privada se queda en la Mac.** El panel web, al principio, solo
  lee — no firma.
- **Vercel se queda como está** para alojar la web: ya está conectado con este
  repo, es gratis para este tamaño.

Contexto completo de por qué se decidió así: pedirle a Claude que lo recuerde,
o ver la conversación del 27–28/09/2026 donde se armó este plan.
