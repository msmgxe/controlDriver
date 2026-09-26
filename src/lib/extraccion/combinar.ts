import { esCodigoPendiente } from "@/lib/db/sqlite/jornadas";
import type { JornadaCompleta } from "@/lib/db/tipos";

import type { ImagenExtraida } from "./esquema";

/**
 * Sumar lo que se lee a lo que ya está guardado de ese día.
 *
 * Subir capturas de un día que **ya tiene datos** no es empezar de cero: es
 * completarlo. Puede ser una captura mejor de un pedido que no se leyó, o la
 * parte de la lista que faltaba. Tratarlo como un día nuevo borraba lo que ya
 * se había guardado y dejaba solo lo de la última captura.
 *
 * La forma de sumarlo es la misma que ya resuelve las capturas que se solapan:
 * lo guardado entra como **una captura más, la primera**, y la fusión la
 * combina con las nuevas. Y en esa fusión, gana lo que ya estaba —«cambiar de
 * opinión sobre un dato ya leído sería inventar»— y lo nuevo solo llena los
 * huecos: una ruta que faltaba, un pedido que no estaba.
 *
 * Los pedidos anotados **solo por cantidad** no entran: todavía no tienen su
 * código, y son justo los que las capturas vienen a reemplazar. Dejarlos
 * contaría dos veces cada pedido.
 */
export function capturaDeLoGuardado(guardada: JornadaCompleta): ImagenExtraida {
  return {
    tipo_pantalla: "ordenes",
    fecha: guardada.fecha,
    contador_rutas: guardada.rutasDeclaradas,
    contador_ordenes: guardada.ordenesDeclaradas,
    resumen_ordenes: null,
    rutas: guardada.rutas.map((r) => ({
      numero: r.numero,
      estado: r.estado,
      hora_inicio: r.horaInicio,
      hora_fin: r.horaFin,
      legible_completo: true,
      numero_deducido: false,
    })),
    ordenes: [...guardada.ordenes]
      .filter((o) => !esCodigoPendiente(o.codigo))
      .sort((a, b) => a.posicion - b.posicion)
      .map((o) => ({
        codigo: o.codigo,
        ruta: o.ruta,
        estado: o.estado,
        legible_completo: true,
      })),
  };
}

/** Qué había y qué añade la carga, para decírselo a la persona en Revisión. */
export interface LoCombinado {
  /** Lo que ya había guardado ese día. */
  pedidos: number;
  rutas: number;
  /** Lo que esta carga añade a eso. */
  pedidosNuevos: number;
  rutasNuevas: number;
  /** Pedidos anotados solo por cantidad, que los leídos reemplazan. */
  porCantidad: number;
}

export function loCombinado(
  guardada: JornadaCompleta,
  resultado: { ordenes: ReadonlyArray<{ codigo: string }>; rutas: ReadonlyArray<{ numero: number }> },
): LoCombinado {
  const codigos = new Set(guardada.ordenes.map((o) => o.codigo));
  const numeros = new Set(guardada.rutas.map((r) => r.numero));
  return {
    pedidos: guardada.ordenes.length,
    rutas: guardada.rutas.length,
    pedidosNuevos: resultado.ordenes.filter((o) => !codigos.has(o.codigo)).length,
    rutasNuevas: resultado.rutas.filter((r) => !numeros.has(r.numero)).length,
    porCantidad: guardada.ordenes.filter((o) => esCodigoPendiente(o.codigo)).length,
  };
}
