/**
 * Las cuentas de Estadísticas, sin pantalla: qué días hay en un rango, cuánto
 * suman, cómo se reparten por semana y cómo se comparan dos semanas.
 *
 * Están aparte para poder probarlas. Son cifras de dinero y de trabajo, y una
 * semana que suma de más o de menos se nota tarde.
 */
import type { FilaResumenDiario } from "@/lib/db/tipos";
import { rangoDeFechas, sumarDias, type FechaISO } from "@/lib/fechas";

/** Un día de un gráfico: lo que se trabajó, o por qué no hay barra. */
export interface DiaGrafico {
  fecha: FechaISO;
  cargado: boolean;
  /** No se trabajó, dicho por el repartidor: no es lo mismo que «sin subir». */
  descanso?: boolean;
  /** Todavía no llega: no es un hueco ni una falta, solo no ha pasado. */
  futuro?: boolean;
  pedidos: number;
  rutas: number;
  minutos: number;
  centimos: number;
  fueraTramo1: number;
}

/**
 * Los días de `desde` a `hasta`, uno por uno, con lo que se cargó cada uno.
 *
 * Lo que se cobró es lo del resumen diario: el mayor entre los pedidos y el
 * piso de permanencia, con la tarifa del vehículo de **ese** día.
 */
export function diasDelRango(
  desde: FechaISO,
  hasta: FechaISO,
  filas: readonly FilaResumenDiario[],
  descansos: ReadonlySet<FechaISO>,
  hoy: FechaISO,
): DiaGrafico[] {
  const porFecha = new Map(filas.map((f) => [f.fecha, f]));
  return rangoDeFechas(desde, hasta).map((fecha) => {
    const f = porFecha.get(fecha);
    if (!f) {
      return {
        fecha,
        cargado: false,
        descanso: descansos.has(fecha),
        futuro: fecha > hoy,
        pedidos: 0,
        rutas: 0,
        minutos: 0,
        centimos: 0,
        fueraTramo1: 0,
      };
    }
    return {
      fecha,
      cargado: true,
      pedidos: f.pedidos,
      rutas: f.rutas,
      minutos: f.minutosEnRuta,
      centimos: f.montoCentimos,
      fueraTramo1: f.pedidosFueraTramo1,
    };
  });
}

export interface Totales {
  pedidos: number;
  rutas: number;
  minutos: number;
  centimos: number;
  fueraTramo1: number;
  /** Días con carga: los huecos y los descansos no cuentan. */
  diasTrabajados: number;
  /** Pedidos por día trabajado. */
  promedioPorDia: number;
  centimosPorDia: number;
  centimosPorPedido: number;
}

export function totalesDe(dias: readonly DiaGrafico[]): Totales {
  const cargados = dias.filter((d) => d.cargado);
  const suma = (f: (d: DiaGrafico) => number) => cargados.reduce((s, d) => s + f(d), 0);
  const pedidos = suma((d) => d.pedidos);
  const centimos = suma((d) => d.centimos);
  return {
    pedidos,
    rutas: suma((d) => d.rutas),
    minutos: suma((d) => d.minutos),
    centimos,
    fueraTramo1: suma((d) => d.fueraTramo1),
    diasTrabajados: cargados.length,
    promedioPorDia: cargados.length ? pedidos / cargados.length : 0,
    centimosPorDia: cargados.length ? Math.round(centimos / cargados.length) : 0,
    centimosPorPedido: pedidos ? Math.round(centimos / pedidos) : 0,
  };
}

/** Una semana (de lunes a domingo) dentro de un rango, con lo que suma. */
export interface SemanaResumen {
  lunes: FechaISO;
  /** Los días de la semana que caen en el rango: en el mes de los extremos, menos de siete. */
  desde: FechaISO;
  hasta: FechaISO;
  totales: Totales;
}

/**
 * Los días agrupados por semana, en orden. Cada grupo son los días que hay de
 * esa semana en `dias`: el primer y el último pueden ser parciales, como en un
 * mes que empieza a mitad de semana.
 */
export function semanasDe(dias: readonly DiaGrafico[], lunesDe: (f: FechaISO) => FechaISO): SemanaResumen[] {
  const grupos = new Map<FechaISO, DiaGrafico[]>();
  for (const d of dias) {
    const lunes = lunesDe(d.fecha);
    const grupo = grupos.get(lunes);
    if (grupo) grupo.push(d);
    else grupos.set(lunes, [d]);
  }
  return [...grupos.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([lunes, delGrupo]) => ({
      lunes,
      desde: delGrupo[0].fecha,
      hasta: delGrupo[delGrupo.length - 1].fecha,
      totales: totalesDe(delGrupo),
    }));
}

/** El lunes de `cuantas` semanas seguidas que terminan en la de `ultimoLunes`. */
export function lunesDeLasUltimas(ultimoLunes: FechaISO, cuantas: number): FechaISO[] {
  return Array.from({ length: cuantas }, (_, i) => sumarDias(ultimoLunes, -7 * (cuantas - 1 - i)));
}

export type UnidadDeComparacion = "entero" | "decimal" | "soles" | "minutos";

export interface FilaDeComparacion {
  clave: "pedidos" | "soles" | "dias" | "promedio" | "enRuta" | "porPedido";
  etiqueta: string;
  unidad: UnidadDeComparacion;
  /** La semana que se mira. */
  a: number;
  /** Con la que se compara. */
  b: number;
  /** a − b. */
  diferencia: number;
}

/** Las cifras de dos semanas, cara a cara, con cuánto cambió cada una. */
export function comparar(a: Totales, b: Totales): FilaDeComparacion[] {
  const fila = (
    clave: FilaDeComparacion["clave"],
    etiqueta: string,
    unidad: UnidadDeComparacion,
    va: number,
    vb: number,
  ): FilaDeComparacion => ({ clave, etiqueta, unidad, a: va, b: vb, diferencia: va - vb });

  return [
    fila("pedidos", "Pedidos", "entero", a.pedidos, b.pedidos),
    fila("soles", "Soles", "soles", a.centimos, b.centimos),
    fila("dias", "Días trabajados", "entero", a.diasTrabajados, b.diasTrabajados),
    fila("promedio", "Promedio por día", "decimal", a.promedioPorDia, b.promedioPorDia),
    fila("enRuta", "Tiempo en ruta", "minutos", a.minutos, b.minutos),
    fila("porPedido", "Por pedido", "soles", a.centimosPorPedido, b.centimosPorPedido),
  ];
}
