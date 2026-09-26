/**
 * Los dos formatos de código de pedido.
 *
 * La app de reparto trae `v12268269wofp-01`, y también `wpet-12268585-01`, con
 * el número de despacho en el medio. Solo se conocía el primero: el pedido
 * `wpet-…` de una ruta 6 nunca se leía, faltaba uno en el día y no había forma
 * de añadirlo —ni a mano— porque tampoco se aceptaba como código válido.
 */
import { describe, expect, it } from "vitest";

import { FORMATO_DE_CODIGO, RE_CODIGO_PEDIDO, numeroDeDespacho } from "./esquema";
import { buscarCodigo, hayCodigo, interpretarCaptura } from "./ocr";

describe("qué es un código de pedido", () => {
  it.each(["v12268269wofp-01", "wpet-12268585-01", "wpet-12268585-02", "v12238726wofp-12"])(
    "acepta %s",
    (codigo) => expect(RE_CODIGO_PEDIDO.test(codigo)).toBe(true),
  );

  it.each([
    "wpet-1226858-01", // un dígito de menos
    "wpet12268585-01", // sin guion
    "wpet-12268585-1", // sufijo corto
    "wxyz-12268585-01", // otra palabra
    "v12268585wpet-01", // mezcla de los dos
    "pendiente-3",
    "",
  ])("rechaza «%s»", (codigo) => expect(RE_CODIGO_PEDIDO.test(codigo)).toBe(false));

  it("el mensaje de error enseña los dos formatos", () => {
    expect(FORMATO_DE_CODIGO).toContain("wofp");
    expect(FORMATO_DE_CODIGO).toContain("wpet");
  });
});

describe("el número de despacho", () => {
  it("es la parte de 8 dígitos, esté donde esté", () => {
    expect(numeroDeDespacho("v12268269wofp-01")).toBe("12268269");
    expect(numeroDeDespacho("wpet-12268585-01")).toBe("12268585");
  });

  it("no inventa uno cuando el código no es de ningún formato", () => {
    expect(numeroDeDespacho("pendiente-3")).toBeNull();
    expect(numeroDeDespacho("wpet-123-01")).toBeNull();
  });
});

describe("buscar un código en una línea", () => {
  it("halla el formato habitual", () => {
    expect(buscarCodigo("v12268269wofp-01")?.codigo).toBe("v12268269wofp-01");
  });

  it("halla el formato wpet", () => {
    const h = buscarCodigo("wpet-12268585-01");
    expect(h?.codigo).toBe("wpet-12268585-01");
    expect(h?.digitos).toBe("12268585");
    expect(h?.sufijo).toBe("01");
  });

  it("lo halla aunque vaya con la ruta en la misma línea", () => {
    expect(buscarCodigo("wpet-12268585-01   Ruta 6")?.codigo).toBe("wpet-12268585-01");
  });

  it("corrige las confusiones del lector dentro del código", () => {
    // La `l` por el 1, la `O` por el 0, y el guion largo por el normal.
    expect(buscarCodigo("wpet–l2268585–O1")?.codigo).toBe("wpet-12268585-01");
    expect(buscarCodigo("WPET-12268585-01")?.codigo).toBe("wpet-12268585-01");
  });

  it("tolera una letra mal leída en el nombre", () => {
    expect(buscarCodigo("wpat-12268585-01")?.codigo).toBe("wpet-12268585-01");
  });

  it("no toma por código palabras que solo se le parecen", () => {
    expect(hayCodigo("Wong-Sillogis-Sol")).toBe(false);
    expect(hayCodigo("Entregado")).toBe(false);
    expect(hayCodigo("Ruta 6")).toBe(false);
    expect(hayCodigo("wpet")).toBe(false);
    expect(hayCodigo("wpet-2026-09")).toBe(false);
  });
});

describe("una pantalla de órdenes con los dos formatos", () => {
  // La lista real del 25/09/2026: el de la ruta 6 es el que no se leía.
  const PANTALLA = [
    "Resumen del 25/09/2026",
    "Rutas 8",
    "Órdenes 5",
    "Entregado 5",
    "Entrega parcial 0",
    "No entregado 0",
    "v12268269wofp-01",
    "Ruta 5",
    "Entregado",
    "v12269477wofp-01",
    "Ruta 6",
    "Entregado",
    "wpet-12268585-01",
    "Ruta 6",
    "Entregado",
    "v12269031wofp-01",
    "Ruta 7",
    "Entregado",
    "v12269570wofp-01",
    "Ruta 7",
    "Entregado",
  ];

  const leido = interpretarCaptura(PANTALLA);

  it("lee los cinco pedidos, el wpet incluido", () => {
    expect(leido.ordenes.map((o) => o.codigo)).toEqual([
      "v12268269wofp-01",
      "v12269477wofp-01",
      "wpet-12268585-01",
      "v12269031wofp-01",
      "v12269570wofp-01",
    ]);
  });

  it("le pone su ruta y su estado al wpet", () => {
    const wpet = leido.ordenes.find((o) => o.codigo === "wpet-12268585-01");
    expect(wpet).toMatchObject({ ruta: 6, estado: "Entregado", legible_completo: true });
  });

  it("los pedidos de al lado conservan su ruta", () => {
    expect(leido.ordenes.map((o) => o.ruta)).toEqual([5, 6, 6, 7, 7]);
  });

  it("cuadra con el contador de la pestaña", () => {
    expect(leido.contador_ordenes).toBe(5);
    expect(leido.ordenes).toHaveLength(5);
  });

  it("con la ruta en la misma fila que el código", () => {
    const enFila = interpretarCaptura([
      "Resumen del 25/09/2026",
      "Órdenes 2",
      "v12269477wofp-01   Ruta 6",
      "Entregado",
      "wpet-12268585-01   Ruta 6",
      "Entregado",
    ]);
    expect(enFila.ordenes.map((o) => [o.codigo, o.ruta])).toEqual([
      ["v12269477wofp-01", 6],
      ["wpet-12268585-01", 6],
    ]);
  });

  it("un wpet con un dígito de menos se conserva como dudoso, no se pierde", () => {
    const corto = interpretarCaptura([
      "Resumen del 25/09/2026",
      "Órdenes 1",
      "wpet-1226858-01",
      "Ruta 6",
      "Entregado",
    ]);
    // No es un código completo, pero tampoco desaparece en silencio.
    expect(corto.ordenes).toHaveLength(1);
    expect(corto.ordenes[0].legible_completo).toBe(false);
  });
});
