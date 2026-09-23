/**
 * Las capturas del 20/09/2026, tal como llegan de la app de reparto.
 *
 * Los tres JSON de `__capturas__/` son lecturas **reales** de esas pantallas,
 * con la caja de cada texto (ver `geometria.ts`). No las sacó el lector del
 * teléfono sino el de macOS, porque es el que había a mano: no devuelve lo
 * mismo, y precisamente por eso sirven. Devuelve el texto en un orden distinto
 * del habitual —cada tarjeta con la ruta *después* del estado—, y con ese
 * orden el intérprete de antes asignaba mal la ruta de la mitad de los
 * pedidos y leía la Ruta 1 como Ruta 2.
 *
 * La lección que guardan: no se puede depender del orden en que llegan las
 * líneas. Por eso cada prueba se repite con las líneas **barajadas**.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { fusionarCapturas } from "./fusionar";
import { lineasEnOrdenDeLectura, type LineaConCaja } from "./geometria";
import { interpretarConContexto, type ContextoEntreCapturas } from "./ocr";
import { validarJornada } from "./validar";

function cargar(nombre: string): LineaConCaja[] {
  const ruta = join(__dirname, "__capturas__", nombre);
  return JSON.parse(readFileSync(ruta, "utf8")).lineas;
}

/** Un barajado determinista: siempre el mismo, para que la prueba no sea inestable. */
function barajar<T>(cosas: readonly T[], semilla: number): T[] {
  const copia = [...cosas];
  let s = semilla;
  for (let i = copia.length - 1; i > 0; i--) {
    s = (s * 1664525 + 1013904223) % 4294967296;
    const j = s % (i + 1);
    [copia[i], copia[j]] = [copia[j], copia[i]];
  }
  return copia;
}

const RUTAS = "20-09-rutas.json";
const ARRIBA = "20-09-ordenes-arriba.json";
const ABAJO = "20-09-ordenes-abajo.json";

/** Lo que dice la app de reparto, mirando las capturas a ojo. */
const PEDIDOS_ESPERADOS: Array<[string, number]> = [
  ["v12250012wofp-01", 1],
  ["v12249443wofp-01", 1],
  ["v12250480wofp-01", 2],
  ["v12250435wofp-01", 2],
  ["v12250473wofp-01", 3],
  ["v12250818wofp-01", 4],
  ["v12251163wofp-01", 4],
  ["v12251660wofp-01", 5],
  ["v12251350wofp-01", 5],
  ["v12252179wofp-01", 6],
];

const RUTAS_ESPERADAS: Array<[number, string, string]> = [
  [1, "19:31", "20:01"],
  [2, "21:17", "21:54"],
  [3, "22:22", "22:30"],
  [4, "10:57", "11:31"],
  [5, "12:29", "13:14"],
  [6, "14:37", "15:05"],
];

function leerSerie(nombres: string[], semilla?: number) {
  let contexto: ContextoEntreCapturas | undefined;
  const imagenes = nombres.map((n) => {
    const trozos = cargar(n);
    const lineas = lineasEnOrdenDeLectura(semilla === undefined ? trozos : barajar(trozos, semilla));
    const leida = interpretarConContexto(lineas, contexto);
    contexto = leida.contexto;
    return leida.imagen;
  });
  return fusionarCapturas(imagenes);
}

describe.each([undefined, 1, 7, 42, 2026])("capturas reales del 20/09 (barajado %s)", (semilla) => {
  it("cada pedido con su ruta, y todos completos", () => {
    const f = leerSerie([ARRIBA, ABAJO], semilla);
    expect(f.ordenes.map((o) => [o.codigo, o.ruta])).toEqual(PEDIDOS_ESPERADOS);
    expect(f.ordenes.every((o) => o.estado === "Entregado")).toBe(true);
    expect(f.ordenes.every((o) => o.legible_completo)).toBe(true);
  });

  it("lee la fecha, los contadores y el resumen", () => {
    const f = leerSerie([ARRIBA], semilla);
    expect(f.fecha).toBe("2026-09-20");
    expect(f.contadorOrdenes).toBe(21);
    expect(f.resumenOrdenes).toEqual({ entregado: 21, parcial: 0, no_entregado: 0 });
  });

  it("las seis rutas, con su número y su horario", () => {
    const f = leerSerie([RUTAS], semilla);
    expect(f.rutas.map((r) => [r.numero, r.hora_inicio, r.hora_fin])).toEqual(RUTAS_ESPERADAS);
  });
});

describe("capturas reales del 20/09: cuántos faltan", () => {
  it("avisa de los pedidos que no llegaron, con cuántos son y por qué suele pasar", () => {
    // Solo se subieron dos de las capturas: 10 pedidos de los 21 que marca la app.
    const f = leerSerie([ARRIBA, ABAJO]);
    const alertas = validarJornada(f, { hoy: "2026-09-21" });

    const falta = alertas.find((a) => a.codigo === "faltan-capturas-ordenes");
    expect(falta?.mensaje).toContain("Faltan 11 pedidos");
    expect(falta?.mensaje).toContain("la app marca 21 y se leyeron 10");
    // Y el resumen, que dice lo mismo, no repite el aviso con otras palabras.
    expect(alertas.some((a) => a.codigo === "resumen-no-cuadra")).toBe(false);
  });
});

describe("capturas reales del 20/09: lo que se cortó", () => {
  it("la tarjeta cortada al pie no inventa un pedido ni le roba la ruta al anterior", () => {
    // Al pie de la captura de arriba asoma el borde de la siguiente tarjeta:
    // su código no se ve, y de su etiqueta «Ruta 4» queda un garabato.
    const f = leerSerie([ARRIBA]);
    expect(f.ordenes.map((o) => [o.codigo, o.ruta])).toEqual(PEDIDOS_ESPERADOS.slice(0, 5));
  });

  it("el estado con el borde de la píldora leído como paréntesis se reconoce", () => {
    // «(O Entregado)», «(• Entregado», «(© Entregado»: el borde y el ✓ del
    // dibujo, convertidos en letras y signos.
    const f = leerSerie([ARRIBA, ABAJO]);
    expect(f.ordenes.filter((o) => o.estado !== "Entregado")).toEqual([]);
  });
});
