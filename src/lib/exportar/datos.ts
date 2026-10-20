import type { FechaISO } from "@/lib/fechas";
import type { BloqueExtraFila } from "@/lib/db/tipos";
import { desglosePorFuente, type FilaDeDesglose } from "@/lib/pagos/desglose";

/**
 * Datos que viajan del servidor al navegador para exportar (§11).
 *
 * La generación ocurre **en el propio dispositivo**: el servidor manda las
 * filas y el celular arma el archivo. Así no hay que subir nada a ningún sitio
 * ni guardar un archivo temporal con códigos de pedido.
 */

interface RutaExportable {
  numero: number;
  horaInicio: string | null;
  horaFin: string | null;
  duracionMin: number | null;
  pedidos: number;
}

interface PedidoExportable {
  posicion: number;
  codigo: string;
  ruta: number | null;
  horarioRuta: string | null;
  estado: string;
  tramo: number;
  km: number | null;
  montoCentimos: number;
}

interface JornadaExportable {
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

/** Un apoyo o una carrera de taxi, con su día, para el archivo. */
export interface BloqueExportable {
  fecha: FechaISO;
  bloque: BloqueExtraFila;
}

export interface DatosExportacion {
  driver: string;
  tienda: string | null;
  desde: FechaISO;
  hasta: FechaISO;
  jornadas: JornadaExportable[];
  /** Apoyo a otras tiendas y taxi del rango, por día. */
  bloques: BloqueExportable[];
}

/**
 * Los totales del rango. `centimos` es **todo** lo que produjo (tienda + apoyo +
 * taxi); `centimosTienda`, `centimosApoyo` y `centimosTaxi` dicen cuánto fue de
 * cada fuente.
 */
export function totalesDe(datos: DatosExportacion) {
  const base = datos.jornadas.reduce(
    (acc, j) => ({
      pedidos: acc.pedidos + j.pedidos.length,
      rutas: acc.rutas + j.rutas.length,
      minutos: acc.minutos + j.minutosEnRuta,
      centimosTienda: acc.centimosTienda + j.montoCentimos,
    }),
    { pedidos: 0, rutas: 0, minutos: 0, centimosTienda: 0 },
  );
  const centimosApoyo = datos.bloques.filter((x) => x.bloque.tipo !== "taxi").reduce((s, x) => s + x.bloque.montoCentimos, 0);
  const centimosTaxi = datos.bloques.filter((x) => x.bloque.tipo === "taxi").reduce((s, x) => s + x.bloque.montoCentimos, 0);
  return {
    ...base,
    centimosApoyo,
    centimosTaxi,
    centimos: base.centimosTienda + centimosApoyo + centimosTaxi,
  };
}

/** Las fuentes del rango: tu tienda, cada tienda de apoyo y el taxi. */
export function fuentesDe(datos: DatosExportacion): FilaDeDesglose[] {
  const t = totalesDe(datos);
  return desglosePorFuente({
    tiendaNombre: datos.tienda,
    pedidosTienda: t.pedidos,
    centimosTienda: t.centimosTienda,
    bloques: datos.bloques.map((x) => x.bloque),
  });
}

/** Cuántos pedidos y cuánto sumó cada tramo en todo el rango. */
export function tramosDe(datos: DatosExportacion): Array<{ tramo: number; pedidos: number; centimos: number }> {
  const mapa = new Map<number, { pedidos: number; centimos: number }>();
  for (const j of datos.jornadas)
    for (const p of j.pedidos) {
      const t = mapa.get(p.tramo) ?? { pedidos: 0, centimos: 0 };
      t.pedidos += 1;
      t.centimos += p.montoCentimos;
      mapa.set(p.tramo, t);
    }
  return [...mapa].sort((a, b) => a[0] - b[0]).map(([tramo, v]) => ({ tramo, ...v }));
}

/** Qué se muestra de un bloque en una tabla: tipo, detalle y horario. */
export function describirBloque(b: BloqueExtraFila): { tipo: string; titulo: string; detalle: string; horario: string } {
  const horario = b.horaInicio ? `${b.horaInicio}${b.horaFin ? `–${b.horaFin}` : ""}` : "—";
  if (b.tipo === "apoyo_hora")
    return {
      tipo: "Apoyo por hora",
      titulo: b.tiendaNombre,
      detalle: `${b.horas} h × S/ ${(b.tarifaHoraCentimos / 100).toFixed(2)}${b.motivo ? ` · ${b.motivo}` : ""}`,
      horario,
    };
  if (b.tipo === "apoyo_tramos")
    return {
      tipo: "Apoyo por tramos",
      titulo: b.tiendaNombre,
      detalle: `${b.pedidos.length} pedido${b.pedidos.length === 1 ? "" : "s"} (tramos ${b.pedidos.map((p) => p.tramo).join(", ")})`,
      horario,
    };
  return {
    tipo: "Adicional",
    titulo: b.categoriaNombre ?? "Taxi",
    detalle: [b.descripcion, b.km ? `${b.km} km` : null].filter(Boolean).join(" · ") || "—",
    horario,
  };
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
