import { describe, expect, it } from "vitest";

import { montoACentimos, montoDeZona, parsearTarifario } from "./tarifario";

describe("parsearTarifario", () => {
  it("lee «Distrito monto», con coma o punto y con S/", () => {
    expect(parsearTarifario("Miraflores 8.50\nLa Molina S/ 9,00\nPueblo Libre: 10.5")).toEqual([
      { nombre: "Miraflores", montoCentimos: 850 },
      { nombre: "La Molina", montoCentimos: 900 },
      { nombre: "Pueblo Libre", montoCentimos: 1050 },
    ]);
  });

  it("lee la tabla copiada de una hoja de cálculo (provincia, distrito, tarifa)", () => {
    const pegado = "Lima\tSantiago de Surco\tS/ 8,50\nLima\tJesús María\tS/ 10,00\nLima\tSan Juan de Miraflores\tS/ 12,00";
    expect(parsearTarifario(pegado).map((z) => [z.nombre, z.montoCentimos])).toEqual([
      ["Santiago de Surco", 850],
      ["Jesús María", 1000],
      ["San Juan de Miraflores", 1200],
    ]);
  });

  it("quita el «Lima» de provincia, pero no el de «Cercado de Lima»", () => {
    expect(parsearTarifario("Lima Breña 13\nCercado de Lima 13,00").map((z) => z.nombre)).toEqual(["Breña", "Cercado de Lima"]);
  });

  it("ignora títulos y líneas sin monto, y una zona repetida se queda con el último", () => {
    const r = parsearTarifario("Tarifas por distrito – Expovino 2026\nProvincia  Distrito  Tarifa por pedido\nSan Borja 8.50\nSan Borja 9");
    expect(r).toEqual([{ nombre: "San Borja", montoCentimos: 900 }]);
  });
});

describe("montos", () => {
  it("montoACentimos", () => {
    expect(montoACentimos("S/ 8,50")).toBe(850);
    expect(montoACentimos("0")).toBeNull();
    expect(montoACentimos("abc")).toBeNull();
  });
  it("montoDeZona: precio × cantidad", () => {
    const z = [{ nombre: "San Borja", montoCentimos: 850 }];
    expect(montoDeZona(z, "San Borja", 5)).toBe(4250);
    expect(montoDeZona(z, "Otra", 5)).toBeNull();
    expect(montoDeZona(z, "San Borja", 0)).toBeNull();
  });
});
