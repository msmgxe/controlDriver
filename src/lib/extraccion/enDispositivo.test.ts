/**
 * La lectura de pedidos sueltos, con el lector de texto del teléfono simulado.
 *
 * Lo que se comprueba es lo que solo este envoltorio hace y no cubren las
 * pruebas de la fusión: que cada captura hereda de la anterior la ruta bajo la
 * que seguía, y que se devuelven las fechas que traían las capturas.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

/* La imagen "es" el nombre de la captura; el lector simulado la devuelve
   convertida en las líneas que el teléfono habría leído de ella. */
const CAPTURAS: Record<string, string[]> = {};

vi.mock("@jcesarmobile/capacitor-ocr", () => ({
  Ocr: {
    process: async ({ image }: { image: string }) => ({
      results: (CAPTURAS[image] ?? []).map((text) => ({ text })),
    }),
  },
}));

/* Node no trae FileReader: se sustituye por uno que devuelve el texto del Blob. */
class LectorDeArchivos {
  result: string | null = null;
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  readAsDataURL(blob: Blob) {
    void blob.text().then((t) => {
      this.result = t;
      this.onload?.();
    });
  }
}
vi.stubGlobal("FileReader", LectorDeArchivos);

import { leerPedidosDeCapturas } from "./enDispositivo";

const imagen = (nombre: string, lineas: string[]): Blob => {
  CAPTURAS[nombre] = lineas;
  return new Blob([nombre]);
};

const CABECERA = ["Resumen del 16/09/2026", "Rutas 7", "Órdenes 14"];

const ARRIBA = [
  ...CABECERA,
  "Ruta 1",
  "v12238726wofp-01", "Entregado",
  "v12238812wofp-01", "Entregado",
  "Ruta 3",
  "v12239528wofp-01", "Entregado",
];
// Empieza a mitad de la ruta 3, sin su cabecera, y repite el último pedido.
const ABAJO = [
  "v12239528wofp-01", "Entregado",
  "v12239312wofp-01", "Entregado",
  "Ruta 4",
  "v12239582wofp-01", "No entregado",
];

beforeEach(() => {
  for (const k of Object.keys(CAPTURAS)) delete CAPTURAS[k];
});

describe("leer pedidos de una o más capturas", () => {
  it("junta las capturas y cuenta una vez el pedido que se solapa", async () => {
    const { pedidos } = await leerPedidosDeCapturas([imagen("a", ARRIBA), imagen("b", ABAJO)]);

    expect(pedidos.map((p) => p.codigo)).toEqual([
      "v12238726wofp-01",
      "v12238812wofp-01",
      "v12239528wofp-01",
      "v12239312wofp-01",
      "v12239582wofp-01",
    ]);
  });

  it("el pedido que abre una captura sin cabecera hereda la ruta de la anterior", async () => {
    const { pedidos } = await leerPedidosDeCapturas([imagen("a", ARRIBA), imagen("b", ABAJO)]);

    expect(pedidos.find((p) => p.codigo === "v12239312wofp-01")!.ruta).toBe(3);
  });

  it("conserva ruta y estado de cada pedido", async () => {
    const { pedidos } = await leerPedidosDeCapturas([imagen("a", ARRIBA), imagen("b", ABAJO)]);

    const ultimo = pedidos.find((p) => p.codigo === "v12239582wofp-01")!;
    expect(ultimo.ruta).toBe(4);
    expect(ultimo.estado).toBe("No entregado");
  });

  it("devuelve la fecha que traía la cabecera", async () => {
    const { fechas } = await leerPedidosDeCapturas([imagen("a", ARRIBA), imagen("b", ABAJO)]);

    expect(fechas).toEqual(["2026-09-16"]);
  });

  it("una captura de rutas no aporta pedidos", async () => {
    const rutas = imagen("r", [...CABECERA, "Finalizado", "De: 10:03 a 10:27 horas"]);

    const { pedidos } = await leerPedidosDeCapturas([rutas]);

    expect(pedidos).toEqual([]);
  });
});
