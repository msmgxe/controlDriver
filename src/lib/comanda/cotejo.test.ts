import { describe, expect, it } from "vitest";

import type { FechaISO } from "@/lib/fechas";

import { cotejar, extraerNumeros, type PedidoMio } from "./cotejo";

/* Filas tal como salen en la captura del reporte de la empresa. */
const FILAS = [
  "v12341686wofp-01",
  "Marco Antonio Saldarriaga Medina",
  "1",
  "v12342501wofp-01 Marco Antonio Saldarriaga Medina 1",
  "wpet-opcaso12343880p-01",
  "v1235O571wofp-01", // el lector confunde un 0 con una O
  "v12341686wofp-01", // repetida
  "Total 70",
];

describe("extraerNumeros", () => {
  it("saca el número de despacho de cada fila, sin repetidos", () => {
    expect(extraerNumeros(FILAS)).toEqual(["12341686", "12342501", "12343880", "12350571"]);
  });
  it("no toma por pedido un DNI ni una cantidad", () => {
    expect(extraerNumeros(["09597255", "1", "S/ 211.51"])).toEqual([]);
  });
});

const mio = (n: string, fecha: string, extra: Partial<PedidoMio> = {}): PedidoMio => ({
  id: n,
  codigo: `v${n}wofp-01`,
  fecha: fecha as FechaISO,
  montoCentimos: 1000,
  contado: false,
  ...extra,
});

describe("cotejar", () => {
  const mios = [
    mio("12341686", "2026-10-13"),
    mio("12342501", "2026-10-14"),
    mio("12343131", "2026-10-15"), // la empresa no lo contó
    mio("12343880", "2026-10-16", { codigo: "wpet-12343880-01" }), // otro formato de código: igual coincide
    mio("12399999", "2026-11-30"), // fuera del período del reporte
    { id: "p1", codigo: "pendiente-abc", fecha: "2026-10-14" as FechaISO, montoCentimos: 1000, contado: false },
    { id: "p2", codigo: "pendiente-def", fecha: "2026-12-01" as FechaISO, montoCentimos: 1000, contado: false },
  ];
  const r = cotejar(["12341686", "12342501", "12343880", "12350000", "12350001"], mios);

  it("separa lo que coincide, lo que me falta y lo que la empresa no contó", () => {
    expect(r.coinciden.map((p) => p.id)).toEqual(["12341686", "12342501", "12343880"]);
    expect(r.faltanEnMiRegistro).toEqual(["12350000", "12350001"]);
    expect(r.noContados.map((p) => p.id)).toEqual(["12343131"]);
  });

  it("el período sale de los que coinciden, y deja fuera lo de otras fechas", () => {
    expect(r.periodo).toEqual({ desde: "2026-10-13", hasta: "2026-10-16" });
    expect(r.noContados.some((p) => p.id === "12399999")).toBe(false);
  });

  it("cuenta aparte los pedidos sin código del período", () => {
    expect(r.sinCodigo.map((p) => p.id)).toEqual(["p1"]);
  });

  it("si no coincide ninguno, no inventa un período", () => {
    const vacio = cotejar(["12350000"], mios);
    expect(vacio.periodo).toBeNull();
    expect(vacio.noContados).toEqual([]);
    expect(vacio.faltanEnMiRegistro).toEqual(["12350000"]);
  });
});
