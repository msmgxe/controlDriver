import { z } from "zod";

/**
 * Reglas de pago (§13).
 *
 * El pago es **por pedido**, según la distancia del pedido, no por ruta. Una
 * ruta puede llevar pedidos de tramos distintos. Todos los pedidos se pagan,
 * sea cual sea su estado: el driver hizo el recorrido aunque el pedido se
 * devuelva.
 *
 * Los montos se manejan en **céntimos enteros** en todo el cálculo. Los soles
 * con decimales solo aparecen al formatear para la pantalla o al escribir en
 * una columna `numeric` de Postgres. Nada de sumar coma flotante.
 */

export const esquemaTramo = z.object({
  id: z.number().int().min(1).max(6),
  desde: z.number().min(0),
  hasta: z.number().min(0),
  monto: z.number().min(0),
});

export const esquemaReglaPago = z.object({
  moneda: z.literal("PEN"),
  base: z.literal("por_pedido"),
  tramos: z.array(esquemaTramo).min(1),
});

export type Tramo = z.infer<typeof esquemaTramo>;
export type ReglaPago = z.infer<typeof esquemaReglaPago>;

/**
 * Tarifa vigente al escribir esto. Vive también en `reglas_pago` con
 * `vigente_desde`, versionada: para cambiarla se inserta una fila nueva, nunca
 * se edita la anterior, para no alterar semanas ya liquidadas.
 */
export const REGLA_INICIAL: ReglaPago = {
  moneda: "PEN",
  base: "por_pedido",
  tramos: [
    { id: 1, desde: 0, hasta: 3, monto: 10.0 },
    { id: 2, desde: 3, hasta: 8, monto: 11.5 },
    { id: 3, desde: 8, hasta: 10, monto: 13.0 },
    { id: 4, desde: 10, hasta: 11, monto: 14.5 },
    { id: 5, desde: 11, hasta: 12, monto: 16.0 },
  ],
};

/**
 * Tramo abierto de §17.2: la tabla no cubre los pedidos de más de 12 km. Hasta
 * que la tienda lo confirme, se marcan con este tramo y monto manual, y la
 * liquidación los señala aparte.
 */
export const TRAMO_MAS_DE_12_KM = 6;

/* ---------------------------------------------------------------------------
 * Céntimos
 * ------------------------------------------------------------------------- */

/** Soles con decimales → céntimos enteros. */
export function aCentimos(soles: number): number {
  return Math.round(soles * 100);
}

/** Céntimos enteros → soles, listo para una columna numeric(10,2). */
export function aSoles(centimos: number): number {
  return centimos / 100;
}

/** "S/ 141.50" */
export function formatearSoles(centimos: number): string {
  const signo = centimos < 0 ? "−" : "";
  const abs = Math.abs(centimos);
  return `${signo}S/ ${Math.floor(abs / 100)}.${String(abs % 100).padStart(2, "0")}`;
}

/* ---------------------------------------------------------------------------
 * Tramos
 * ------------------------------------------------------------------------- */

/** Lo que cuesta un pedido de ese tramo, en céntimos. */
export function pagoDelTramo(regla: ReglaPago, tramo: number): number | null {
  const t = regla.tramos.find((x) => x.id === tramo);
  return t ? aCentimos(t.monto) : null;
}

/**
 * Tramo al que pertenecen unos kilómetros.
 *
 * Supuesto de §13 pendiente de confirmar (§17.2): el valor exacto del límite
 * pertenece al tramo inferior — 3.0 km paga S/ 10.00 y 3.1 km paga S/ 11.50.
 * Implementado como `km <= hasta`.
 *
 * Devuelve `TRAMO_MAS_DE_12_KM` si se pasa de la tabla.
 */
export function tramoDeKm(regla: ReglaPago, km: number): number {
  const ordenados = [...regla.tramos].sort((a, b) => a.hasta - b.hasta);
  const t = ordenados.find((x) => km <= x.hasta);
  return t ? t.id : TRAMO_MAS_DE_12_KM;
}
