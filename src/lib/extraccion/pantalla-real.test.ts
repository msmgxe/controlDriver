/**
 * La pantalla real de la app de reparto, tal como se ve en las capturas.
 *
 * Hasta la v8 el intérprete se escribió a partir de la descripción de la
 * especificación, y la pantalla real resultó distinta en detalles que lo
 * rompían todo. Estas pruebas parten de capturas de verdad:
 *
 *   ┌─────────────────────────────────────┐
 *   │ Resumen del 16/09/2026              │  ← fija: sale en todas
 *   │   Rutas (7)        Órdenes (14)     │  ← contadores en un círculo
 *   │ ┌Entregado┐┌Entrega parcial┐┌No en…┐│
 *   │ │ ✓ 14    ││ ⚠ 0           ││ ! 0  ││  ← icono delante del número
 *   │ v12238726wofp-01          [Ruta 1]  │  ← la ruta, en la misma fila
 *   │ (✓ Entregado)                       │
 *   └─────────────────────────────────────┘
 *
 *   Pantalla de rutas:   (1) Ruta · Finalizado
 *                        De: 10:03 a 10:27 horas
 *
 * El lector de texto no devuelve coordenadas, solo líneas en orden de lectura,
 * y ese orden varía con el teléfono. Cada bloque de pruebas es una forma
 * plausible en que el lector puede devolver la misma pantalla.
 */
import { describe, expect, it } from "vitest";

import { fusionarCapturas } from "./fusionar";
import { interpretarCaptura, interpretarConContexto, type ContextoEntreCapturas } from "./ocr";

const SEIS_PEDIDOS: Array<[string, number]> = [
  ["v12238726wofp-01", 1],
  ["v12238812wofp-01", 1],
  ["v12239232wofp-01", 2],
  ["v12239089wofp-01", 2],
  ["v12239528wofp-01", 3],
  ["v12239312wofp-01", 3],
];

function comprobarPedidos(lineas: string[]) {
  const leido = interpretarCaptura(lineas);
  expect(leido.ordenes.map((o) => [o.codigo, o.ruta])).toEqual(SEIS_PEDIDOS);
  expect(leido.ordenes.every((o) => o.estado === "Entregado")).toBe(true);
  return leido;
}

describe("pantalla de Órdenes, tal como es", () => {
  it("cada cosa en su línea", () => {
    const leido = comprobarPedidos([
      "Resumen del 16/09/2026",
      "Rutas", "7", "Órdenes", "14",
      "Entregado", "14", "Entrega parcial", "0", "No entregado", "0",
      ...SEIS_PEDIDOS.flatMap(([c, r]) => [c, `Ruta ${r}`, "Entregado"]),
    ]);
    expect(leido.fecha).toBe("2026-09-16");
    expect(leido.contador_rutas).toBe(7);
    expect(leido.contador_ordenes).toBe(14);
    expect(leido.resumen_ordenes).toEqual({ entregado: 14, parcial: 0, no_entregado: 0 });
  });

  it("el código y su ruta en la misma línea", () => {
    comprobarPedidos([
      "Resumen del 16/09/2026", "Rutas 7", "Órdenes 14",
      "Entregado", "14", "Entrega parcial", "0", "No entregado", "0",
      ...SEIS_PEDIDOS.flatMap(([c, r]) => [`${c} Ruta ${r}`, "Entregado"]),
    ]);
  });

  it("la etiqueta de ruta antes que el código", () => {
    comprobarPedidos([
      "Resumen del 16/09/2026", "Rutas 7", "Órdenes 14",
      "Entregado", "14", "Entrega parcial", "0", "No entregado", "0",
      ...SEIS_PEDIDOS.flatMap(([c, r]) => [`Ruta ${r}`, c, "Entregado"]),
    ]);
  });

  it("los contadores del círculo entre paréntesis", () => {
    const leido = interpretarCaptura(["Resumen del 16/09/2026", "Rutas (7)", "Órdenes (14)"]);
    expect(leido.contador_rutas).toBe(7);
    expect(leido.contador_ordenes).toBe(14);
  });

  it("el resumen con los iconos leídos como letras", () => {
    // El ✓ verde, el ⚠ amarillo y el ! rojo: el lector los convierte en lo
    // que le parece más cercano, y a menudo es una letra.
    const leido = interpretarCaptura([
      "Resumen del 16/09/2026", "Rutas 7", "Órdenes 14",
      "Entregado", "O 14", "Entrega parcial", "A 0", "No entregado", "① 0",
      "v12238726wofp-01", "Ruta 1", "Entregado",
    ]);
    expect(leido.resumen_ordenes).toEqual({ entregado: 14, parcial: 0, no_entregado: 0 });
  });

  it("el resumen leído por filas: las tres etiquetas y luego los tres números", () => {
    const leido = interpretarCaptura([
      "Resumen del 16/09/2026", "Rutas 7", "Órdenes 14",
      "Entregado Entrega parcial No entregado",
      "14 0 0",
      "v12238726wofp-01", "Ruta 1", "Entregado",
    ]);
    expect(leido.resumen_ordenes).toEqual({ entregado: 14, parcial: 0, no_entregado: 0 });
  });

  it("el 14 del contador no se toma por el número de una ruta", () => {
    const leido = interpretarCaptura([
      "Resumen del 16/09/2026", "Rutas", "7", "Órdenes", "14",
      "1", "Ruta", "Finalizado", "De: 10:03 a 10:27 horas",
    ]);
    expect(leido.rutas.map((r) => r.numero)).toEqual([1]);
  });

  it("un pedido solo en su ruta —raro, pero pasa— se lee igual", () => {
    const leido = interpretarCaptura([
      "Resumen del 16/09/2026", "Rutas 3", "Órdenes 4",
      "v11111111wofp-01", "Ruta 1", "Entregado",
      "v22222222wofp-01", "Ruta 2", "Entregado",
      "v33333333wofp-01", "Ruta 3", "Entregado",
      "v44444444wofp-01", "Ruta 3", "Entregado",
    ]);
    expect(leido.ordenes.map((o) => o.ruta)).toEqual([1, 2, 3, 3]);
  });
});

describe("pantalla de Rutas, tal como es", () => {
  it("círculo, palabra «Ruta» y estado en líneas separadas", () => {
    const leido = interpretarCaptura([
      "Resumen del 16/09/2026", "Rutas", "7", "Órdenes", "14",
      "1", "Ruta", "Finalizado", "De: 10:03 a 10:27 horas",
      "2", "Ruta", "Finalizado", "De: 11:04 a 11:22 horas",
    ]);
    expect(leido.rutas.map((r) => [r.numero, r.hora_inicio])).toEqual([
      [1, "10:03"],
      [2, "11:04"],
    ]);
  });

  it("todo en una línea: «1 Ruta • Finalizado»", () => {
    const leido = interpretarCaptura([
      "Resumen del 16/09/2026", "Rutas 7", "Órdenes 14",
      "1 Ruta • Finalizado", "De: 10:03 a 10:27 horas",
      "2 Ruta • Finalizado", "De: 11:04 a 11:22 horas",
    ]);
    expect(leido.rutas.map((r) => [r.numero, r.numero_deducido])).toEqual([
      [1, false],
      [2, false],
    ]);
  });

  it("sin el número del círculo, se deduce", () => {
    const leido = interpretarCaptura([
      "Resumen del 16/09/2026", "Rutas 7", "Órdenes 14",
      "Ruta • Finalizado", "De: 10:03 a 10:27 horas",
    ]);
    expect(leido.rutas).toHaveLength(1);
    expect(leido.rutas[0].numero_deducido).toBe(true);
  });
});

describe("un día completo con la pantalla real", () => {
  const CAB = ["Resumen del 16/09/2026", "Rutas", "7", "Órdenes", "14"];
  const RES = ["Entregado", "14", "Entrega parcial", "0", "No entregado", "0"];
  const pedido = (c: string, r: number) => [c, `Ruta ${r}`, "Entregado"];

  const capturas = [
    [...CAB,
      "1", "Ruta", "Finalizado", "De: 10:03 a 10:27 horas",
      "2", "Ruta", "Finalizado", "De: 11:04 a 11:22 horas",
      "3", "Ruta", "Finalizado", "De: 12:09 a 12:24 horas",
      "4", "Ruta", "Finalizado", "De: 13:20 a 14:00 horas",
      "5", "Ruta", "Finalizado", "De: 15:12 a 15:42 horas"],
    [...CAB,
      "3", "Ruta", "Finalizado", "De: 12:09 a 12:24 horas",
      "4", "Ruta", "Finalizado", "De: 13:20 a 14:00 horas",
      "5", "Ruta", "Finalizado", "De: 15:12 a 15:42 horas",
      "6", "Ruta", "Finalizado", "De: 16:52 a 17:10 horas",
      "7", "Ruta", "Finalizado", "De: 18:20 a 18:57 horas"],
    [...CAB, ...RES,
      ...pedido("v12238726wofp-01", 1), ...pedido("v12238812wofp-01", 1),
      ...pedido("v12239232wofp-01", 2), ...pedido("v12239089wofp-01", 2),
      ...pedido("v12239528wofp-01", 3), ...pedido("v12239312wofp-01", 3)],
    [...CAB, ...RES,
      ...pedido("v12239312wofp-01", 3),
      ...pedido("v12239582wofp-01", 4), ...pedido("v12239681wofp-01", 4),
      ...pedido("v12240224wofp-01", 5), ...pedido("v12237397wofp-01", 5),
      // Por el scroll, este pedido asoma al final de esta captura...
      ...pedido("v12240699wofp-01", 6)],
    [...CAB, ...RES,
      ...pedido("v12237397wofp-01", 5),
      // ...y en la siguiente al lector se le escapa su etiqueta.
      "v12240699wofp-01", "Entregado",
      ...pedido("v12240588wofp-01", 6),
      ...pedido("v12240721wofp-01", 7), ...pedido("v12240765wofp-01", 7)],
  ];

  let contexto: ContextoEntreCapturas | undefined;
  const dia = fusionarCapturas(
    capturas.map((c) => {
      const r = interpretarConContexto(c, contexto);
      contexto = r.contexto;
      return r.imagen;
    }),
  );

  it("7 rutas y 14 pedidos", () => {
    expect(dia.rutas).toHaveLength(7);
    expect(dia.ordenes).toHaveLength(14);
  });

  it("2 pedidos en cada ruta", () => {
    const porRuta = new Map<number | null, number>();
    for (const o of dia.ordenes) porRuta.set(o.ruta, (porRuta.get(o.ruta) ?? 0) + 1);
    expect([...porRuta.entries()].sort()).toEqual([
      [1, 2], [2, 2], [3, 2], [4, 2], [5, 2], [6, 2], [7, 2],
    ]);
  });

  it("una etiqueta que se escapa en una captura se recupera de la otra", () => {
    // El rescate de verdad: las capturas se solapan, y el mismo pedido se lee
    // dos veces. Basta con que una de las dos vea la etiqueta.
    expect(dia.ordenes.find((o) => o.codigo === "v12240699wofp-01")!.ruta).toBe(6);
  });

  it("todos entregados", () => {
    expect(dia.ordenes.every((o) => o.estado === "Entregado")).toBe(true);
  });
});

describe("deducir la ruta de un pedido por sus vecinos", () => {
  const CAB = ["Resumen del 16/09/2026", "Rutas 2", "Órdenes 5"];

  it("entre dos pedidos de la misma ruta, es de esa ruta", () => {
    const dia = fusionarCapturas([
      interpretarCaptura([
        ...CAB,
        "v11111111wofp-01", "Ruta 1", "Entregado",
        "v11111112wofp-01", "Entregado",
        "v11111113wofp-01", "Ruta 1", "Entregado",
      ]),
    ]);
    expect(dia.ordenes.map((o) => o.ruta)).toEqual([1, 1, 1]);
  });

  it("en la frontera entre dos rutas no se adivina: queda sin ruta", () => {
    // Podría ser de la 1 o de la 2. Mejor que se vea y se corrija a mano que
    // guardar una ruta inventada.
    const dia = fusionarCapturas([
      interpretarCaptura([
        ...CAB,
        "v11111111wofp-01", "Ruta 1", "Entregado",
        "v11111112wofp-01", "Entregado",
        "v22222221wofp-01", "Ruta 2", "Entregado",
      ]),
    ]);
    expect(dia.ordenes[1].ruta).toBeNull();
  });
});
