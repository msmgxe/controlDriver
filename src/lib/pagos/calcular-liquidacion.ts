import {
  caeEnSemana,
  rangoDeFechas,
  semanaDe,
  type FechaISO,
  type Semana,
} from "@/lib/fechas";
import {
  TRAMO_MAS_DE_12_KM,
  horasDePermanencia,
  montoPorPermanencia,
  pagoDelTramo,
  type ReglaPago,
} from "./reglas";

/**
 * Liquidación semanal (§13).
 *
 * Función pura: mismas jornadas y misma regla, mismo resultado. No lee la hora
 * del sistema ni consulta la base de datos, así que es directamente testeable
 * y se puede recalcular al vuelo cada vez que se guarda una jornada.
 *
 * Todo el dinero va en céntimos enteros.
 */

export interface PedidoLiquidable {
  codigo: string;
  /** 1 a 5 de la tabla de tarifas; 6 = más de 12 km, con monto manual. */
  tramo: number;
  /** Se guarda para estadísticas. NO afecta el monto: todos los pedidos se pagan. */
  estado: string;
  ruta: number | null;
  /** Solo para el tramo 6, mientras la tarifa de más de 12 km siga sin definirse. */
  montoManualCentimos?: number | null;
}

export interface RutaLiquidable {
  numero: number;
  duracionMin: number | null;
}

export interface JornadaLiquidable {
  fecha: FechaISO;
  rutas: RutaLiquidable[];
  pedidos: PedidoLiquidable[];
  /**
   * Horas de entrada y salida de la tienda, `HH:MM`. No salen de las capturas
   * —esas traen horarios de ruta, no de permanencia—: vienen del horario del
   * driver, editable por jornada.
   */
  horaEntrada?: string | null;
  horaSalida?: string | null;
}

export interface DetalleDia {
  fecha: FechaISO;
  rutas: number;
  pedidos: number;
  minutosEnRuta: number;
  /** Lo que suman los pedidos del día. */
  montoPedidosCentimos: number;
  /** Lo que garantiza la permanencia, o 0 si la tienda no la paga. */
  montoPermanenciaCentimos: number;
  horasPermanencia: number;
  /** Cuál de los dos ganó. */
  pagaPor: "pedidos" | "permanencia";
  /** El mayor de los dos: lo que realmente se cobra ese día. */
  montoCentimos: number;
}

export interface DetalleRuta {
  fecha: FechaISO;
  numero: number;
  pedidos: number;
  duracionMin: number | null;
  montoCentimos: number;
}

export interface PedidoSinTarifa {
  fecha: FechaISO;
  codigo: string;
  tramo: number;
  motivo: "mas-de-12-km-sin-monto" | "tramo-desconocido";
}

export interface Liquidacion {
  semana: Semana;
  totalRutas: number;
  totalOrdenes: number;
  /** { "1": 78, "2": 6, … } — cuántos pedidos cayeron en cada tramo. */
  ordenesPorTramo: Record<string, number>;
  /** Suma de lo que se cobra cada día: por día, el mayor de los dos. */
  montoCalculadoCentimos: number;
  /** Lo que habrían sumado los pedidos solos, sin la garantía. */
  montoPorPedidosCentimos: number;
  /** Días en que la permanencia superó a los pedidos y pagó el piso. */
  diasConGarantia: number;
  minutosEnRuta: number;
  detalle: {
    porDia: DetalleDia[];
    porRuta: DetalleRuta[];
  };
  /**
   * Días de la semana sin jornada cargada, hasta `hasta` inclusive. Alimenta el
   * aviso "¿No trabajaste el jueves o falta subirlo?" del cierre.
   */
  diasSinCarga: FechaISO[];
  /**
   * Pedidos que no se pudieron tarifar. No se suman al monto y hay que
   * resolverlos antes de cerrar la semana.
   */
  pedidosSinTarifa: PedidoSinTarifa[];
}

export interface OpcionesLiquidacion {
  /**
   * Hasta qué día contar los huecos. Para la semana en curso es hoy; para una
   * semana cerrada, el domingo. Si se omite, se usa el domingo de la semana.
   */
  hasta?: FechaISO;
}

/**
 * Calcula la liquidación de la semana a la que pertenece `referencia`.
 *
 * Las jornadas que caigan fuera de esa semana se ignoran, así que se le puede
 * pasar el historial entero sin filtrarlo antes.
 */
/**
 * Lo que se cobra por un día: **el mayor** de lo que sumaron los pedidos y lo
 * que garantiza la permanencia en tienda (§13 bis).
 *
 * Es la única fuente de verdad del monto de un día, y todas las pantallas la
 * usan. Existe porque antes cada pantalla lo calculaba a su manera: Inicio
 * sumaba solo los pedidos y el detalle aplicaba el piso, así que el mismo día
 * salía S/ 20 en una y S/ 130 en otra. Un número de dinero que cambia según
 * dónde se mire destruye la confianza en todos los demás.
 */
export interface MontoDelDia {
  /** Lo que suman los pedidos, sin el piso. */
  pedidosCentimos: number;
  /** Lo que garantiza la permanencia, o 0 si la tienda no la paga. */
  permanenciaCentimos: number;
  /** Lo que de verdad se cobra: el mayor de los dos. */
  pagadoCentimos: number;
  pagaPor: "pedidos" | "permanencia";
}

export function montoDelDia(
  pedidosCentimos: number,
  regla: ReglaPago,
  horaEntrada: string | null,
  horaSalida: string | null,
): MontoDelDia {
  const permanenciaCentimos = montoPorPermanencia(regla, horaEntrada, horaSalida) ?? 0;
  const pagaPor = permanenciaCentimos > pedidosCentimos ? "permanencia" : "pedidos";
  return {
    pedidosCentimos,
    permanenciaCentimos,
    pagadoCentimos: Math.max(pedidosCentimos, permanenciaCentimos),
    pagaPor,
  };
}

export function calcularLiquidacion(
  jornadas: readonly JornadaLiquidable[],
  regla: ReglaPago,
  referencia: FechaISO,
  opciones: OpcionesLiquidacion = {},
): Liquidacion {
  const semana = semanaDe(referencia);
  const hasta = opciones.hasta ?? semana.fin;

  const deLaSemana = jornadas
    .filter((j) => caeEnSemana(j.fecha, semana))
    .slice()
    .sort((a, b) => a.fecha.localeCompare(b.fecha));

  const ordenesPorTramo: Record<string, number> = {};
  const porDia: DetalleDia[] = [];
  const porRuta: DetalleRuta[] = [];
  const pedidosSinTarifa: PedidoSinTarifa[] = [];

  let totalRutas = 0;
  let totalOrdenes = 0;
  let montoCalculadoCentimos = 0;
  let montoPorPedidosCentimos = 0;
  let diasConGarantia = 0;
  let minutosEnRuta = 0;

  for (const jornada of deLaSemana) {
    let montoDia = 0;
    let minutosDia = 0;

    // Un pedido puede no tener ruta asignada (§6 lo marca como alerta, pero el
    // cálculo no debe romperse por eso): se agrupa bajo la clave null.
    const montoPorRuta = new Map<number | null, number>();
    const pedidosPorRuta = new Map<number | null, number>();

    for (const pedido of jornada.pedidos) {
      totalOrdenes += 1;
      const clave = String(pedido.tramo);
      ordenesPorTramo[clave] = (ordenesPorTramo[clave] ?? 0) + 1;

      const monto = montoDelPedido(pedido, regla);
      if (monto === null) {
        pedidosSinTarifa.push({
          fecha: jornada.fecha,
          codigo: pedido.codigo,
          tramo: pedido.tramo,
          motivo:
            pedido.tramo === TRAMO_MAS_DE_12_KM
              ? "mas-de-12-km-sin-monto"
              : "tramo-desconocido",
        });
        continue;
      }

      montoDia += monto;
      montoPorRuta.set(pedido.ruta, (montoPorRuta.get(pedido.ruta) ?? 0) + monto);
      pedidosPorRuta.set(pedido.ruta, (pedidosPorRuta.get(pedido.ruta) ?? 0) + 1);
    }

    for (const ruta of jornada.rutas) {
      totalRutas += 1;
      const duracion = ruta.duracionMin ?? 0;
      minutosDia += duracion > 0 ? duracion : 0;
      porRuta.push({
        fecha: jornada.fecha,
        numero: ruta.numero,
        pedidos: pedidosPorRuta.get(ruta.numero) ?? 0,
        duracionMin: ruta.duracionMin,
        montoCentimos: montoPorRuta.get(ruta.numero) ?? 0,
      });
    }

    /* --- garantía por permanencia (§13 bis) ---
       La tienda paga por hora de presencia y, al cerrar el día, paga el MAYOR
       de los dos: lo que sumaron los pedidos o lo que suma la permanencia. No
       se suman, compiten. Por eso un día flojo no baja del piso. */
    const dia = montoDelDia(montoDia, regla, jornada.horaEntrada ?? null, jornada.horaSalida ?? null);
    const montoPermanencia = dia.permanenciaCentimos;
    const pagaPor = dia.pagaPor;
    const montoFinal = dia.pagadoCentimos;

    montoCalculadoCentimos += montoFinal;
    montoPorPedidosCentimos += montoDia;
    if (pagaPor === "permanencia") diasConGarantia += 1;
    minutosEnRuta += minutosDia;

    porDia.push({
      fecha: jornada.fecha,
      rutas: jornada.rutas.length,
      pedidos: jornada.pedidos.length,
      minutosEnRuta: minutosDia,
      montoPedidosCentimos: montoDia,
      montoPermanenciaCentimos: montoPermanencia,
      horasPermanencia: horasDePermanencia(
        jornada.horaEntrada ?? null,
        jornada.horaSalida ?? null,
      ),
      pagaPor,
      montoCentimos: montoFinal,
    });
  }

  const cargadas = new Set(deLaSemana.map((j) => j.fecha));
  const diasSinCarga = rangoDeFechas(semana.inicio, minimo(hasta, semana.fin)).filter(
    (f) => !cargadas.has(f),
  );

  return {
    semana,
    totalRutas,
    totalOrdenes,
    ordenesPorTramo,
    montoCalculadoCentimos,
    montoPorPedidosCentimos,
    diasConGarantia,
    minutosEnRuta,
    detalle: { porDia, porRuta },
    diasSinCarga,
    pedidosSinTarifa,
  };
}

/**
 * Céntimos que paga un pedido, o `null` si no se puede tarifar.
 *
 * El estado del pedido no entra en la cuenta a propósito: `Entregado`,
 * `Entrega parcial` y `No entregado` pagan igual (§13).
 */
export function montoDelPedido(
  pedido: PedidoLiquidable,
  regla: ReglaPago,
): number | null {
  if (pedido.tramo === TRAMO_MAS_DE_12_KM) {
    return pedido.montoManualCentimos ?? null;
  }
  return pagoDelTramo(regla, pedido.tramo);
}

/** Diferencia entre lo calculado y lo que realmente pagaron (§13, conciliación). */
export function diferenciaDePago(
  montoCalculadoCentimos: number,
  montoRecibidoCentimos: number | null,
): number | null {
  if (montoRecibidoCentimos === null) return null;
  return montoRecibidoCentimos - montoCalculadoCentimos;
}

function minimo(a: FechaISO, b: FechaISO): FechaISO {
  return a.localeCompare(b) <= 0 ? a : b;
}
