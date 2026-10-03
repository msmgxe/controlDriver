import { describe, expect, it } from "vitest";

import { categoriaDe, montoApoyoHora, montoApoyoTramos } from "./bloques-extra";

describe("categoriaDe", () => {
  it("apoyo por hora y por tramos son los dos 'apoyo'", () => {
    expect(categoriaDe("apoyo_hora")).toBe("apoyo");
    expect(categoriaDe("apoyo_tramos")).toBe("apoyo");
  });

  it("taxi es 'taxi'", () => {
    expect(categoriaDe("taxi")).toBe("taxi");
  });
});

describe("montoApoyoHora", () => {
  it("tarifa por horas enteras", () => {
    expect(montoApoyoHora(1800, 3)).toBe(5400);
  });

  it("horas fraccionarias, sin truncar: 2.5 h a S/18 son S/45, no S/36", () => {
    expect(montoApoyoHora(1800, 2.5)).toBe(4500);
  });

  it("redondea al céntimo", () => {
    expect(montoApoyoHora(1333, 1.5)).toBe(2000); // 1999.5 -> 2000
  });

  it("cero horas, cero monto", () => {
    expect(montoApoyoHora(1800, 0)).toBe(0);
  });
});

describe("montoApoyoTramos", () => {
  it("suma los pedidos ya tarifados", () => {
    expect(montoApoyoTramos([{ montoCentimos: 1000 }, { montoCentimos: 1150 }, { montoCentimos: 1000 }])).toBe(3150);
  });

  it("sin pedidos, cero", () => {
    expect(montoApoyoTramos([])).toBe(0);
  });
});
