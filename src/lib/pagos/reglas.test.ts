import { describe, expect, it } from "vitest";

import { esquemaReglaPago, pagoDelTramo, reglaTarifaUnica, tramoDeKm } from "./reglas";

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
