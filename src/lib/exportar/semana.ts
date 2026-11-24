/**
 * El reporte de pagos de una semana: cada pedido con su día, ruta, código, destino
 * y origen, el subtotal de cada día, el total de la semana y, si se cotejó con la
 * lista de la empresa, cuáles figuran y cuáles no.
 *
 * Es lo que se manda por WhatsApp (o se enseña) cuando hay que justificar un pago
 * o reclamar los pedidos que la empresa no contó. Puro, para probarlo sin pantalla.
 */
import type { JornadaCompleta, OrdenFila } from "@/lib/db/tipos";
import { esCodigoPendiente } from "@/lib/db/sqlite/jornadas";
import type { FechaISO } from "@/lib/fechas";
import { montoDelDia } from "@/lib/pagos/calcular-liquidacion";
import { TRAMO_MAS_DE_12_KM, esPorZona, etiquetaTramo, type ReglaPago } from "@/lib/pagos/reglas";

export type OrigenDePedido = "Sistema" | "Comanda" | "Manual" | "Reporte empresa";

export interface PedidoDeSemana {
  fecha: FechaISO;
  ruta: number | null;
  codigo: string;
  /** La zona (Miraflores, Chorrillos…) o el tramo por kilómetros. */
  destino: string;
  origen: OrigenDePedido;
  montoCentimos: number;
  /** Bono de campaña incluido en el monto, y cómo se llama. */
  bonoCentimos: number;
  bonoNombre: string | null;
  /** La empresa lo contó en su reporte. */
  contado: boolean;
  /** No estaba anotado: se añadió desde la lista de la empresa. */
  delReporte: boolean;
}

export interface DiaDeSemana {
  fecha: FechaISO;
  pedidos: PedidoDeSemana[];
  /** La suma de sus pedidos. */
  subtotalCentimos: number;
  /** Lo que se paga ese día: el mayor entre los pedidos y la permanencia, si la tienda la paga. */
  pagadoCentimos: number;
  pagaPor: "pedidos" | "permanencia";
}

export interface DatosDeSemana {
  conductor: string;
  tienda: string | null;
  desde: FechaISO;
  hasta: FechaISO;
  dias: DiaDeSemana[];
  /** ¿Se marcó algún pedido como contado? Si no, el reporte dice que no se cotejó. */
  cotejado: boolean;
  totales: {
    pedidos: number;
    subtotalCentimos: number;
    pagadoCentimos: number;
    contados: number;
    contadosCentimos: number;
    noFiguran: number;
    noFiguranCentimos: number;
    /** Los que se añadieron desde el reporte de la empresa porque no estaban anotados. */
    delReporte: number;
    delReporteCentimos: number;
  };
}

/** Cómo entró el pedido: del resumen de la app de reparto, de una comanda física, o escrito a mano. */
export function origenDe(o: Pick<OrdenFila, "origen" | "manual">): OrigenDePedido {
  if (o.origen === "reporte") return "Reporte empresa";
  if (o.origen === "manual" || o.manual) return "Manual";
  return o.origen === "comanda" ? "Comanda" : "Sistema";
}

/** A dónde fue: la zona por su nombre, o el tramo con sus kilómetros. */
export function destinoDe(regla: ReglaPago, o: Pick<OrdenFila, "tramo">): string {
  if (esPorZona(regla)) return etiquetaTramo(regla, o.tramo);
  if (o.tramo === TRAMO_MAS_DE_12_KM) return "Más de 12 km";
  const t = regla.tramos.find((x) => x.id === o.tramo);
  return t ? `Tramo ${t.id} (${t.desde}–${t.hasta} km)` : `Tramo ${o.tramo}`;
}

export function armarSemana(entrada: {
  conductor: string;
  tienda: string | null;
  desde: FechaISO;
  hasta: FechaISO;
  jornadas: readonly JornadaCompleta[];
  regla: ReglaPago;
}): DatosDeSemana {
  const { regla } = entrada;
  const dias: DiaDeSemana[] = [...entrada.jornadas]
    .sort((a, b) => (a.fecha < b.fecha ? -1 : 1))
    .filter((j) => j.ordenes.length > 0)
    .map((j) => {
      const pedidos: PedidoDeSemana[] = j.ordenes.map((o) => ({
        fecha: j.fecha,
        ruta: o.ruta,
        codigo: esCodigoPendiente(o.codigo) ? "Sin código" : o.codigo,
        destino: destinoDe(regla, o),
        origen: origenDe(o),
        montoCentimos: o.montoCentimos ?? 0,
        bonoCentimos: o.bonoCentimos ?? 0,
        bonoNombre: o.bonoNombre ?? null,
        contado: o.contado,
        delReporte: o.origen === "reporte",
      }));
      // Por ruta y, dentro de cada ruta, por el orden en que se hicieron (como en la app).
      pedidos.sort((a, b) => (a.ruta ?? 99) - (b.ruta ?? 99));
      const subtotalCentimos = pedidos.reduce((s, p) => s + p.montoCentimos, 0);
      const dia = montoDelDia(subtotalCentimos, regla, j.horaEntrada, j.horaSalida);
      return {
        fecha: j.fecha,
        pedidos,
        subtotalCentimos,
        pagadoCentimos: dia.pagadoCentimos,
        pagaPor: dia.pagaPor,
      };
    });

  const todos = dias.flatMap((d) => d.pedidos);
  const contados = todos.filter((p) => p.contado);
  const noFiguran = todos.filter((p) => !p.contado);
  const delReporte = todos.filter((p) => p.delReporte);
  return {
    conductor: entrada.conductor,
    tienda: entrada.tienda,
    desde: entrada.desde,
    hasta: entrada.hasta,
    dias,
    cotejado: contados.length > 0,
    totales: {
      pedidos: todos.length,
      subtotalCentimos: dias.reduce((s, d) => s + d.subtotalCentimos, 0),
      pagadoCentimos: dias.reduce((s, d) => s + d.pagadoCentimos, 0),
      contados: contados.length,
      contadosCentimos: contados.reduce((s, p) => s + p.montoCentimos, 0),
      noFiguran: noFiguran.length,
      noFiguranCentimos: noFiguran.reduce((s, p) => s + p.montoCentimos, 0),
      delReporte: delReporte.length,
      delReporteCentimos: delReporte.reduce((s, p) => s + p.montoCentimos, 0),
    },
  };
}

export const nombreArchivoDeSemana = (d: Pick<DatosDeSemana, "desde" | "hasta">) => `pagos_semana_${d.desde}_a_${d.hasta}.pdf`;
