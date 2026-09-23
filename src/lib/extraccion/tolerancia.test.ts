/**
 * Lo que el lector de texto estropea, y que no puede costar un pedido.
 *
 * Cada caso sale de un fallo real o verosímil de la lectura de letra pequeña
 * sobre fondo de color. Lo que se vigila no es tanto que se lea bien como que
 * **nada se pierda en silencio**: un dato leído a medias se conserva y se marca
 * como dudoso, para que la pantalla de Revisión pida mirarlo.
 */
import { describe, expect, it } from "vitest";

import { estadoDe, interpretarCaptura, normalizar } from "./ocr";

const estado = (texto: string) => estadoDe(normalizar(texto));

describe("el estado dentro de su píldora", () => {
  it.each([
    ["Entregado", "Entregado"],
    ["• Entregado", "Entregado"],
    ["| Entregado", "Entregado"],
    ["V Entregado", "Entregado"],
    ["(• Entregado", "Entregado"],
    ["(© Entregado", "Entregado"],
    ["(O Entregado)", "Entregado"],
    ["( Entregado )", "Entregado"],
    ["Entregado)", "Entregado"],
    ["Entrega parcial", "Entrega parcial"],
    ["(A Entrega parcial)", "Entrega parcial"],
    ["No entregado", "No entregado"],
    ["(! No entregado)", "No entregado"],
    ["•Finalizado", "Finalizado"],
  ])("%s → %s", (leido, esperado) => {
    expect(estado(leido)).toBe(esperado);
  });

  it("una letra mal leída no lo cambia", () => {
    expect(estado("Entregadc")).toBe("Entregado");
    expect(estado("(O Entregaclo)")).toBe("Entregado");
    expect(estado("Entrega parcia1")).toBe("Entrega parcial");
  });

  it("nunca convierte un estado en el contrario", () => {
    // «entregado» está a dos letras de «no entregado»: cada uno es el suyo.
    expect(estado("Entregado")).toBe("Entregado");
    expect(estado("No entregado")).toBe("No entregado");
    expect(estado("(O No entregado)")).toBe("No entregado");
  });

  it("no toma por estado lo que no lo es", () => {
    expect(estado("Entrega")).toBeNull();
    expect(estado("Ruta 4")).toBeNull();
    expect(estado("Resumen del 20/09/2026")).toBeNull();
    expect(estado("Inicio")).toBeNull();
  });
});

describe("el código del pedido", () => {
  const pedido = (linea: string) => interpretarCaptura([linea, "Ruta 1", "Entregado"]).ordenes[0];

  it.each([
    "v12250818wofp-01",
    "V12250818wofp-01",
    "v12250818w0fp-01", // la «o» leída como cero
    "v12250818wofp - 01", // espacios de más
    "v12250818wofp‑01", // guion no separable
    "v12250818wofp_01",
    "v12250818wofp.01",
    "v12250818wofp01", // sin guion
    "v12250818wotp-01", // la «f» leída como «t»
  ])("%s", (leido) => {
    expect(pedido(leido)?.codigo).toBe("v12250818wofp-01");
    expect(pedido(leido)?.legible_completo).toBe(true);
  });

  it("las letras que sustituyen a dígitos, cada una por el suyo", () => {
    // Una «B» es un 8, no un 6: leer v1225O8lB como v12250618 fabricaba un
    // pedido que no existe, y con él un «pedido de más».
    expect(pedido("v1225O8lBwofp-01")?.codigo).toBe("v12250818wofp-01");
    expect(pedido("vl2250818wofp-O1")?.codigo).toBe("v12250818wofp-01");
    expect(pedido("v1225081bwofp-01")?.codigo).toBe("v12250816wofp-01");
  });

  it("un dígito de menos se conserva, marcado como dudoso", () => {
    // Antes esto no casaba con el patrón y el pedido desaparecía sin aviso.
    const p = pedido("v1225081wofp-01");
    expect(p).toBeDefined();
    expect(p.codigo).toBe("v1225081wofp-01");
    expect(p.legible_completo).toBe(false);
  });

  it("un dígito de más, igual", () => {
    const p = pedido("v122508188wofp-01");
    expect(p.codigo).toBe("v122508188wofp-01");
    expect(p.legible_completo).toBe(false);
  });

  it("el código y la ruta en una sola línea", () => {
    const leido = interpretarCaptura(["v12250818wofp-01 Ruta 4", "Entregado"]);
    expect(leido.ordenes[0]).toMatchObject({ codigo: "v12250818wofp-01", ruta: 4, estado: "Entregado" });
  });

  it("«Ruta» con la t mal leída", () => {
    for (const ruta of ["Rula 4", "Ru1a 4", "Ruía 4"]) {
      const leido = interpretarCaptura(["v12250818wofp-01", ruta, "Entregado"]);
      expect(leido.ordenes[0].ruta, ruta).toBe(4);
    }
  });
});

describe("el horario de una ruta", () => {
  const horario = (linea: string) => {
    const r = interpretarCaptura(["1 Ruta • Finalizado", linea]).rutas[0];
    return r ? [r.hora_inicio, r.hora_fin] : null;
  };

  it.each([
    "De: 19:31 a 20:01 horas",
    "De 19:31 a 20:01 horas", // sin los dos puntos
    "19:31 a 20:01 horas", // el lector se comió el «De:»
    "De: 19.31 a 20.01 horas", // punto en vez de dos puntos
    "De: 19:31 a 20:01",
    "De: 19:31 - 20:01 horas",
  ])("%s", (leido) => {
    expect(horario(leido)).toEqual(["19:31", "20:01"]);
  });

  it("la hora del reloj de la pantalla no es un horario", () => {
    expect(interpretarCaptura(["10:41", "Resumen del 20/09/2026"]).rutas).toEqual([]);
  });
});
