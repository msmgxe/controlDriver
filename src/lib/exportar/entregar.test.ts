import { describe, expect, it } from "vitest";

import { tipoDeArchivo } from "./entregar";

describe("el tipo de un archivo por su extensión", () => {
  it("reconoce el PDF, el Excel y el respaldo", () => {
    expect(tipoDeArchivo("estadisticas_2026-09-20_a_2026-09-26.pdf")).toBe("application/pdf");
    expect(tipoDeArchivo("rutas-a_2026-09-14.xlsx")).toContain("spreadsheetml");
    expect(tipoDeArchivo("rutas-a-respaldo-2026-09-26.json")).toBe("application/json");
  });

  it("no se confunde con mayúsculas ni con puntos en el nombre", () => {
    expect(tipoDeArchivo("Informe.v2.PDF")).toBe("application/pdf");
  });

  it("uno que no conoce cae en el tipo de respaldo", () => {
    expect(tipoDeArchivo("cosa.xyz")).toBe("application/octet-stream");
    expect(tipoDeArchivo("cosa.xyz", "text/plain")).toBe("text/plain");
  });
});
