/**
 * De la distancia al tramo, según cómo mida cada tienda.
 *
 * Hay tiendas que miden sus tramos **en línea recta** y otras **por la ruta**
 * que genera Waze o Maps. De eso depende en qué tramo cae un pedido, así que
 * cada tienda elige (Ajustes › Tienda › Distancia) y esto lo aplica.
 *
 * Por calles hace falta pedirle la ruta a un servicio, y eso necesita internet.
 * Sin señal —o si el servicio no contesta— se estima con la línea recta por un
 * factor, y el resultado queda marcado como `estimado`: la persona sabe que no
 * es la ruta de verdad y puede corregirla escribiendo los kilómetros que dice
 * su Waze o su Maps.
 */
import type { FuenteDeKm, MetodoDeDistancia } from "@/lib/db/tipos";
import { TRAMO_MAS_DE_12_KM, pagoDelTramo, tramoDeKm, type ReglaPago } from "@/lib/pagos/reglas";

import { kmEnLinea, type Punto } from "./distancia";

export interface OrigenDeMedida {
  punto: Punto;
  metodo: MetodoDeDistancia;
  factorCalles: number;
}

export interface Distancia {
  km: number;
  /** De dónde salió: la línea recta, la ruta, un estimado, o lo que escribió la persona. */
  fuente: FuenteDeKm;
  /** La línea recta, siempre, para enseñarla junto a la otra. */
  enLinea: number;
}

/** Una décima de kilómetro, que es lo que enseñan Waze y Maps. */
export const aDecimas = (km: number): number => Math.round(km * 10) / 10;

/**
 * La distancia de la tienda a un cliente.
 *
 * `pedirRuta` es lo que sabe pedir la ruta por calles; se pasa desde fuera para
 * que esto funcione —y se pruebe— sin red. Devuelve los km de la ruta, o null
 * si no pudo.
 */
export async function distanciaAlCliente(
  tienda: OrigenDeMedida,
  cliente: Punto,
  pedirRuta?: (desde: Punto, hasta: Punto) => Promise<number | null>,
): Promise<Distancia> {
  const enLinea = kmEnLinea(tienda.punto, cliente);

  if (tienda.metodo === "recta") {
    return { km: aDecimas(enLinea), fuente: "recta", enLinea: aDecimas(enLinea) };
  }

  const ruta = pedirRuta ? await pedirRuta(tienda.punto, cliente).catch(() => null) : null;
  if (ruta !== null && ruta >= 0) {
    return { km: aDecimas(ruta), fuente: "ruta", enLinea: aDecimas(enLinea) };
  }
  return { km: aDecimas(enLinea * tienda.factorCalles), fuente: "estimado", enLinea: aDecimas(enLinea) };
}

export interface TramoCalculado {
  tramo: number;
  /** null solo en el tramo de más de 12 km: ahí el monto lo escribe la persona. */
  montoCentimos: number | null;
}

/**
 * En qué tramo cae una distancia con esta tarifa.
 *
 * La distancia se redondea a la décima antes de decidir: quien ve «3.0 km» en
 * su pantalla espera el tramo 1, no el 2 por una milésima.
 */
export function tramoPorDistancia(regla: ReglaPago, km: number): TramoCalculado {
  const tramo = tramoDeKm(regla, aDecimas(km));
  return { tramo, montoCentimos: tramo === TRAMO_MAS_DE_12_KM ? null : pagoDelTramo(regla, tramo) };
}
