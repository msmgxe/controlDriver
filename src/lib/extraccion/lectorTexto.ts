/**
 * El lector de texto del teléfono, con su respaldo.
 *
 * Hay dos lectores y se prefiere el propio:
 *
 *   · **`LectorTexto`** (Java, en `android/`): devuelve cada línea con su
 *     posición y reutiliza el reconocedor entre capturas. Con las posiciones,
 *     `geometria.ts` ordena el texto y le pone a cada pedido su ruta y su
 *     estado sin adivinar.
 *   · **`@jcesarmobile/capacitor-ocr`**: solo texto, en el orden que salga. Es
 *     lo que había antes, y se conserva como red de seguridad: si el lector
 *     propio fallara en un teléfono raro, leer como antes es mejor que no
 *     leer.
 *
 * Los dos devuelven líneas de texto; lo que cambia es la calidad del orden.
 */
import { registerPlugin } from "@capacitor/core";

import { lineasEnOrdenDeLectura, type LineaConCaja } from "./geometria";

interface RespuestaLector {
  ancho: number;
  alto: number;
  ms: number;
  lineas: Array<LineaConCaja & { confianza: number }>;
}

interface LectorTextoPlugin {
  leer(opciones: { image: string }): Promise<RespuestaLector>;
}

const LectorTexto = registerPlugin<LectorTextoPlugin>("LectorTexto");

/** Lo que devuelve leer una imagen. */
export interface LecturaDeImagen {
  /** Las líneas, ya en orden de lectura, listas para el intérprete. */
  lineas: string[];
  /** Con qué se leyó. `posiciones` es el bueno. */
  lector: "posiciones" | "solo-texto";
  /** Lo que tardó el lector nativo, en ms; null si no lo midió. */
  ms: number | null;
  /** Tamaño de la imagen leída, para el diagnóstico. */
  tamano: string | null;
  /** El texto crudo, con las cajas, por si hay que ver qué devolvió de verdad. */
  crudo: string[];
}

/**
 * El lector de siempre, cargado una sola vez.
 *
 * Se importa bajo demanda —en el navegador ese plugin nativo no existe— y se
 * guarda la promesa: con dos capturas leyéndose a la vez, dos importaciones
 * simultáneas del mismo módulo no tienen por qué resolverse igual.
 */
let lectorDeRespaldo: Promise<typeof import("@jcesarmobile/capacitor-ocr")> | null = null;
const cargarRespaldo = () => (lectorDeRespaldo ??= import("@jcesarmobile/capacitor-ocr"));

/** Lee una imagen ya convertida a `data:` URL. */
export async function leerImagen(dataUrl: string): Promise<LecturaDeImagen> {
  try {
    const r = await LectorTexto.leer({ image: dataUrl });
    const trozos = r.lineas.filter((l) => typeof l.texto === "string");

    // Si el aparato no dio cajas —caja nula, todo en cero— no hay geometría
    // que usar: se sigue con el orden que trajo, como antes.
    const conCaja = trozos.filter((l) => l.w > 0 && l.h > 0);
    const hayGeometria = trozos.length > 0 && conCaja.length >= trozos.length * 0.8;

    return {
      lineas: hayGeometria ? lineasEnOrdenDeLectura(trozos) : trozos.map((l) => l.texto),
      lector: hayGeometria ? "posiciones" : "solo-texto",
      ms: r.ms,
      tamano: `${r.ancho}×${r.alto}`,
      crudo: trozos.map((l) => `${l.x},${l.y},${l.w},${l.h}|${l.texto}`),
    };
  } catch {
    /* El lector propio no está o falló: el de siempre. Si este también falla,
       el error sube y la captura se cuenta como no leída. */
    const { Ocr } = await cargarRespaldo();
    const { results } = await Ocr.process({ image: dataUrl });
    const lineas = results.map((r) => r.text);
    return { lineas, lector: "solo-texto", ms: null, tamano: null, crudo: lineas };
  }
}

/** Lo que devuelve leer una foto con todo el detalle: cada línea, dónde está y cuánto se fía el lector. */
export interface LecturaConCajas {
  ancho: number;
  alto: number;
  ms: number | null;
  lineas: Array<{ texto: string; x: number; y: number; w: number; h: number; confianza: number | null }>;
  /** Con qué se leyó. `posiciones` trae dónde está cada línea; `solo-texto`, nada más que el texto. */
  lector: "posiciones" | "solo-texto";
}

/**
 * Lee una imagen **conservando** la posición y la confianza de cada línea.
 *
 * `leerImagen` las descarta porque las capturas de pantalla solo necesitan el
 * orden. Una foto de una hoja de despacho necesita las dos cosas: la posición,
 * para quedarse con la columna de los datos y saltarse el sello y la letra a
 * mano; y la confianza, para marcar qué se leyó con claridad y qué no.
 */
export async function leerImagenConCajas(dataUrl: string): Promise<LecturaConCajas> {
  try {
    const r = await LectorTexto.leer({ image: dataUrl });
    return {
      ancho: r.ancho,
      alto: r.alto,
      ms: r.ms,
      lector: "posiciones",
      lineas: r.lineas
        .filter((l) => typeof l.texto === "string")
        .map((l) => ({
          texto: l.texto,
          x: l.x ?? 0,
          y: l.y ?? 0,
          w: l.w ?? 0,
          h: l.h ?? 0,
          confianza: typeof l.confianza === "number" ? l.confianza : null,
        })),
    };
  } catch {
    const { Ocr } = await cargarRespaldo();
    const { results } = await Ocr.process({ image: dataUrl });
    return {
      ancho: 0,
      alto: 0,
      ms: null,
      lector: "solo-texto",
      lineas: results.map((r) => ({ texto: r.text, x: 0, y: 0, w: 0, h: 0, confianza: null })),
    };
  }
}
