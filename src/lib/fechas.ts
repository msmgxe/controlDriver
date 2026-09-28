/**
 * Fechas de Rutas-A.
 *
 * Dos conceptos que no hay que mezclar (§13):
 *
 *  - La **fecha de la jornada** es la del encabezado de la captura
 *    (`Resumen del DD/MM/YYYY`). Es una fecha de calendario, sin hora y sin
 *    zona: se guarda como `date` y toda la aritmética de semanas se hace sobre
 *    la cadena `YYYY-MM-DD`. Por eso aquí no hay conversiones de zona horaria:
 *    meterlas sería justo la forma de introducir errores de un día.
 *
 *  - La **fecha de carga** sí es un instante. Solo importa para saber qué día
 *    es "hoy" para el driver, y eso se resuelve en `America/Lima`.
 *
 * Las capturas del domingo se pueden subir el lunes: manda la fecha de la
 * jornada, nunca la de carga.
 */

const ZONA = "America/Lima";

/** Fecha de calendario en formato `YYYY-MM-DD`. */
export type FechaISO = string;

const RE_FECHA = /^\d{4}-\d{2}-\d{2}$/;

export function esFechaISO(valor: unknown): valor is FechaISO {
  return typeof valor === "string" && RE_FECHA.test(valor) && !Number.isNaN(Date.parse(valor + "T00:00:00Z"));
}

function aDate(f: FechaISO): Date {
  if (!esFechaISO(f)) throw new RangeError(`Fecha inválida: ${f}`);
  return new Date(f + "T00:00:00Z");
}

function aISO(d: Date): FechaISO {
  return d.toISOString().slice(0, 10);
}

/** Suma (o resta, con n negativo) días de calendario. */
export function sumarDias(f: FechaISO, n: number): FechaISO {
  const d = aDate(f);
  d.setUTCDate(d.getUTCDate() + n);
  return aISO(d);
}

/** 0 = domingo … 6 = sábado, igual que `Date.prototype.getDay`. */
export function diaDeLaSemana(f: FechaISO): number {
  return aDate(f).getUTCDay();
}

/** Días de calendario entre dos fechas (b − a). */
export function diasEntre(a: FechaISO, b: FechaISO): number {
  return Math.round((aDate(b).getTime() - aDate(a).getTime()) / 86_400_000);
}

/** Todas las fechas del rango, ambos extremos incluidos. */
export function rangoDeFechas(desde: FechaISO, hasta: FechaISO): FechaISO[] {
  if (diasEntre(desde, hasta) < 0) return [];
  const out: FechaISO[] = [];
  for (let f = desde; diasEntre(f, hasta) >= 0; f = sumarDias(f, 1)) out.push(f);
  return out;
}

/** Hoy según el reloj del driver, no el del servidor. */
export function hoyEnLima(ahora: Date = new Date()): FechaISO {
  // 'en-CA' formatea como YYYY-MM-DD.
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: ZONA,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(ahora);
}

/** La hora ahora mismo en Lima, "HH:MM" de 24 horas. */
export function horaEnLima(ahora: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: ZONA,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(ahora);
}

/* ---------------------------------------------------------------------------
 * Semanas de trabajo (§13)
 *
 * La semana va de lunes 00:00 a domingo 23:59. El corte es el domingo por la
 * noche y el pago, el viernes siguiente: `fecha_pago = semana_fin + 5 días`.
 * ------------------------------------------------------------------------- */

export interface Semana {
  /** Lunes. */
  inicio: FechaISO;
  /** Domingo. */
  fin: FechaISO;
  /** Viernes siguiente al corte. */
  pago: FechaISO;
}

/** El lunes de la semana a la que pertenece esa fecha de jornada. */
export function lunesDeLaSemana(f: FechaISO): FechaISO {
  // getUTCDay da 0 para domingo; queremos que el domingo cierre la semana, no
  // que la abra, así que lo mapeamos a 6.
  const desplazamiento = (diaDeLaSemana(f) + 6) % 7;
  return sumarDias(f, -desplazamiento);
}

/** Viernes de pago de una semana que cerró ese domingo. */
export function fechaDePago(semanaFin: FechaISO): FechaISO {
  return sumarDias(semanaFin, 5);
}

/** La semana completa (lunes, domingo y viernes de pago) de una fecha. */
export function semanaDe(f: FechaISO): Semana {
  const inicio = lunesDeLaSemana(f);
  const fin = sumarDias(inicio, 6);
  return { inicio, fin, pago: fechaDePago(fin) };
}

/** ¿Esa fecha de jornada cae dentro de la semana? */
export function caeEnSemana(f: FechaISO, semana: Semana): boolean {
  return diasEntre(semana.inicio, f) >= 0 && diasEntre(f, semana.fin) >= 0;
}

/* ---------------------------------------------------------------------------
 * Presentación (§9: horas 24 h, fechas DD/MM/YYYY, interfaz en español)
 * ------------------------------------------------------------------------- */

const DIAS = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"] as const;
const MESES = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
] as const;

export function formatearFecha(f: FechaISO): string {
  const [a, m, d] = f.split("-");
  return `${d}/${m}/${a}`;
}

export function nombreDelDia(f: FechaISO): string {
  return DIAS[diaDeLaSemana(f)];
}

/* ---------------------------------------------------------------------------
 * Meses
 * ------------------------------------------------------------------------- */

/** El primer día del mes de esa fecha: `2026-09-16` → `2026-09-01`. */
export function primerDiaDelMes(f: FechaISO): FechaISO {
  return `${f.slice(0, 8)}01`;
}

/** El último día del mes de esa fecha: `2026-09-16` → `2026-09-30`. */
export function ultimoDiaDelMes(f: FechaISO): FechaISO {
  const d = aDate(primerDiaDelMes(f));
  d.setUTCMonth(d.getUTCMonth() + 1, 0);
  return aISO(d);
}

/** El primer día del mes que queda `n` meses después (o antes, con `n` negativo). */
export function sumarMeses(f: FechaISO, n: number): FechaISO {
  const d = aDate(primerDiaDelMes(f));
  d.setUTCMonth(d.getUTCMonth() + n, 1);
  return aISO(d);
}

/** "septiembre 2026" */
export function nombreDelMes(f: FechaISO): string {
  const d = aDate(f);
  return `${MESES[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

/**
 * Un rango en corto, para un rótulo: «21–27 sep 2026», o «28 sep – 4 oct 2026»
 * si cruza de mes. El año va una sola vez, salvo que cruce de año.
 */
export function rangoLegible(desde: FechaISO, hasta: FechaISO): string {
  const d = aDate(desde);
  const h = aDate(hasta);
  const corto = (x: Date) => MESES[x.getUTCMonth()].slice(0, 3);
  if (d.getUTCFullYear() !== h.getUTCFullYear()) {
    return `${d.getUTCDate()} ${corto(d)} ${d.getUTCFullYear()} – ${h.getUTCDate()} ${corto(h)} ${h.getUTCFullYear()}`;
  }
  if (d.getUTCMonth() !== h.getUTCMonth()) {
    return `${d.getUTCDate()} ${corto(d)} – ${h.getUTCDate()} ${corto(h)} ${h.getUTCFullYear()}`;
  }
  if (d.getUTCDate() === h.getUTCDate()) return `${d.getUTCDate()} ${corto(d)} ${d.getUTCFullYear()}`;
  return `${d.getUTCDate()}–${h.getUTCDate()} ${corto(d)} ${d.getUTCFullYear()}`;
}

/** "miércoles 16 de septiembre de 2026" */
export function formatearFechaLarga(f: FechaISO): string {
  const d = aDate(f);
  return `${nombreDelDia(f)} ${d.getUTCDate()} de ${MESES[d.getUTCMonth()]} de ${d.getUTCFullYear()}`;
}

/** Minutos a "3 h 02 min". */
export function formatearDuracion(minutos: number): string {
  const h = Math.floor(minutos / 60);
  const m = minutos % 60;
  return h > 0 ? `${h} h ${String(m).padStart(2, "0")} min` : `${m} min`;
}
