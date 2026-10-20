import { describe, expect, it } from "vitest";

import { REGLA_INICIAL, esPorZona, esquemaReglaPago, etiquetaTramo, pagoDelTramo, reglaTarifaUnica, tramoDeKm } from "./reglas";

describe("reglaTarifaUnica", () => {
  it("paga lo mismo sin importar el tramo o la distancia", () => {
    const regla = reglaTarifaUnica(6);
    expect(pagoDelTramo(regla, 1)).toBe(600);
    expect(tramoDeKm(regla, 0.5)).toBe(1);
    expect(tramoDeKm(regla, 11)).toBe(1);
  });

  it("no lleva garantía por permanencia", () => {
    expect(reglaTarifaUnica(6).garantiaPermanencia).toBeNull();
  });

  it("es una regla válida de verdad", () => {
    expect(esquemaReglaPago.safeParse(reglaTarifaUnica(6)).success).toBe(true);
  });
});

describe("tarifa por zona", () => {
  const aurora = esquemaReglaPago.parse({
    moneda: "PEN",
    base: "por_pedido",
    medida: "zona",
    tramos: [
      { id: 1, desde: 0, hasta: 0, monto: 9.5, nombre: "Miraflores, Surquillo, Surco" },
      { id: 2, desde: 0, hasta: 0, monto: 13, nombre: "Chorrillos" },
    ],
  });

  it("se reconoce, y cada zona se llama por su nombre", () => {
    expect(esPorZona(aurora)).toBe(true);
    expect(etiquetaTramo(aurora, 2)).toBe("Chorrillos");
    expect(pagoDelTramo(aurora, 2)).toBe(1300);
    expect(pagoDelTramo(aurora, 3)).toBeNull(); // una zona quitada ya no paga: la liquidación lo señala
  });

  it("una regla por km de las de siempre sigue valiendo sin migrar", () => {
    expect(esquemaReglaPago.safeParse(REGLA_INICIAL).success).toBe(true);
    expect(esPorZona(REGLA_INICIAL)).toBe(false);
    expect(etiquetaTramo(REGLA_INICIAL, 3)).toBe("T3");
    expect(etiquetaTramo(REGLA_INICIAL, 6)).toBe("Más de 12 km");
  });

  it("un nombre vacío no es válido", () => {
    expect(esquemaReglaPago.safeParse({ ...aurora, tramos: [{ id: 1, desde: 0, hasta: 0, monto: 9, nombre: "  " }] }).success).toBe(false);
  });
});
