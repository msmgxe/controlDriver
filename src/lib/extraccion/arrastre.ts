/**
 * Lo que la app de reparto arrastra del día anterior, y cómo quitarlo.
 *
 * La lista de un día en la app de reparto **no empieza con ese día**: suele
 * abrir con una o dos rutas de la noche anterior, y recién después vienen las
 * de la mañana:
 *
 *     Ruta 1   20:21 → 20:53    ┐ de la noche del 15
 *     Ruta 2   21:24 → 21:49    ┘ ya contadas el día 15
 *     Ruta 3   10:03 → 10:27    ┐
 *     …                         │ del 16, que es lo que se carga
 *     Ruta 9   18:20 → 18:57    ┘
 *
 * Contarlas otra vez las cobraría dos veces. Así salieron 16 pedidos en un día
 * de 12. Hay dos señales para reconocerlas, y se usan las dos porque cada una
 * cubre lo que la otra no:
 *
 *   1. **La hora retrocede.** En la lista, la hora de salida va subiendo; si de
 *      una ruta a la siguiente baja —de 21:24 a 10:03—, ahí empieza el día.
 *      Funciona aunque el día anterior no se haya subido nunca.
 *
 *   2. **Un pedido no puede repetirse.** Si un código ya está guardado en otro
 *      día, es arrastre, venga de la ruta que venga. Es infalible, pero solo
 *      si el día anterior se subió.
 *
 * Todo es puro —sin base de datos— para poder probarlo a fondo: lo que viene
 * de la base se pasa como argumento.
 */
import type { FechaISO } from "@/lib/fechas";

import type { JornadaFusionada, OrdenFusionada, RutaFusionada } from "./fusionar";

/**
 * Desde qué hora una ruta cuenta como "de noche" para esta regla.
 *
 * El turno acaba a las 22:00 y las rutas arrastradas son las últimas del día
 * anterior, así que siempre son de tarde-noche. Se deja margen por abajo
 * porque una ruta de las 17:30 del día anterior sigue siendo arrastre.
 */
const DESDE_NOCHE = "17:00";

/**
 * Hasta qué hora la ruta siguiente cuenta como "el día que empieza".
 *
 * Es lo que evita el falso positivo peligroso: un día que termina pasada la
 * medianoche —22:30 y luego 00:40— también tiene la hora retrocediendo, pero
 * al final de la lista y no al principio. Exigir que tras el salto venga una
 * mañana, y que el salto esté en las primeras rutas, lo descarta.
 */
const HASTA_MANANA = "15:00";

/** Como mucho, cuántas rutas de arrastre puede haber al principio. */
const MAX_ARRASTRE = 3;

export interface Descartes {
  /** Rutas de la noche anterior, en el orden de la lista. */
  rutas: RutaFusionada[];
  /** Pedidos descartados, con el motivo de cada uno. */
  ordenes: Array<OrdenFusionada & { motivo: "ruta-anterior" | "ya-guardado"; fechaPrevia?: FechaISO }>;
}

export interface JornadaSinArrastre extends JornadaFusionada {
  descartes: Descartes;
  /**
   * Cuántos pedidos se habrían descartado si no hubiera saltado el tope de
   * seguridad. Si está, no se descartó nada y conviene revisar a mano.
   */
  descarteDudoso?: number;
}

/**
 * Las primeras rutas, si son de la noche anterior.
 *
 * Devuelve cuántas rutas de arrastre hay al principio de la lista —0 si no
 * hay—. Solo cuenta un salto hacia atrás en la hora si las rutas de antes son
 * todas de noche y la de después es de mañana.
 */
export function rutasDeArrastre(rutas: readonly RutaFusionada[]): number {
  const enLista = [...rutas].sort((a, b) => a.numero - b.numero);

  /* Solo con los números **leídos** del círculo. Un número deducido sale del
     orden en que se procesaron las capturas, y si ese orden falló, la regla
     tomaría por arrastre una ruta de la tarde del mismo día. La otra señal
     —el código ya guardado— sigue funcionando aunque esta calle. */
  if (enLista.slice(0, MAX_ARRASTRE + 1).some((r) => r.numero_deducido)) return 0;

  for (let k = 1; k <= Math.min(MAX_ARRASTRE, enLista.length - 1); k++) {
    const antes = enLista[k - 1].hora_inicio;
    const despues = enLista[k].hora_inicio;
    if (!antes || !despues) return 0;
    if (despues >= antes) continue;

    // La hora retrocede entre la ruta k y la k+1. ¿Es el cambio de día?
    const previas = enLista.slice(0, k);
    const todasDeNoche = previas.every((r) => (r.hora_inicio ?? "") >= DESDE_NOCHE);
    const empiezaDeManana = despues < HASTA_MANANA;
    return todasDeNoche && empiezaDeManana ? k : 0;
  }
  return 0;
}

/**
 * Quita del día lo que es arrastre del anterior.
 *
 * Los pedidos se descartan si su ruta es de arrastre o si su código ya está
 * guardado en otra fecha. Un pedido sin ruta leída que va, en la lista, antes
 * de uno de arrastre, también lo es: la lista va ordenada por ruta, así que
 * todo lo que va por encima de la Ruta 2 es de la 1 o de la 2.
 *
 * Lo descartado no se pierde: se devuelve aparte para que Revisión lo enseñe y
 * se sepa exactamente qué se quitó y por qué.
 */
export function quitarArrastre(
  jornada: JornadaFusionada,
  codigosEnOtrasFechas: Readonly<Record<string, FechaISO>> = {},
): JornadaSinArrastre {
  const cuantas = rutasDeArrastre(jornada.rutas);
  const enLista = [...jornada.rutas].sort((a, b) => a.numero - b.numero);
  const rutasDescartadas = enLista.slice(0, cuantas);
  const numerosDescartados = new Set(rutasDescartadas.map((r) => r.numero));

  const ordenes = [...jornada.ordenes].sort((a, b) => a.posicion - b.posicion);
  const esDeArrastre = (ruta: number | null) => ruta !== null && numerosDescartados.has(ruta);

  /* Un pedido sin ruta leída solo se da por arrastre si está **encajado en el
     bloque de arriba**: el primer pedido con ruta que tiene debajo es de
     arrastre, y el que tiene encima también lo es —o no hay ninguno—.

     La versión anterior descartaba todo pedido sin ruta que estuviera antes
     del último pedido de arrastre de la lista. Bastaba con que uno de más
     abajo se leyera mal como "Ruta 1" para arrastrar al descarte a todos los
     sin ruta de encima: un día de 14 pedidos se quedó en 2. */
  const encajadoArriba = (i: number): boolean => {
    let arriba: number | null | undefined;
    for (let j = i - 1; j >= 0 && arriba === undefined; j--) {
      if (ordenes[j].ruta !== null) arriba = ordenes[j].ruta;
    }
    let abajo: number | null | undefined;
    for (let k = i + 1; k < ordenes.length && abajo === undefined; k++) {
      if (ordenes[k].ruta !== null) abajo = ordenes[k].ruta;
    }
    return esDeArrastre(abajo ?? null) && (arriba === undefined || esDeArrastre(arriba));
  };

  const quedan: OrdenFusionada[] = [];
  const descartados: Descartes["ordenes"] = [];

  ordenes.forEach((o, i) => {
    const deRutaAnterior = esDeArrastre(o.ruta) || (o.ruta === null && encajadoArriba(i));

    /* "Ya guardado" solo cuenta si ese otro día es **anterior**: el arrastre
       viene siempre de la noche de antes. Si el código está guardado en un día
       posterior, el que está mal es ese otro día —le entraron pedidos de
       este—, y descartarlo aquí perdería un pedido bueno. */
    const fechaPrevia = codigosEnOtrasFechas[o.codigo];
    const guardadoAntes = Boolean(fechaPrevia && jornada.fecha && fechaPrevia < jornada.fecha);

    if (deRutaAnterior) descartados.push({ ...o, motivo: "ruta-anterior" });
    else if (guardadoAntes) descartados.push({ ...o, motivo: "ya-guardado", fechaPrevia });
    else quedan.push(o);
  });

  /* Tope de seguridad. El arrastre son una o dos rutas: un puñado de pedidos.
     Si el descarte fuera a quitar más de la mitad del día, lo más probable es
     que la lectura saliera mal, no que el día sea casi todo del anterior. En
     ese caso no se descarta nada y se deja que la persona decida. */
  if (descartados.length > 0 && descartados.length * 2 > ordenes.length) {
    return {
      ...jornada,
      descartes: { rutas: [], ordenes: [] },
      descarteDudoso: descartados.length,
    };
  }

  return {
    ...jornada,
    rutas: jornada.rutas.filter((r) => !numerosDescartados.has(r.numero)),
    // Las posiciones se renumeran para que el primer pedido del día sea el 1.
    ordenes: quedan.map((o, i) => ({ ...o, posicion: i + 1 })),
    descartes: { rutas: rutasDescartadas, ordenes: descartados },
  };
}
