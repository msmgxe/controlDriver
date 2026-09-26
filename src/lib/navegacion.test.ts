import { describe, expect, it } from "vitest";

import { PUERTAS, puertaDe, tituloDe } from "./navegacion";

describe("el orden de la barra de abajo", () => {
  it("Inicio, Cargar, Pagos, Historial, Buscar, Estadísticas y Ajustes", () => {
    expect(PUERTAS.map((p) => p.id)).toEqual([
      "inicio",
      "cargar",
      "pagos",
      "historial",
      "buscar",
      "estadisticas",
      "ajustes",
    ]);
  });

  it("solo «Cargar» no es una pantalla", () => {
    expect(PUERTAS.filter((p) => !p.href).map((p) => p.id)).toEqual(["cargar"]);
  });
});

describe("qué puerta está encendida", () => {
  it.each([
    ["/", "inicio"],
    ["/pagos/", "pagos"],
    ["/pagos", "pagos"],
    ["/historial/", "historial"],
    ["/buscar/", "buscar"],
    ["/estadisticas/", "estadisticas"],
    ["/ajustes/", "ajustes"],
  ])("en %s, la de %s", (ruta, id) => {
    expect(puertaDe(ruta)).toBe(id);
  });

  it("la revisión y compartir desde la galería son el final de «Cargar»", () => {
    expect(puertaDe("/revision/")).toBe("cargar");
    expect(puertaDe("/compartir/")).toBe("cargar");
  });

  it("la jornada de un día es de Inicio", () => {
    expect(puertaDe("/jornada/")).toBe("inicio");
  });

  it("una ruta que no se conoce cae en Inicio, y solo en esa", () => {
    expect(puertaDe("/algo-raro/")).toBe("inicio");
  });

  it("nunca hay dos encendidas: cada ruta cae en una sola puerta", () => {
    for (const ruta of ["/", "/pagos/", "/historial/", "/buscar/", "/estadisticas/", "/ajustes/", "/revision/"]) {
      const encendidas = PUERTAS.filter((p) => p.id === puertaDe(ruta));
      expect(encendidas).toHaveLength(1);
    }
  });
});

describe("el título de arriba", () => {
  it.each([
    ["/", "Hoy"],
    ["/pagos/", "Pagos"],
    ["/ajustes/", "Ajustes"],
    ["/estadisticas/", "Estadísticas"],
    ["/revision/", "Revisión"],
    ["/compartir/", "Cargar"],
  ])("en %s dice «%s»", (ruta, titulo) => {
    expect(tituloDe(ruta)).toBe(titulo);
  });
});
