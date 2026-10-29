/**
 * La lógica pura del panel: estados, cifras del tablero, series por mes, CSV
 * y el mensaje de WhatsApp. Sin base de datos ni `server-only`, para poder
 * probarla (y para que el CLI use el mismo mensaje que el panel).
 */
import { diasEntre, nombreDelMes, primerDiaDelMes, sumarMeses, ultimoDiaDelMes, type FechaISO } from "../fechas";

export interface FilaLicencia {
  codigo: string;
  nombre: string;
  vigenteHasta: string;
  diasDeGracia: number;
  telefono: string | null;
  notas: string | null;
  creadaEn: string | null;
}

export interface FilaPago {
  id: number;
  codigo: string;
  fecha: string;
  /** "1", "12"… meses, o "15d". */
  duracion: string;
  hasta: string;
  montoCentimos: number | null;
  metodo: string | null;
  /** Fecha en que se anuló, o `null` si el pago vale. */
  anuladoEn: string | null;
}

export type EstadoPanel = "al_dia" | "por_vencer" | "gracia" | "vencido";

export const DIAS_POR_VENCER = 7;

export const ETIQUETA_ESTADO: Record<EstadoPanel, string> = {
  al_dia: "Al día",
  por_vencer: "Por vencer",
  gracia: "En gracia",
  vencido: "Vencido",
};

/** Al día · vence en ≤7 días · pasó la fecha pero está en gracia · vencido del todo. */
export function estadoDe(vigenteHasta: string, diasDeGracia: number, hoy: FechaISO): EstadoPanel {
  const restantes = diasEntre(hoy, vigenteHasta);
  if (restantes > DIAS_POR_VENCER) return "al_dia";
  if (restantes >= 0) return "por_vencer";
  if (restantes >= -diasDeGracia) return "gracia";
  return "vencido";
}

export function diasRestantes(vigenteHasta: string, hoy: FechaISO): number {
  return diasEntre(hoy, vigenteHasta);
}

/** "vence hoy", "vence en 3 días", "venció hace 2 días". */
export function textoVence(restantes: number): string {
  if (restantes === 0) return "vence hoy";
  if (restantes === 1) return "vence mañana";
  if (restantes > 1) return `vence en ${restantes} días`;
  if (restantes === -1) return "venció ayer";
  return `venció hace ${-restantes} días`;
}

const vale = (p: FilaPago) => p.anuladoEn === null;

export function totalPagadoCentimos(pagos: FilaPago[]): number {
  return pagos.filter(vale).reduce((s, p) => s + (p.montoCentimos ?? 0), 0);
}

/** 1500 → "S/ 15.00" */
export function formatearSoles(centimos: number): string {
  return `S/ ${(centimos / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export interface ResumenTablero {
  usuarios: number;
  activos: number;
  porVencer: number;
  enGracia: number;
  vencidos: number;
  ingresosMesCentimos: number;
  ingresosTotalesCentimos: number;
  /** Promedio por pago con monto. 0 si no hay ninguno. */
  ticketMedioCentimos: number;
  pagosConMonto: number;
}

export function resumenDelTablero(licencias: FilaLicencia[], pagos: FilaPago[], hoy: FechaISO): ResumenTablero {
  const r: ResumenTablero = {
    usuarios: licencias.length,
    activos: 0,
    porVencer: 0,
    enGracia: 0,
    vencidos: 0,
    ingresosMesCentimos: 0,
    ingresosTotalesCentimos: 0,
    ticketMedioCentimos: 0,
    pagosConMonto: 0,
  };
  for (const l of licencias) {
    const e = estadoDe(l.vigenteHasta, l.diasDeGracia, hoy);
    if (e === "al_dia") r.activos++;
    else if (e === "por_vencer") {
      r.activos++;
      r.porVencer++;
    } else if (e === "gracia") r.enGracia++;
    else r.vencidos++;
  }
  const mes = hoy.slice(0, 7);
  for (const p of pagos.filter(vale)) {
    const c = p.montoCentimos ?? 0;
    r.ingresosTotalesCentimos += c;
    if (p.fecha.slice(0, 7) === mes) r.ingresosMesCentimos += c;
    if (c > 0) r.pagosConMonto++;
  }
  r.ticketMedioCentimos = r.pagosConMonto > 0 ? Math.round(r.ingresosTotalesCentimos / r.pagosConMonto) : 0;
  return r;
}

export interface PuntoMes {
  /** `2026-10` */
  mes: string;
  /** "oct" */
  corto: string;
  valor: number;
}

const CORTOS = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

/** Los últimos `n` meses terminando en el de `hoy`, del más viejo al más nuevo. */
export function ultimosMeses(hoy: FechaISO, n = 12): string[] {
  const primero = primerDiaDelMes(hoy);
  const salida: string[] = [];
  for (let i = n - 1; i >= 0; i--) salida.push(sumarMeses(primero, -i).slice(0, 7));
  return salida;
}

const corto = (mes: string) => CORTOS[Number(mes.slice(5, 7)) - 1];

/** Ingresos (en céntimos) por mes de pago, sin contar anulados. */
export function ingresosPorMes(pagos: FilaPago[], hoy: FechaISO, n = 12): PuntoMes[] {
  const meses = ultimosMeses(hoy, n);
  const suma = new Map(meses.map((m) => [m, 0]));
  for (const p of pagos.filter(vale)) {
    const m = p.fecha.slice(0, 7);
    if (suma.has(m)) suma.set(m, (suma.get(m) ?? 0) + (p.montoCentimos ?? 0));
  }
  return meses.map((mes) => ({ mes, corto: corto(mes), valor: suma.get(mes) ?? 0 }));
}

/**
 * Usuarios con la licencia vigente en algún momento de cada mes: los que
 * tienen un pago cuyo tramo `[fecha, hasta]` toca ese mes.
 */
export function activosPorMes(pagos: FilaPago[], hoy: FechaISO, n = 12): PuntoMes[] {
  return ultimosMeses(hoy, n).map((mes) => {
    const ini = `${mes}-01`;
    const fin = ultimoDiaDelMes(ini);
    const codigos = new Set<string>();
    for (const p of pagos.filter(vale)) {
      if (p.fecha <= fin && p.hasta >= ini) codigos.add(p.codigo);
    }
    return { mes, corto: corto(mes), valor: codigos.size };
  });
}

export function nombreLargoDelMes(mes: string): string {
  return nombreDelMes(`${mes}-01`);
}

/** El pago vigente más reciente de un usuario (el que "Anular" deshace). */
export function ultimoPagoValido(pagos: FilaPago[]): FilaPago | null {
  const validos = pagos.filter(vale);
  return validos.reduce<FilaPago | null>((a, p) => (a === null || p.id > a.id ? p : a), null);
}

/**
 * Hasta cuándo queda pagado tras anular `anulado`: el `hasta` del pago válido
 * anterior; si no hay ninguno, el día antes de aquel pago (queda vencida).
 */
export function vigenciaTrasAnular(pagos: FilaPago[], anulado: FilaPago): string {
  const previo = pagos.filter((p) => vale(p) && p.id < anulado.id).reduce<FilaPago | null>((a, p) => (a === null || p.id > a.id ? p : a), null);
  if (previo) return previo.hasta;
  const [a, m, d] = anulado.fecha.split("-").map(Number);
  const ayer = new Date(Date.UTC(a, m - 1, d - 1));
  return ayer.toISOString().slice(0, 10);
}

/** "1 mes", "3 meses", "15 días". */
export function textoDuracion(duracion: string): string {
  const d = /^(\d+)d$/i.exec(duracion);
  if (d) return `${d[1]} día${d[1] === "1" ? "" : "s"}`;
  return `${duracion} mes${duracion === "1" ? "" : "es"}`;
}

/** El texto listo para pegar en WhatsApp (el mismo que imprime la terminal). */
export function mensajeParaWhatsApp(certificado: string): string {
  return `Tu licencia de Control Driver. Ábrela en Ajustes → Tu licencia → Pegar, y toca Activar:\n\n${certificado}`;
}

/* ---------------------------------------------------------------- CSV */

/**
 * Una celda de CSV. Además de comillas, neutraliza las fórmulas: un nombre
 * que empiece por `=`, `+`, `-` o `@` se ejecutaría al abrirlo en Excel.
 */
export function celdaCsv(valor: string | number | null | undefined): string {
  let t = valor === null || valor === undefined ? "" : String(valor);
  if (/^[=+\-@\t\r]/.test(t) && !/^-?\d+(\.\d+)?$/.test(t)) t = `'${t}`;
  return /[",\n\r;]/.test(t) ? `"${t.replaceAll('"', '""')}"` : t;
}

function aCsv(cabecera: string[], filas: (string | number | null)[][]): string {
  const lineas = [cabecera, ...filas].map((f) => f.map(celdaCsv).join(","));
  // BOM para que Excel lea bien las tildes; CRLF como manda el formato.
  return "﻿" + lineas.join("\r\n") + "\r\n";
}

const soles = (c: number | null) => (c === null ? "" : (c / 100).toFixed(2));

export function csvDePagos(pagos: FilaPago[], nombres: Map<string, string>): string {
  return aCsv(
    ["fecha", "codigo", "nombre", "duracion", "hasta", "monto_soles", "metodo", "anulado_en"],
    [...pagos]
      .sort((a, b) => a.fecha.localeCompare(b.fecha) || a.id - b.id)
      .map((p) => [p.fecha, p.codigo, nombres.get(p.codigo) ?? "", textoDuracion(p.duracion), p.hasta, soles(p.montoCentimos), p.metodo, p.anuladoEn]),
  );
}

export function csvDeUsuarios(licencias: FilaLicencia[], pagos: FilaPago[], hoy: FechaISO): string {
  return aCsv(
    ["codigo", "nombre", "telefono", "estado", "vigente_hasta", "alta", "pagos", "total_soles", "notas"],
    licencias.map((l) => {
      const propios = pagos.filter((p) => p.codigo === l.codigo);
      return [
        l.codigo,
        l.nombre,
        l.telefono,
        ETIQUETA_ESTADO[estadoDe(l.vigenteHasta, l.diasDeGracia, hoy)],
        l.vigenteHasta,
        l.creadaEn,
        propios.filter(vale).length,
        soles(totalPagadoCentimos(propios)),
        l.notas,
      ];
    }),
  );
}
