import { describe, expect, it } from "vitest";

import { calcularLiquidacion, type JornadaLiquidable } from "./calcular-liquidacion";
import { REGLA_SIN_GARANTIA, esquemaReglaPago, type ReglaPago } from "./reglas";

const regla: ReglaPago = esquemaReglaPago.parse({ ...REGLA_SIN_GARANTIA });

const dia = (pedidos: Array<{ tramo: number; bono?: number; manual?: number }>): JornadaLiquidable => ({
  fecha: "2026-11-02",
  horaEntrada: null,
  horaSalida: null,
  rutas: [{ numero: 1, duracionMin: 60 }],
  pedidos: pedidos.map((p, i) => ({
    codigo: `v1000000${i}wofp-01`,
    tramo: p.tramo,
    estado: "Entregado",
    ruta: 1,
    montoManualCentimos: p.manual ?? null,
    bonoCentimos: p.bono ?? 0,
  })),
});

describe("el bono de campaña en la liquidación", () => {
  it("suma el bono a la tarifa del tramo de cada pedido que lo tiene", () => {
    // 3 pedidos de S/ 10.00; dos con bono de S/ 2.00 → 30 + 4 = S/ 34.00
    const r = calcularLiquidacion([dia([{ tramo: 1, bono: 200 }, { tramo: 1, bono: 200 }, { tramo: 1 }])], regla, "2026-11-02");
    expect(r.montoCalculadoCentimos).toBe(3400);
  });

  it("en «más de 12 km» el monto manual ya trae el bono: no se cuenta dos veces", () => {
    const r = calcularLiquidacion([dia([{ tramo: 6, manual: 2000, bono: 200 }])], regla, "2026-11-02");
    expect(r.montoCalculadoCentimos).toBe(2000);
  });

  it("sin bono todo sigue igual", () => {
    const r = calcularLiquidacion([dia([{ tramo: 1 }, { tramo: 2 }])], regla, "2026-11-02");
    expect(r.montoCalculadoCentimos).toBe(2150);
  });
});
