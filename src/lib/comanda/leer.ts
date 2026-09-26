/**
 * De una foto a las comandas que trae.
 *
 * Junta las piezas: la foto se prepara (`paraLeer`), el lector del teléfono la
 * lee **con posiciones**, el intérprete saca los datos, y cada hoja queda con
 * su evidencia lista para guardarse —la foto entera si trae una sola hoja, o un
 * recorte de su franja si trae varias—.
 *
 * Todo ocurre en el teléfono y sin internet. Lo único que necesita señal viene
 * después: buscar la dirección en el mapa.
 */
import { comprimir, paraLeer } from "@/lib/carga";
import { consultar, ejecutar } from "@/lib/db/sqlite/conexion";
import { leerImagenConCajas } from "@/lib/extraccion/lectorTexto";

import { interpretarComandas, type ComandaLeida } from "./interpretar";

export interface HojaLeida {
  comanda: ComandaLeida;
  /** La imagen que respaldará el pedido, ya comprimida y sin EXIF. Se prepara al pedirla. */
  evidencia: () => Promise<Blob>;
}

export interface FotoLeida {
  hojas: HojaLeida[];
  lector: "posiciones" | "solo-texto";
}

const LADO_EVIDENCIA = 1600;

function aDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolver, rechazar) => {
    const lector = new FileReader();
    lector.onload = () => resolver(String(lector.result));
    lector.onerror = () => rechazar(new Error("No se pudo leer la imagen."));
    lector.readAsDataURL(blob);
  });
}

/**
 * Un recorte horizontal de la foto, de `desde` a `hasta` píxeles de alto (en el
 * tamaño en que se leyó). Redibujar en un canvas también borra el EXIF.
 */
async function recortar(archivo: Blob, franja: { desde: number; hasta: number }, altoLeido: number): Promise<Blob> {
  const bitmap = await createImageBitmap(archivo);
  try {
    const k = altoLeido > 0 ? bitmap.height / altoLeido : 1;
    const y0 = Math.max(0, Math.min(bitmap.height - 1, Math.round(franja.desde * k)));
    const y1 = Math.max(y0 + 1, Math.min(bitmap.height, Math.round(franja.hasta * k)));
    const alto = y1 - y0;
    const escala = Math.min(1, LADO_EVIDENCIA / Math.max(bitmap.width, alto));

    const lienzo = document.createElement("canvas");
    lienzo.width = Math.round(bitmap.width * escala);
    lienzo.height = Math.round(alto * escala);
    const ctx = lienzo.getContext("2d");
    if (!ctx) return archivo;
    ctx.drawImage(bitmap, 0, y0, bitmap.width, alto, 0, 0, lienzo.width, lienzo.height);

    const blob = await new Promise<Blob | null>((resolver) => lienzo.toBlob(resolver, "image/jpeg", 0.8));
    return blob ?? archivo;
  } finally {
    bitmap.close();
  }
}

/** Lee una foto y devuelve una hoja por cada comanda que trae (siempre al menos una). */
export async function leerFotoDeComandas(archivo: Blob): Promise<FotoLeida> {
  const paraElLector = await paraLeer(archivo);
  const lectura = await leerImagenConCajas(await aDataUrl(paraElLector));

  await guardarDiagnostico([
    `── ${lectura.lector}${lectura.ms !== null ? ` · ${lectura.ms} ms` : ""} · ${lectura.ancho}×${lectura.alto} ──`,
    ...lectura.lineas.map(
      (l) => `${l.x},${l.y},${l.w},${l.h}|${l.confianza === null ? "?" : l.confianza.toFixed(2)}|${l.texto}`,
    ),
  ]);

  const comandas = interpretarComandas(lectura.lineas, { ancho: lectura.ancho, alto: lectura.alto });

  let entera: Promise<Blob> | null = null;
  return {
    lector: lectura.lector,
    hojas: comandas.map((comanda) => {
      let propia: Promise<Blob> | null = null;
      return {
        comanda,
        evidencia: () => {
          if (comanda.franja) {
            propia ??= recortar(archivo, comanda.franja, lectura.alto);
            return propia;
          }
          entera ??= comprimir(archivo, LADO_EVIDENCIA);
          return entera;
        },
      };
    }),
  };
}

/* ---------------------------------------------------------------------------
 * Diagnóstico
 * ------------------------------------------------------------------------- */

const CLAVE_DIAGNOSTICO = "comandas.ultima-lectura";

/**
 * Guarda lo que devolvió el lector en la última foto de comanda.
 *
 * Como con las capturas, es lo único que permite arreglar una lectura que salió
 * mal: cada disposición de hoja y cada teléfono se comportan distinto, y sin
 * ver el texto crudo, con sus posiciones, arreglarlo a distancia es adivinar.
 * Ajustes lo enseña y permite copiarlo. Guarda **solo la última**.
 */
async function guardarDiagnostico(lineas: readonly string[]): Promise<void> {
  try {
    await ejecutar(
      `insert into ajustes (clave, valor) values (?, ?)
       on conflict (clave) do update set valor = excluded.valor`,
      [CLAVE_DIAGNOSTICO, lineas.join("\n")],
    );
  } catch {
    /* Es una ayuda: si falla, no puede tumbar la lectura. */
  }
}

/** El texto crudo de la última foto de comanda, o null si todavía no se leyó ninguna. */
export async function ultimaLecturaDeComanda(): Promise<string | null> {
  try {
    const filas = await consultar<{ valor: string }>(`select valor from ajustes where clave = ?`, [CLAVE_DIAGNOSTICO]);
    return filas[0]?.valor ?? null;
  } catch {
    return null;
  }
}
