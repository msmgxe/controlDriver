/**
 * Leer y escribir licencias en Turso: la base que comparten el CLI
 * (`scripts/licencia.ts`) y el panel web (`src/lib/licencia/servidor.ts`).
 * Los dos firman —cada uno con su copia de la clave privada, una en
 * `~/.rutas-a` y otra en la variable de entorno del servidor— y los dos
 * terminan escribiendo aquí, así que esta tabla es la fuente de verdad de
 * "hasta cuándo está pagado cada teléfono", vengan las renovaciones de donde
 * vengan. Ver `turso.ts` para qué pasa si no hay cuenta conectada todavía, y
 * por qué este módulo tampoco lleva `"server-only"`.
 *
 * Todas las funciones aceptan un cliente opcional: en producción es el de
 * Turso; en las pruebas, una base en memoria.
 */
import type { Client } from "@libsql/client";

import {
  ultimoPagoValido,
  vigenciaTrasAnular,
  type FilaLicencia,
  type FilaPago,
} from "./panel";
import { clienteTurso, migrarTurso } from "./turso";

export type { FilaLicencia, FilaPago } from "./panel";

/** El cliente a usar, ya migrado. `null` si no hay Turso. */
async function base(db?: Client): Promise<Client | null> {
  if (db) return db;
  const c = clienteTurso();
  if (!c) return null;
  await migrarTurso();
  return c;
}

const texto = (v: unknown): string | null => (v === null || v === undefined ? null : String(v));

function filaLicencia(f: Record<string, unknown>): FilaLicencia {
  return {
    codigo: String(f.codigo),
    nombre: String(f.nombre),
    vigenteHasta: String(f.vigente_hasta),
    diasDeGracia: Number(f.dias_de_gracia),
    telefono: texto(f.telefono),
    notas: texto(f.notas),
    creadaEn: texto(f.creada_en),
  };
}

function filaPago(f: Record<string, unknown>): FilaPago {
  return {
    id: Number(f.id),
    codigo: String(f.codigo),
    fecha: String(f.fecha),
    duracion: String(f.duracion),
    hasta: String(f.hasta),
    montoCentimos: f.monto_centimos === null || f.monto_centimos === undefined ? null : Number(f.monto_centimos),
    metodo: texto(f.metodo),
    anuladoEn: texto(f.anulado_en),
  };
}

const COLUMNAS_LICENCIA = "codigo, nombre, vigente_hasta, dias_de_gracia, telefono, notas, creada_en";
const COLUMNAS_PAGO = "id, codigo, fecha, duracion, hasta, monto_centimos, metodo, anulado_en";

/** Todas las licencias, ordenadas por la que vence antes. `[]` si no hay Turso. */
export async function listarLicencias(db?: Client): Promise<FilaLicencia[]> {
  const c = await base(db);
  if (!c) return [];
  const r = await c.execute(`select ${COLUMNAS_LICENCIA} from licencias order by vigente_hasta asc`);
  return r.rows.map(filaLicencia);
}

export async function listarPagos(db?: Client): Promise<FilaPago[]> {
  const c = await base(db);
  if (!c) return [];
  const r = await c.execute(`select ${COLUMNAS_PAGO} from pagos order by id asc`);
  return r.rows.map(filaPago);
}

export async function obtenerLicencia(codigo: string, db?: Client): Promise<FilaLicencia | null> {
  const c = await base(db);
  if (!c) return null;
  const r = await c.execute({ sql: `select ${COLUMNAS_LICENCIA} from licencias where codigo = ?`, args: [codigo] });
  return r.rows[0] ? filaLicencia(r.rows[0]) : null;
}

export async function pagosDe(codigo: string, db?: Client): Promise<FilaPago[]> {
  const c = await base(db);
  if (!c) return [];
  const r = await c.execute({ sql: `select ${COLUMNAS_PAGO} from pagos where codigo = ? order by id asc`, args: [codigo] });
  return r.rows.map(filaPago);
}

/**
 * La licencia actual de un teléfono, si ya tiene una. Es lo que se usa como
 * "previa" al renovar: quien paga antes de vencer no pierde los días que le
 * quedaban, igual que hace el CLI con su CSV.
 */
export async function buscarLicencia(codigo: string, db?: Client): Promise<{ vigenteHasta: string } | null> {
  const l = await obtenerLicencia(codigo, db);
  return l ? { vigenteHasta: l.vigenteHasta } : null;
}

export interface DatosEmisionRegistrada {
  codigo: string;
  nombre: string;
  vigenteHasta: string;
  diasDeGracia: number;
  fechaDePago: string;
  /** "1", "12"… meses, o "15d" para una renovación corta en días. */
  duracion: string;
  /** Lo pagado, en céntimos. Opcional. */
  montoCentimos?: number | null;
  metodo?: string | null;
  telefono?: string | null;
  notas?: string | null;
}

/**
 * Registra una emisión ya firmada: actualiza (o crea) la licencia y agrega
 * una fila al historial de pagos. Se llama **después** de firmar, nunca
 * antes: esto no firma nada, solo deja constancia de lo que ya se firmó.
 *
 * El teléfono y las notas solo se pisan si vienen con valor: renovar sin
 * volver a escribirlos no los borra. `creada_en` se pone solo la primera vez.
 */
export async function registrarEmision(datos: DatosEmisionRegistrada, db?: Client): Promise<void> {
  const c = await base(db);
  if (!c) return;
  await c.batch(
    [
      {
        sql: `insert into licencias (codigo, nombre, vigente_hasta, dias_de_gracia, telefono, notas, creada_en)
              values (?, ?, ?, ?, ?, ?, ?)
              on conflict (codigo) do update set
                nombre = excluded.nombre,
                vigente_hasta = excluded.vigente_hasta,
                dias_de_gracia = excluded.dias_de_gracia,
                telefono = coalesce(excluded.telefono, licencias.telefono),
                notas = coalesce(excluded.notas, licencias.notas),
                creada_en = coalesce(licencias.creada_en, excluded.creada_en)`,
        args: [
          datos.codigo,
          datos.nombre,
          datos.vigenteHasta,
          datos.diasDeGracia,
          datos.telefono ?? null,
          datos.notas ?? null,
          datos.fechaDePago,
        ],
      },
      {
        sql: `insert into pagos (codigo, fecha, duracion, hasta, monto_centimos, metodo) values (?, ?, ?, ?, ?, ?)`,
        args: [
          datos.codigo,
          datos.fechaDePago,
          datos.duracion,
          datos.vigenteHasta,
          datos.montoCentimos ?? null,
          datos.metodo ?? null,
        ],
      },
    ],
    "write",
  );
}

export async function guardarContacto(
  datos: { codigo: string; nombre: string; telefono: string | null; notas: string | null },
  db?: Client,
): Promise<boolean> {
  const c = await base(db);
  if (!c) return false;
  const r = await c.execute({
    sql: `update licencias set nombre = ?, telefono = ?, notas = ? where codigo = ?`,
    args: [datos.nombre, datos.telefono, datos.notas, datos.codigo],
  });
  return r.rowsAffected > 0;
}

export type ResultadoAnulacion = { ok: true; vigenteHasta: string } | { ok: false; error: string };

/**
 * Anula el último pago vigente de un usuario y devuelve la vigencia al pago
 * anterior. Exige el `id` del pago que se vio en pantalla: si mientras tanto
 * entró otro, no anula uno distinto al que se confirmó.
 *
 * El certificado ya enviado NO se puede revocar (vive en el teléfono):
 * anular corrige el registro y los números, nada más.
 */
export async function anularPago(
  codigo: string,
  pagoId: number,
  hoy: string,
  db?: Client,
): Promise<ResultadoAnulacion> {
  const c = await base(db);
  if (!c) return { ok: false, error: "Turso no está configurado." };
  const pagos = await pagosDe(codigo, c);
  const ultimo = ultimoPagoValido(pagos);
  if (!ultimo) return { ok: false, error: "Este usuario no tiene pagos que anular." };
  if (ultimo.id !== pagoId) return { ok: false, error: "El último pago cambió. Recarga la página y vuelve a confirmar." };
  const nueva = vigenciaTrasAnular(pagos, ultimo);
  await c.batch(
    [
      { sql: `update pagos set anulado_en = ? where id = ? and anulado_en is null`, args: [hoy, pagoId] },
      { sql: `update licencias set vigente_hasta = ? where codigo = ?`, args: [nueva, codigo] },
    ],
    "write",
  );
  return { ok: true, vigenteHasta: nueva };
}

/* ----------------------------------------------------------- auditoría */

export async function registrarAuditoria(
  accion: string,
  codigo: string | null,
  ipResumida: string,
  db?: Client,
): Promise<void> {
  const c = await base(db);
  if (!c) return;
  await c.execute({
    sql: `insert into auditoria (fecha, accion, codigo, ip) values (?, ?, ?, ?)`,
    args: [new Date().toISOString(), accion, codigo, ipResumida],
  });
}

export async function contarAuditoria(acciones: string[], desdeIso: string, db?: Client): Promise<number> {
  const c = await base(db);
  if (!c || acciones.length === 0) return 0;
  const marcas = acciones.map(() => "?").join(", ");
  const r = await c.execute({
    sql: `select count(*) as n from auditoria where accion in (${marcas}) and fecha >= ?`,
    args: [...acciones, desdeIso],
  });
  return Number(r.rows[0]?.n ?? 0);
}

export interface FilaAuditoria {
  fecha: string;
  accion: string;
  codigo: string | null;
  ip: string | null;
}

export async function ultimaAuditoria(limite = 15, db?: Client): Promise<FilaAuditoria[]> {
  const c = await base(db);
  if (!c) return [];
  const r = await c.execute({ sql: `select fecha, accion, codigo, ip from auditoria order by id desc limit ?`, args: [limite] });
  return r.rows.map((f) => ({ fecha: String(f.fecha), accion: String(f.accion), codigo: texto(f.codigo), ip: texto(f.ip) }));
}

/* --------------------------------------------------- límite de intentos */

export async function intentosRecientes(clave: string, desdeMs: number, db?: Client): Promise<number> {
  const c = await base(db);
  if (!c) return 0;
  const r = await c.execute({ sql: `select count(*) as n from intentos_login where clave = ? and en >= ?`, args: [clave, desdeMs] });
  return Number(r.rows[0]?.n ?? 0);
}

export async function anotarIntento(clave: string, ahoraMs: number, db?: Client): Promise<void> {
  const c = await base(db);
  if (!c) return;
  await c.batch(
    [
      { sql: `insert into intentos_login (clave, en) values (?, ?)`, args: [clave, ahoraMs] },
      // Limpieza barata de lo viejo, para que la tabla no crezca sin fin.
      { sql: `delete from intentos_login where en < ?`, args: [ahoraMs - 24 * 60 * 60 * 1000] },
    ],
    "write",
  );
}

export async function borrarIntentos(clave: string, db?: Client): Promise<void> {
  const c = await base(db);
  if (!c) return;
  await c.execute({ sql: `delete from intentos_login where clave = ?`, args: [clave] });
}
