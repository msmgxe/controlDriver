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

let cliente: Client | null | undefined;

export function clienteTurso(): Client | null {
  if (cliente !== undefined) return cliente;

  const url = process.env.TURSO_DATABASE_URL;
  const authToken = process.env.TURSO_AUTH_TOKEN;
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
  meses integer not null,
  hasta text not null
);
`;

/** Crea las tablas si no existen. Se puede llamar tantas veces como se quiera. */
export async function migrarTurso(): Promise<void> {
  const db = clienteTurso();
  if (!db) return;
  for (const sentencia of ESQUEMA.split(";").map((s) => s.trim()).filter(Boolean)) {
    await db.execute(sentencia);
  }
}
