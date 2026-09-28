/**
 * Leer y escribir licencias en Turso, para el panel web y para el CLI.
 *
 * El CLI (`scripts/licencia.ts`) sigue siendo quien firma y quien manda el
 * mensaje de WhatsApp; esto solo guarda una copia del resultado para que el
 * panel web pueda mostrarla. Ver `turso.ts` para qué pasa si no hay cuenta
 * conectada todavía, y por qué este módulo tampoco lleva `"server-only"`.
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
