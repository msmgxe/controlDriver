/**
 * Pruebas con capturas **reales** de la app de reparto.
 *
 * Todo el intérprete se escribió primero a partir de una descripción de la
 * pantalla, y falló en el teléfono una y otra vez por detalles que no venían
 * en ninguna descripción. Estos archivos son el texto que un lector real sacó
 * de capturas de verdad, sin retocar. Cada captura nueva que falle debería
 * acabar aquí.
 *
 *   ordenes-16-09.txt   pestaña Órdenes del 16/09/2026, arriba de la lista.
 *                       Leída con el reconocimiento de texto de macOS.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { interpretarCaptura } from "./ocr";

const captura = (nombre: string) =>
  readFileSync(join(__dirname, "__capturas__", nombre), "utf8").split("\n").filter(Boolean);

describe("Órdenes del 16/09, captura real", () => {
  const leido = interpretarCaptura(captura("ordenes-16-09.txt"));

  it("lee la fecha", () => {
    expect(leido.fecha).toBe("2026-09-16");
  });

  it("el resumen dice 14 entregados, no 14 no entregados", () => {
    // El error que pintó de rojo días enteros: los tres rótulos salen seguidos
    // y luego las tres cifras, y se emparejaban mal.
    expect(leido.resumen_ordenes).toEqual({ entregado: 14, parcial: 0, no_entregado: 0 });
  });

  it("los seis pedidos visibles, cada uno con su ruta", () => {
    expect(leido.ordenes.map((o) => [o.codigo, o.ruta])).toEqual([
      ["v12238726wofp-01", 1],
      ["v12238812wofp-01", 1],
      ["v12239232wofp-01", 2],
      ["v12239089wofp-01", 2],
      ["v12239528wofp-01", 3],
      ["v12239312wofp-01", 3],
    ]);
  });

  it("reconoce el estado aunque lleve el icono delante («| Entregado», «• Entregado»)", () => {
    // El último pedido sale cortado por abajo: se le ve el código y la ruta,
    // pero no el estado.
    expect(leido.ordenes.slice(0, 5).every((o) => o.estado === "Entregado" && o.legible_completo)).toBe(true);
  });

  it("la V mayúscula del primer código se lee igual", () => {
    expect(leido.ordenes[0].codigo).toBe("v12238726wofp-01");
  });
});
