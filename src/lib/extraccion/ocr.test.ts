/**
 * Pruebas del intérprete de capturas.
 *
 * Las entradas imitan lo que devuelve el lector de texto del teléfono: líneas
 * sueltas en orden de lectura, a veces con las confusiones típicas (la O por
 * el cero) y a veces con tarjetas cortadas por el scroll.
 *
 * El caso de referencia es el de §16 —16/09/2026, 7 rutas, 14 pedidos— porque
 * es el único del que conocemos el resultado correcto de antemano.
 */
import { describe, expect, it } from "vitest";

import { interpretarCaptura } from "./ocr";

/** Pantalla de Rutas, tal como sale del lector. */
const CAPTURA_RUTAS = [
  "Resumen del 16/09/2026",
  "Rutas 7",
  "Órdenes 14",
  "1",
  "Finalizado",
  "De: 10:03 a 10:27 horas",
  "2",
  "Finalizado",
  "De: 11:04 a 11:22 horas",
  "3",
  "Finalizado",
  "De: 12:09 a 12:24 horas",
  "4",
  "Finalizado",
  "De: 13:20 a 14:00 horas",
  "5",
  "Finalizado",
  "De: 15:12 a 15:42 horas",
  "6",
  "Finalizado",
  "De: 16:52 a 17:10 horas",
  "7",
  "Finalizado",
  "De: 18:20 a 18:57 horas",
];

/** Pantalla de Órdenes. */
const CAPTURA_ORDENES = [
  "Resumen del 16/09/2026",
  "Rutas 7",
  "Órdenes 14",
  "Entregado 14",
  "Entrega parcial 0",
  "No entregado 0",
  "v12238726wofp-01",
  "Ruta 1",
  "Entregado",
  "v12238812wofp-01",
  "Ruta 1",
  "Entregado",
  "v12239232wofp-01",
  "Ruta 2",
  "Entregado",
];

describe("pantalla de Rutas", () => {
  const leido = interpretarCaptura(CAPTURA_RUTAS);

  it("reconoce de qué pantalla se trata", () => {
    expect(leido.tipo_pantalla).toBe("rutas");
  });

  it("lee la fecha de la cabecera y la pasa a formato de calendario", () => {
    expect(leido.fecha).toBe("2026-09-16");
  });

  it("lee los dos contadores", () => {
    expect(leido.contador_rutas).toBe(7);
    expect(leido.contador_ordenes).toBe(14);
  });

  it("saca las siete rutas con sus horarios", () => {
    expect(leido.rutas).toHaveLength(7);
    expect(leido.rutas[0]).toMatchObject({
      numero: 1,
      estado: "Finalizado",
      hora_inicio: "10:03",
      hora_fin: "10:27",
    });
    expect(leido.rutas[6]).toMatchObject({
      numero: 7,
      hora_inicio: "18:20",
      hora_fin: "18:57",
    });
  });

  it("no confunde el contador «Rutas 7» con una ruta más", () => {
    // Si lo tomara por una ruta, saldrían ocho.
    expect(leido.rutas.map((r) => r.numero)).toEqual([1, 2, 3, 4, 5, 6, 7]);
  });

  it("los minutos salen correctos: 182 en total, como dice §16", () => {
    const total = leido.rutas.reduce((suma, r) => {
      const [hi, mi] = r.hora_inicio!.split(":").map(Number);
      const [hf, mf] = r.hora_fin!.split(":").map(Number);
      return suma + (hf * 60 + mf - (hi * 60 + mi));
    }, 0);
    expect(total).toBe(182);
  });
});

describe("pantalla de Órdenes", () => {
  const leido = interpretarCaptura(CAPTURA_ORDENES);

  it("reconoce de qué pantalla se trata", () => {
    expect(leido.tipo_pantalla).toBe("ordenes");
  });

  it("lee la tarjeta de resumen", () => {
    expect(leido.resumen_ordenes).toEqual({ entregado: 14, parcial: 0, no_entregado: 0 });
  });

  it("saca cada pedido con su ruta y su estado", () => {
    expect(leido.ordenes).toHaveLength(3);
    expect(leido.ordenes[0]).toMatchObject({
      codigo: "v12238726wofp-01",
      ruta: 1,
      estado: "Entregado",
    });
    expect(leido.ordenes[2]).toMatchObject({ codigo: "v12239232wofp-01", ruta: 2 });
  });

  it("no confunde «Entregado 14» del resumen con el estado de un pedido", () => {
    expect(leido.ordenes.every((o) => o.estado === "Entregado")).toBe(true);
  });

  it("un pedido no hereda la ruta del de más abajo", () => {
    // Si la búsqueda no se detuviera en el código siguiente, el primero se
    // llevaría la Ruta 2 del tercero.
    expect(leido.ordenes[0].ruta).toBe(1);
    expect(leido.ordenes[1].ruta).toBe(1);
  });
});

describe("errores típicos del lector de texto", () => {
  it("corrige la O por el cero dentro del código", () => {
    const leido = interpretarCaptura(["v122387Z6wofp-O1".replace("Z", "2"), "Ruta 1", "Entregado"]);
    expect(leido.ordenes[0].codigo).toBe("v12238726wofp-01");
  });

  it("aguanta espacios de más en el código", () => {
    const leido = interpretarCaptura(["v 12238726 wofp - 01", "Ruta 3", "Entregado"]);
    expect(leido.ordenes[0].codigo).toBe("v12238726wofp-01");
  });

  it("no toca las letras fuera del código", () => {
    // Si la corrección se aplicara a todo, «Finalizado» acabaría destrozado.
    const leido = interpretarCaptura(["1", "Finalizado", "De: 10:03 a 10:27 horas"]);
    expect(leido.rutas[0].estado).toBe("Finalizado");
  });

  it("lee la fecha con guiones o con puntos", () => {
    expect(interpretarCaptura(["Resumen del 16-09-2026"]).fecha).toBe("2026-09-16");
    expect(interpretarCaptura(["Resumen 16.09.2026"]).fecha).toBe("2026-09-16");
  });

  it("rellena la hora a dos dígitos", () => {
    const leido = interpretarCaptura(["1", "Finalizado", "De: 9:03 a 10:27 horas"]);
    expect(leido.rutas[0].hora_inicio).toBe("09:03");
  });

  it("varias líneas dentro de un mismo bloque se separan solas", () => {
    const leido = interpretarCaptura(["1\nFinalizado\nDe: 10:03 a 10:27 horas"]);
    expect(leido.rutas).toHaveLength(1);
    expect(leido.rutas[0].hora_fin).toBe("10:27");
  });
});

describe("capturas cortadas por el scroll", () => {
  it("marca el pedido al que no se le ve la ruta", () => {
    const leido = interpretarCaptura(["v12238726wofp-01"]);
    expect(leido.ordenes[0].legible_completo).toBe(false);
    expect(leido.ordenes[0].ruta).toBeNull();
  });

  it("marca la ruta a la que no se le ve el número", () => {
    const leido = interpretarCaptura(["De: 10:03 a 10:27 horas"]);
    expect(leido.rutas[0].legible_completo).toBe(false);
  });

  it("una captura de la que no se saca nada se declara desconocida", () => {
    const leido = interpretarCaptura(["Mis rutas", "Buscar", "Ajustes"]);
    expect(leido.tipo_pantalla).toBe("desconocido");
    expect(leido.rutas).toHaveLength(0);
    expect(leido.ordenes).toHaveLength(0);
  });

  it("una lista vacía no revienta", () => {
    expect(interpretarCaptura([]).tipo_pantalla).toBe("desconocido");
  });
});

describe("estados que no son «Entregado»", () => {
  it("distingue entrega parcial de no entregado", () => {
    const leido = interpretarCaptura([
      "v12238726wofp-01",
      "Ruta 1",
      "Entrega parcial",
      "v12238812wofp-01",
      "Ruta 2",
      "No entregado",
    ]);
    expect(leido.ordenes[0].estado).toBe("Entrega parcial");
    expect(leido.ordenes[1].estado).toBe("No entregado");
  });

  it("lee el resumen con estados mezclados", () => {
    const leido = interpretarCaptura([
      "Entregado 12",
      "Entrega parcial 1",
      "No entregado 1",
    ]);
    expect(leido.resumen_ordenes).toEqual({ entregado: 12, parcial: 1, no_entregado: 1 });
  });
});
