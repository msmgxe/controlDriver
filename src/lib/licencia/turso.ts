/**
 * La réplica en la nube de `licencias.csv`, para poder verla desde cualquier
 * lado sin abrir la Mac. **No es la fuente de verdad**: eso sigue siendo el
 * CSV y la clave privada en `~/.rutas-a`, que nunca salen de ahí. Turso solo
 * guarda una copia de lectura de lo que ya se firmó.
 *
 * Si no está configurado (no hay cuenta de Turso todavía), estas funciones
 * devuelven `null`/no hacen nada: el CLI y el resto de la app siguen
 * funcionando exactamente igual que antes de que existiera esto.
 *
 * Sin `import "server-only"` a propósito: este módulo lo usa tanto el panel
 * web como `scripts/licencia.ts` por la terminal (con `jiti`, sin bundler de
 * Next.js delante), y esa marca revienta fuera de un Server Component.
 */
import { createClient, type Client } from "@libsql/client";

import { entorno } from "./entorno";

let cliente: Client | null | undefined;

export function clienteTurso(): Client | null {
  if (cliente !== undefined) return cliente;

  const url = entorno("TURSO_DATABASE_URL");
  const authToken = entorno("TURSO_AUTH_TOKEN");
  cliente = url && authToken ? createClient({ url, authToken }) : null;
  return cliente;
}

/** ¿Hay cuenta de Turso conectada? Para decir "aún no" en vez de fallar. */
export function tursoConfigurado(): boolean {
  return clienteTurso() !== null;
}

const ESQUEMA = `
create table if not exists licencias (
  codigo text primary key,
  nombre text not null,
  vigente_hasta text not null,
  dias_de_gracia integer not null default 7
);
create table if not exists pagos (
  id integer primary key autoincrement,
  codigo text not null,
  fecha text not null,
  duracion text not null,
  hasta text not null
);
create table if not exists auditoria (
  id integer primary key autoincrement,
  fecha text not null,
  accion text not null,
  codigo text,
  ip text
);
create table if not exists intentos_login (
  clave text not null,
  en integer not null
)
`;

/**
 * Columnas que llegaron después de las tablas originales (montos y contacto).
 * Se añaden solo si faltan, para poder migrar una base que ya tiene datos sin
 * perder nada y sin fallar al repetirlo.
 */
const COLUMNAS_NUEVAS: { tabla: string; columna: string; definicion: string }[] = [
  { tabla: "licencias", columna: "telefono", definicion: "text" },
  { tabla: "licencias", columna: "notas", definicion: "text" },
  { tabla: "licencias", columna: "creada_en", definicion: "text" },
  { tabla: "pagos", columna: "monto_centimos", definicion: "integer" },
  { tabla: "pagos", columna: "metodo", definicion: "text" },
  { tabla: "pagos", columna: "anulado_en", definicion: "text" },
];

const INDICES = [
  "create index if not exists idx_pagos_codigo on pagos (codigo)",
  "create index if not exists idx_pagos_fecha on pagos (fecha)",
  "create index if not exists idx_auditoria_fecha on auditoria (fecha)",
  "create index if not exists idx_intentos_clave on intentos_login (clave, en)",
];

/** Migración sobre un cliente cualquiera (así se prueba con una base en memoria). */
export async function migrarEsquema(db: Client): Promise<void> {
  for (const sentencia of ESQUEMA.split(";").map((s) => s.trim()).filter(Boolean)) {
    await db.execute(sentencia);
  }
  for (const { tabla, columna, definicion } of COLUMNAS_NUEVAS) {
    const info = await db.execute(`pragma table_info(${tabla})`);
    if (!info.rows.some((f) => String(f.name) === columna)) {
      await db.execute(`alter table ${tabla} add column ${columna} ${definicion}`);
    }
  }
  for (const sentencia of INDICES) await db.execute(sentencia);
  // Fecha de alta de las licencias que ya existían: la de su primer pago.
  await db.execute(
    `update licencias set creada_en = (select min(fecha) from pagos where pagos.codigo = licencias.codigo)
     where creada_en is null`,
  );
}

let migrada = false;

/** Crea/actualiza las tablas. Se puede llamar tantas veces como se quiera; solo trabaja una vez por proceso. */
export async function migrarTurso(): Promise<void> {
  const db = clienteTurso();
  if (!db || migrada) return;
  await migrarEsquema(db);
  migrada = true;
}
