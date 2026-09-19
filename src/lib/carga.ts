/**
 * Flujo de carga de capturas (§4).
 *
 * Vive aparte porque hay dos puertas de entrada: el botón «Cargar capturas» de
 * Hoy y el destino de compartir de Android (galería → Compartir → Rutas-A).
 * Las dos hacen exactamente lo mismo a partir de aquí.
 */

export const CLAVE_REVISION = "rutas-a.revision";

const LADO_MAYOR = 1600;
const CALIDAD = 0.8;
export const MAX_IMAGENES = 12;

/**
 * Reduce la imagen y la vuelve a dibujar en un canvas.
 *
 * El redibujado es lo que borra el EXIF: `toBlob` escribe un JPEG nuevo a
 * partir de los píxeles, sin ninguno de los metadatos del original —incluida la
 * ubicación GPS, que no tiene por qué salir del celular.
 */
export async function comprimir(archivo: Blob): Promise<Blob> {
  const bitmap = await createImageBitmap(archivo);
  const escala = Math.min(1, LADO_MAYOR / Math.max(bitmap.width, bitmap.height));
  const ancho = Math.round(bitmap.width * escala);
  const alto = Math.round(bitmap.height * escala);

  const lienzo = document.createElement("canvas");
  lienzo.width = ancho;
  lienzo.height = alto;
  const ctx = lienzo.getContext("2d");
  if (!ctx) {
    bitmap.close();
    return archivo;
  }
  ctx.drawImage(bitmap, 0, 0, ancho, alto);
  bitmap.close();

  const blob = await new Promise<Blob | null>((resolver) =>
    lienzo.toBlob(resolver, "image/jpeg", CALIDAD),
  );
  return blob ?? archivo;
}

export type ResultadoCarga = { ok: true } | { ok: false; error: string };

/**
 * Comprime, lee y deja el resultado listo para Revisión.
 *
 * Todo ocurre dentro del teléfono: las imágenes no salen de aquí, no hace
 * falta señal y no cuesta nada. Antes esto subía las fotos a un servidor que
 * se las pasaba a un modelo de visión.
 *
 * El resultado viaja por `sessionStorage` y no por la URL: son catorce pedidos
 * con sus códigos, y no queremos códigos de pedido en el historial del
 * navegador (§7).
 */
export async function procesarCapturas(
  archivos: Blob[],
  alComprimir?: (listas: number) => void,
): Promise<ResultadoCarga> {
  if (archivos.length === 0) {
    return { ok: false, error: "No llegó ninguna imagen." };
  }
  if (archivos.length > MAX_IMAGENES) {
    return { ok: false, error: `Elige como máximo ${MAX_IMAGENES} capturas por carga.` };
  }

  const { lecturaDisponible, leerCapturas } = await import("@/lib/extraccion/enDispositivo");

  /* El lector de texto es de Android: en el navegador no existe. Se dice claro
     en vez de fallar con un error técnico que no orienta a nadie. */
  if (!lecturaDisponible()) {
    return {
      ok: false,
      error: "Leer capturas solo funciona en la app instalada, no en el navegador.",
    };
  }

  try {
    const comprimidas: Blob[] = [];
    for (const archivo of archivos) {
      comprimidas.push(await comprimir(archivo));
      alComprimir?.(comprimidas.length);
    }

    const datos = await leerCapturas(comprimidas);

    if (datos.dias.length === 0) {
      return {
        ok: false,
        error:
          "No se reconoció ninguna captura. Asegúrate de que son pantallazos de las pestañas Rutas u Órdenes, sin recortar.",
      };
    }

    try {
      sessionStorage.setItem(CLAVE_REVISION, JSON.stringify(datos));
    } catch {
      return {
        ok: false,
        error: "Tu navegador no permite guardar datos temporales. Prueba fuera del modo privado.",
      };
    }
    return { ok: true };
  } catch (fallo) {
    return {
      ok: false,
      error: fallo instanceof Error ? fallo.message : "No se pudieron leer las capturas.",
    };
  }
}

/**
 * Recoge las capturas que dejó el service worker al compartir desde la galería.
 *
 * Se vacía la caché al leerla: si el driver cancela la revisión, no queremos
 * que la próxima vez le aparezcan las fotos de ayer.
 */
export async function recogerCompartidas(): Promise<Blob[]> {
  if (!("caches" in window)) return [];
  try {
    const cache = await caches.open("rutas-a-compartido");
    const claves = await cache.keys();
    const blobs: Blob[] = [];
    for (const clave of claves) {
      const respuesta = await cache.match(clave);
      if (respuesta) blobs.push(await respuesta.blob());
    }
    await Promise.all(claves.map((c) => cache.delete(c)));
    return blobs;
  } catch {
    return [];
  }
}
