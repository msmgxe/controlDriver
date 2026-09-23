/**
 * La preferencia de apariencia, y el script que la aplica antes de pintar.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  CLAVE_APARIENCIA,
  SCRIPT_INICIAL,
  esPreferencia,
  leerPreferencia,
  modoDe,
} from "./apariencia";

/** Un `localStorage` mínimo, porque Node no trae uno. */
function almacen(inicial: Record<string, string> = {}) {
  const datos = { ...inicial };
  return {
    getItem: (k: string) => datos[k] ?? null,
    setItem: (k: string, v: string) => void (datos[k] = v),
  };
}

beforeEach(() => vi.unstubAllGlobals());

describe("la preferencia", () => {
  it("por defecto es automático", () => {
    vi.stubGlobal("localStorage", almacen());
    expect(leerPreferencia()).toBe("auto");
  });

  it("recuerda cualquiera de los cuatro temas", () => {
    for (const tema of ["claro", "oscuro", "turbo", "menta"] as const) {
      vi.stubGlobal("localStorage", almacen({ [CLAVE_APARIENCIA]: tema }));
      expect(leerPreferencia()).toBe(tema);
    }
  });

  it("un valor raro se trata como automático", () => {
    vi.stubGlobal("localStorage", almacen({ [CLAVE_APARIENCIA]: "sepia" }));
    expect(leerPreferencia()).toBe("auto");
    expect(esPreferencia("sepia")).toBe(false);
  });

  it("si el almacenamiento falla, no rompe: automático", () => {
    vi.stubGlobal("localStorage", {
      getItem: () => {
        throw new Error("bloqueado");
      },
    });
    expect(leerPreferencia()).toBe("auto");
  });
});

describe("qué cara se aplica", () => {
  it("lo elegido manda sobre el teléfono", () => {
    expect(modoDe("claro", true)).toBe("claro");
    expect(modoDe("oscuro", false)).toBe("oscuro");
  });

  it("en automático sigue al teléfono", () => {
    expect(modoDe("auto", true)).toBe("oscuro");
    expect(modoDe("auto", false)).toBe("claro");
  });

  it("turbo y menta no miran el teléfono: son una elección fija", () => {
    expect(modoDe("turbo", true)).toBe("turbo");
    expect(modoDe("turbo", false)).toBe("turbo");
    expect(modoDe("menta", true)).toBe("menta");
    expect(modoDe("menta", false)).toBe("menta");
  });
});

/**
 * El script de la cabecera repite la lógica de arriba porque no puede importar
 * nada. Aquí se ejecuta de verdad, para que no se separen.
 */
describe("el script de antes de pintar", () => {
  function correr(guardada: string | null, sistemaOscuro: boolean): string | undefined {
    const html = { dataset: {} as Record<string, string> };
    vi.stubGlobal("localStorage", almacen(guardada === null ? {} : { [CLAVE_APARIENCIA]: guardada }));
    vi.stubGlobal("matchMedia", () => ({ matches: sistemaOscuro }));
    vi.stubGlobal("document", { documentElement: html });
    new Function(SCRIPT_INICIAL)();
    return html.dataset.modo;
  }

  it.each([
    [null, false, "claro"],
    [null, true, "oscuro"],
    ["auto", true, "oscuro"],
    ["claro", true, "claro"],
    ["oscuro", false, "oscuro"],
    ["turbo", true, "turbo"],
    ["turbo", false, "turbo"],
    ["menta", true, "menta"],
    ["basura", true, "oscuro"],
  ])("guardada=%s, teléfono oscuro=%s → %s", (guardada, sistema, esperado) => {
    expect(correr(guardada, sistema)).toBe(esperado);
    // Y coincide con lo que dice la función.
    const pref = esPreferencia(guardada) ? guardada : "auto";
    expect(esperado).toBe(modoDe(pref, sistema));
  });
});
