/**
 * La distancia de un viaje de taxi libre.
 *
 * Mismo cálculo que `distanciaAlCliente` (tramo.ts) —línea recta por un
 * factor de calles, o la ruta real cuando hay señal para pedirla— pero sin el
 * caso `'recta'`: un viaje de taxi urbano nunca se mide en línea recta como sí
 * puede medirse, por elección de la tienda, un reparto a pie de puerta.
 */
import type { FuenteDeKm } from "@/lib/db/tipos";

import { kmEnLinea, type Punto } from "./distancia";
import { aDecimas } from "./tramo";

export interface DistanciaTaxi {
  km: number;
  /** 'ruta' si se pudo pedir, 'estimado' si no —nunca 'recta' ni 'manual' aquí. */
  fuente: FuenteDeKm;
  /** La línea recta, siempre, para enseñarla junto a la otra. */
  enLinea: number;
}

/**
 * `pedirRuta` es lo que sabe pedir la ruta por calles; se pasa desde fuera
 * para que esto funcione —y se pruebe— sin red. Devuelve los km de la ruta, o
 * null si no pudo.
 */
export async function distanciaDeTaxi(
  origen: Punto,
  destino: Punto,
  factorCalles: number,
  pedirRuta?: (desde: Punto, hasta: Punto) => Promise<number | null>,
): Promise<DistanciaTaxi> {
  const enLinea = kmEnLinea(origen, destino);

  const ruta = pedirRuta ? await pedirRuta(origen, destino).catch(() => null) : null;
  if (ruta !== null && ruta >= 0) {
    return { km: aDecimas(ruta), fuente: "ruta", enLinea: aDecimas(enLinea) };
  }
  return { km: aDecimas(enLinea * factorCalles), fuente: "estimado", enLinea: aDecimas(enLinea) };
}
