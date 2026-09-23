/**
 * El orden de lectura a partir de las posiciones, en los casos que el texto
 * solo no puede resolver: lo que asoma cortado por los bordes de la captura.
 *
 * Las pantallas se dibujan a mano con las mismas medidas de las capturas
 * reales —una tarjeta cada 150 px, el código a la izquierda y «Ruta N» a la
 * derecha en la misma fila, el estado 40 px más abajo—.
 */
import { describe, expect, it } from "vitest";

import { lineasEnOrdenDeLectura, type LineaConCaja } from "./geometria";
import { interpretarCaptura } from "./ocr";

const t = (texto: string, x: number, y: number, w = 100, h = 20): LineaConCaja => ({ texto, x, y, w, h });

/** El resumen y las pestañas, tal como salen arriba en todas las capturas. */
const CABECERA: LineaConCaja[] = [
  t("Resumen del 20/09/2026", 30, 84, 278, 24),
  t("Rutas", 98, 170, 58),
  t("11", 172, 168, 30),
  t("Órdenes", 392, 166, 80, 24),
  t("21", 492, 168, 26),
  t("Entregado", 54, 268, 84),
  t("Entrega parcial", 236, 268, 124),
  t("No entregado", 420, 268, 110),
  t("21", 90, 306, 24, 18),
  t("0", 274, 306, 12, 18),
  t("0", 458, 306, 12, 18),
];

/** Una tarjeta: código y ruta en una fila, y el estado debajo. */
function tarjeta(y: number, codigo: string, ruta: number, estado: string | null): LineaConCaja[] {
  return [
    t(codigo, 66, y, 184, 22),
    t(`Ruta ${ruta}`, 460, y + 2, 54, 18),
    ...(estado ? [t(estado, 70, y + 41, 132, 26)] : []),
  ];
}

const leer = (trozos: LineaConCaja[]) => interpretarCaptura(lineasEnOrdenDeLectura(trozos));

describe("lo que asoma por los bordes", () => {
  it("el rabo de la tarjeta anterior, arriba, no desplaza los estados", () => {
    // Al hacer scroll, lo primero que se ve bajo el resumen puede ser el pie de
    // una tarjeta cuyo código quedó fuera: un «Entregado» huérfano. Si se
    // tomara por el estado del primer pedido, todos se correrían un puesto.
    const leido = leer([
      ...CABECERA,
      t("Entregado", 70, 380, 132, 26), // ← el rabo
      ...tarjeta(424, "v11111111wofp-01", 4, "No entregado"),
      ...tarjeta(574, "v22222222wofp-01", 4, "Entregado"),
      ...tarjeta(724, "v33333333wofp-01", 5, "Entrega parcial"),
    ]);

    expect(leido.ordenes.map((o) => [o.codigo, o.ruta, o.estado])).toEqual([
      ["v11111111wofp-01", 4, "No entregado"],
      ["v22222222wofp-01", 4, "Entregado"],
      ["v33333333wofp-01", 5, "Entrega parcial"],
    ]);
  });

  it("la etiqueta de ruta de una tarjeta cortada abajo no se la queda el pedido de arriba", () => {
    const leido = leer([
      ...CABECERA,
      ...tarjeta(424, "v11111111wofp-01", 4, "Entregado"),
      ...tarjeta(574, "v22222222wofp-01", 5, "Entregado"),
      t("Ruta 6", 460, 726, 54, 10), // ← asoma «Ruta 6» sin su código
    ]);

    expect(leido.ordenes.map((o) => o.ruta)).toEqual([4, 5]);
  });

  it("la última tarjeta, sin su estado, se conserva y queda marcada", () => {
    const leido = leer([
      ...CABECERA,
      ...tarjeta(424, "v11111111wofp-01", 4, "Entregado"),
      ...tarjeta(574, "v22222222wofp-01", 5, null),
    ]);

    expect(leido.ordenes).toHaveLength(2);
    expect(leido.ordenes[1]).toMatchObject({ codigo: "v22222222wofp-01", ruta: 5, legible_completo: false });
    expect(leido.ordenes[0].legible_completo).toBe(true);
  });

  it("el estado de la tarjeta cortada abajo no se lo queda el pedido de arriba", () => {
    // La primera tarjeta no tiene su estado a la vista; el «No entregado» de
    // debajo es de la tarjeta siguiente, y está muy lejos para ser suyo.
    const leido = leer([
      ...CABECERA,
      t("v11111111wofp-01", 66, 424, 184, 22),
      t("Ruta 4", 460, 426, 54, 18),
      ...tarjeta(574, "v22222222wofp-01", 5, "No entregado"),
    ]);

    expect(leido.ordenes.map((o) => [o.codigo, o.estado])).toEqual([
      ["v11111111wofp-01", "Entregado"], // el de por defecto…
      ["v22222222wofp-01", "No entregado"],
    ]);
    // …y por eso mismo, marcada como no leída del todo.
    expect(leido.ordenes[0].legible_completo).toBe(false);
  });
});

describe("las pantallas sin pedidos y las agrupadas", () => {
  it("la pantalla de Rutas solo se ordena", () => {
    const lineas = lineasEnOrdenDeLectura([
      t("De: 21:17 a 21:54 horas", 62, 500, 222),
      t("De: 19:31 a 20:01 horas", 62, 346, 222),
      t("Ruta • Finalizado", 100, 292, 170, 18),
      t("2", 72, 446, 16, 18),
      t("Ruta • Finalizado", 100, 446, 170, 18),
    ]);

    expect(lineas).toEqual([
      "Ruta • Finalizado",
      "De: 19:31 a 20:01 horas",
      "2 Ruta • Finalizado", // el círculo y la palabra, una sola frase
      "De: 21:17 a 21:54 horas",
    ]);
  });

  it("los contadores de las pestañas quedan cada uno con su palabra", () => {
    const lineas = lineasEnOrdenDeLectura(CABECERA);
    expect(lineas).toContain("Rutas 11");
    expect(lineas).toContain("Órdenes 21");
  });

  it("la cabecera de una ruta, sola sobre sus pedidos, se conserva", () => {
    const leido = leer([
      t("Ruta 4", 66, 380, 60),
      t("v11111111wofp-01", 66, 424, 184, 22),
      t("Entregado", 70, 465, 132, 26),
      t("v22222222wofp-01", 66, 574, 184, 22),
      t("Entregado", 70, 615, 132, 26),
    ]);

    expect(leido.ordenes.map((o) => o.ruta)).toEqual([4, 4]);
  });
});
