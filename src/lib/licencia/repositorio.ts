/**
 * Leer y escribir licencias en Turso: la base que comparten el CLI
 * (`scripts/licencia.ts`) y el panel web (`src/lib/licencia/servidor.ts`).
 * Los dos firman —cada uno con su copia de la clave privada, una en
 * `~/.rutas-a` y otra en la variable de entorno del servidor— y los dos
 * terminan escribiendo aquí, así que esta tabla es la fuente de verdad de
 * "hasta cuándo está pagado cada teléfono", vengan las renovaciones de donde
 * vengan. Ver `turso.ts` para qué pasa si no hay cuenta conectada todavía, y
 * por qué este módulo tampoco lleva `"server-only"`.
 */
import { clienteTurso, migrarTurso } from "./turso";

export interface FilaLicencia {
  codigo: string;
  nombre: string;
  vigenteHasta: string;
  diasDeGracia: number;
}

/** Todas las licencias, ordenadas por la que vence antes. `[]` si no hay Turso. */
export async function listarLicencias(): Promise<FilaLicencia[]> {
  const db = clienteTurso();
  if (!db) return [];
  await migrarTurso();
  const resultado = await db.execute(
    `select codigo, nombre, vigente_hasta, dias_de_gracia from licencias order by vigente_hasta asc`,
  );
  return resultado.rows.map((f) => ({
    codigo: String(f.codigo),
    nombre: String(f.nombre),
    vigenteHasta: String(f.vigente_hasta),
    diasDeGracia: Number(f.dias_de_gracia),
  }));
}

/**
 * La licencia actual de un teléfono, si ya tiene una. Es lo que se usa como
 * "previa" al renovar: quien paga antes de vencer no pierde los días que le
 * quedaban, igual que hace el CLI con su CSV.
 */
export async function buscarLicencia(codigo: string): Promise<{ vigenteHasta: string } | null> {
  const db = clienteTurso();
  if (!db) return null;
  await migrarTurso();
  const resultado = await db.execute({
    sql: `select vigente_hasta from licencias where codigo = ?`,
    args: [codigo],
  });
  const fila = resultado.rows[0];
  return fila ? { vigenteHasta: String(fila.vigente_hasta) } : null;
}

/**
 * Registra una emisión ya firmada: actualiza (o crea) la licencia y agrega
 * una fila al historial de pagos. Se llama **después** de firmar, nunca
 * antes: esto no firma nada, solo deja constancia de lo que ya se firmó.
 */
export async function registrarEmision(datos: {
  codigo: string;
  nombre: string;
  vigenteHasta: string;
  diasDeGracia: number;
  fechaDePago: string;
  /** "1", "12"… meses, o "15d" para una renovación corta en días. */
  duracion: string;
}): Promise<void> {
  const db = clienteTurso();
  if (!db) return;
  await migrarTurso();
  await db.batch(
    [
      {
        sql: `insert into licencias (codigo, nombre, vigente_hasta, dias_de_gracia) values (?, ?, ?, ?)
              on conflict (codigo) do update set
                nombre = excluded.nombre,
                vigente_hasta = excluded.vigente_hasta,
                dias_de_gracia = excluded.dias_de_gracia`,
        args: [datos.codigo, datos.nombre, datos.vigenteHasta, datos.diasDeGracia],
      },
      {
        sql: `insert into pagos (codigo, fecha, duracion, hasta) values (?, ?, ?, ?)`,
        args: [datos.codigo, datos.fechaDePago, datos.duracion, datos.vigenteHasta],
      },
    ],
    "write",
  );
}
