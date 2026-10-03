/**
 * Cálculo de los ingresos del día que no son pedidos de la tienda principal:
 * apoyo a otra tienda y taxi libre (§ plan de apoyo/taxi).
 *
 * Puro, sin base de datos —igual que `reglas.ts`—, para que la cuenta se
 * pueda probar sin SQLite de por medio.
 */
import type { TipoBloqueExtra } from "@/lib/db/tipos";

export type CategoriaIngreso = "tienda" | "apoyo" | "taxi";

/** A qué categoría pertenece un bloque, para sumar y mostrar por grupo. */
export function categoriaDe(tipo: TipoBloqueExtra): CategoriaIngreso {
  return tipo === "taxi" ? "taxi" : "apoyo";
}

/**
 * Lo que se cobra un apoyo por hora: tarifa × horas, redondeado al céntimo.
 *
 * Sin el truncado hacia abajo de `horasDePermanencia`: ese truncado es la
 * política de garantía de UNA tienda —se perdona al driver el minuto de
 * más—, no aplica a una tarifa que el driver se pone a sí mismo.
 */
export function montoApoyoHora(tarifaHoraCentimos: number, horas: number): number {
  return Math.round(tarifaHoraCentimos * horas);
}

/** Lo que se cobra un apoyo por tramos: la suma de sus pedidos, ya tarifados. */
export function montoApoyoTramos(pedidos: readonly { montoCentimos: number }[]): number {
  return pedidos.reduce((total, p) => total + p.montoCentimos, 0);
}
