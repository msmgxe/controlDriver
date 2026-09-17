import type { FechaISO } from "@/lib/fechas";

/**
 * Datos que viajan del servidor al navegador para exportar (§11).
 *
 * La generación ocurre **en el propio dispositivo**: el servidor manda las
 * filas y el celular arma el archivo. Así no hay que subir nada a ningún sitio
 * ni guardar un archivo temporal con códigos de pedido.
 */

export interface RutaExportable {
  numero: number;
  horaInicio: string | null;
  horaFin: string | null;
  duracionMin: number | null;
  pedidos: number;
}

export interface PedidoExportable {
  posicion: number;
  codigo: string;
  ruta: number | null;
  horarioRuta: string | null;
  estado: string;
  tramo: number;
  km: number | null;
  montoCentimos: number;
}

export interface JornadaExportable {
  fecha: FechaISO;
  rutas: RutaExportable[];
  pedidos: PedidoExportable[];
  minutosEnRuta: number;
  montoPedidosCentimos: number;
  montoPermanenciaCentimos: number;
  /** El mayor de los dos: lo que realmente se cobra ese día (§13 bis). */
  montoCentimos: number;
  horasPermanencia: number;
  pagaPor: "pedidos" | "permanencia";
}

export interface DatosExportacion {
  driver: string;
  tienda: string | null;
  desde: FechaISO;
  hasta: FechaISO;
  jornadas: JornadaExportable[];
}

export function totalesDe(datos: DatosExportacion) {
  return datos.jornadas.reduce(
    (acc, j) => ({
      pedidos: acc.pedidos + j.pedidos.length,
      rutas: acc.rutas + j.rutas.length,
      minutos: acc.minutos + j.minutosEnRuta,
      centimos: acc.centimos + j.montoCentimos,
    }),
    { pedidos: 0, rutas: 0, minutos: 0, centimos: 0 },
  );
}

/**
 * Nombre de archivo del rango: `pedidos_2026-09-14_a_2026-09-20.xlsx` (§11).
 */
export function nombreArchivo(datos: DatosExportacion, extension: string): string {
  return `pedidos_${datos.desde}_a_${datos.hasta}.${extension}`;
}

/**
 * Neutraliza la inyección de fórmulas en una celda de texto.
 *
 * Los códigos de pedido salen de leer una imagen, así que un error de lectura
 * podría producir algo que empiece por `=`, `+`, `-` o `@`. Excel lo
 * interpretaría como fórmula al abrir el archivo. El apóstrofo lo fuerza a
 * texto y no se ve en la celda.
 */
export function comoTexto(valor: string): string {
  return /^[=+\-@\t\r]/.test(valor) ? `'${valor}` : valor;
}

/** Minutos a la fracción de día que Excel entiende como hora. */
export function comoHoraExcel(minutos: number): number {
  return minutos / 1440;
}

/** `YYYY-MM-DD` a un Date local, para que Excel no lo corra un día. */
export function comoFechaExcel(fecha: FechaISO): Date {
  const [a, m, d] = fecha.split("-").map(Number);
  return new Date(a, m - 1, d);
}

/** `HH:MM` a fracción de día, o null. */
export function horaAFraccion(hora: string | null): number | null {
  if (!hora) return null;
  return (Number(hora.slice(0, 2)) * 60 + Number(hora.slice(3, 5))) / 1440;
}
