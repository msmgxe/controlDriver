/**
 * El envoltorio del lector: usa las posiciones cuando las hay, y cuando no —o
 * cuando el lector propio ni siquiera existe— lee como se leía antes.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const propio = vi.hoisted(() => ({ leer: vi.fn() }));
const antiguo = vi.hoisted(() => ({ process: vi.fn() }));

vi.mock("@capacitor/core", () => ({ registerPlugin: () => propio }));
vi.mock("@jcesarmobile/capacitor-ocr", () => ({ Ocr: antiguo }));

import { leerImagen } from "./lectorTexto";

const caja = (texto: string, x: number, y: number, w = 100, h = 20) => ({
  texto, confianza: 1, x, y, w, h,
});

beforeEach(() => {
  propio.leer.mockReset();
  antiguo.process.mockReset();
});

describe("leerImagen", () => {
  it("con posiciones, ordena por filas aunque el lector las devuelva desordenadas", async () => {
    // La ruta llega antes que el código, y el estado antes que los dos.
    propio.leer.mockResolvedValue({
      ancho: 610, alto: 1356, ms: 412,
      lineas: [
        caja("Entregado", 70, 465, 132, 26),
        caja("Ruta 4", 460, 426, 54, 18),
        caja("v12250818wofp-01", 66, 424, 184, 22),
      ],
    });

    const r = await leerImagen("data:image/png;base64,AAAA");

    expect(r.lector).toBe("posiciones");
    expect(r.lineas).toEqual(["v12250818wofp-01", "Ruta 4", "Entregado"]);
    expect(r.ms).toBe(412);
    expect(r.tamano).toBe("610×1356");
    expect(antiguo.process).not.toHaveBeenCalled();
  });

  it("si el aparato no da cajas, se queda con el orden que trajo", async () => {
    propio.leer.mockResolvedValue({
      ancho: 610, alto: 1356, ms: 300,
      lineas: [caja("b", 0, 0, 0, 0), caja("a", 0, 0, 0, 0)],
    });

    const r = await leerImagen("data:image/png;base64,AAAA");

    expect(r.lector).toBe("solo-texto");
    expect(r.lineas).toEqual(["b", "a"]);
  });

  it("si el lector propio falla, lee con el de siempre", async () => {
    propio.leer.mockRejectedValue(new Error("no está"));
    antiguo.process.mockResolvedValue({ results: [{ text: "v12250818wofp-01" }, { text: "Ruta 4" }] });

    const r = await leerImagen("data:image/png;base64,AAAA");

    expect(r.lector).toBe("solo-texto");
    expect(r.lineas).toEqual(["v12250818wofp-01", "Ruta 4"]);
    expect(r.ms).toBeNull();
  });

  it("si fallan los dos, el error sube: esa captura no se pudo leer", async () => {
    propio.leer.mockRejectedValue(new Error("no está"));
    antiguo.process.mockRejectedValue(new Error("tampoco"));

    await expect(leerImagen("data:image/png;base64,AAAA")).rejects.toThrow("tampoco");
  });
});
