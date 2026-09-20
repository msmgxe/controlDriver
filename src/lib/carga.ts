/**
 * Flujo de carga de capturas (§4).
 *
 * Vive aparte porque hay dos puertas de entrada: el botón «Cargar capturas» de
 * Hoy y el destino de compartir de Android (galería → Compartir → Rutas-A).
 * Las dos hacen exactamente lo mismo a partir de aquí.
 */

export const CLAVE_REVISION = "rutas-a.revision";

/**
 * Hasta qué tamaño se **lee** una captura.
 *
 * Antes era 1600 px, y era un error: ese límite venía de cuando las capturas
 * se mandaban a un modelo en la nube, donde cada píxel costaba dinero. Leyendo
 * en el propio teléfono no cuesta nada, y reducir hace daño: una captura de
 * 2712 px de alto se leía al 59 %, y las etiquetas grises pequeñas —«Ruta 1»—
 * se volvían ilegibles. Con 3200 px, una captura de pantalla se lee entera, a
 * su tamaño real. Solo se reduce una foto de cámara enorme, para no agotar la
 * memoria del teléfono.
 */
const LADO_LECTURA = 3200;

/** Hasta qué tamaño se **guarda** una captura como prueba: para verla basta. */
const LADO_PRUEBA = 1600;
const CALIDAD = 0.8;

/**
 * Cuántas capturas por carga.
 *
 * Eran 12, un tope pensado para acotar lo que costaba el modelo en la nube.
 * Con el lector del teléfono no cuesta nada, y una semana entera de capturas
 * pasa de 12 con facilidad. Queda un tope solo para que la lectura no se haga
 * eterna.
 */
export const MAX_IMAGENES = 24;

/**
 * Reduce la imagen y la vuelve a dibujar en un canvas.
 *
 * El redibujado es lo que borra el EXIF: `toBlob` escribe un JPEG nuevo a
 * partir de los píxeles, sin ninguno de los metadatos del original —incluida la
 * ubicación GPS, que no tiene por qué salir del celular.
 */
export async function comprimir(archivo: Blob, ladoMayor = LADO_PRUEBA): Promise<Blob> {
  const bitmap = await createImageBitmap(archivo);
  const escala = Math.min(1, ladoMayor / Math.max(bitmap.width, bitmap.height));
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

/**
 * La imagen tal cual para leerla, salvo que sea enorme.
 *
 * Una captura de pantalla pasa sin tocar: ni se reduce ni se vuelve a
 * comprimir, que es lo que mejor lee el lector —cada recompresión JPEG
 * emborrona un poco las letras pequeñas—.
 */
export async function paraLeer(archivo: Blob): Promise<Blob> {
  try {
    const bitmap = await createImageBitmap(archivo);
    const lado = Math.max(bitmap.width, bitmap.height);
    bitmap.close();
    return lado <= LADO_LECTURA ? archivo : await comprimir(archivo, LADO_LECTURA);
  } catch {
    return archivo;
  }
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

  // Dentro de su propio try: si esto fallaba, el error se escapaba sin que
  // nadie lo recogiera y la pantalla se quedaba en "Leyendo capturas…".
  let lector: typeof import("@/lib/extraccion/enDispositivo");
  try {
    lector = await import("@/lib/extraccion/enDispositivo");
  } catch (fallo) {
    return {
      ok: false,
      error: `No se pudo cargar el lector de capturas. Detalle: ${
        fallo instanceof Error ? fallo.message : String(fallo)
      }`,
    };
  }
  const { lecturaDisponible, leerCapturas } = lector;

  /* El lector de texto es de Android: en el navegador no existe. Se dice claro
     en vez de fallar con un error técnico que no orienta a nadie. */
  if (!lecturaDisponible()) {
    return {
      ok: false,
      error: "Leer capturas solo funciona en la app instalada, no en el navegador.",
    };
  }

  /* En el orden en que se **tomaron**, no en el que llegan.

     El selector de fotos de Android no respeta el orden de captura: según el
     teléfono las devuelve por selección, por nombre o de la más nueva a la más
     vieja. Y el orden importa dos veces: una captura sin cabecera pertenece al
     último día visto antes que ella, y una captura que empieza a mitad de una
     ruta hereda la ruta de la anterior. Ordenar mal repartía los pedidos en el
     día equivocado.

     La hora de la captura va en el propio archivo. Se ordena aquí, antes de
     comprimir, porque la imagen comprimida es un archivo nuevo y ya no la
     lleva. */
  const enOrden = [...archivos].sort(
    (a, b) => ((a as File).lastModified ?? 0) - ((b as File).lastModified ?? 0),
  );

  try {
    /* Cada captura en dos tamaños: la de **leer**, a resolución completa, y
       la de **guardar** como prueba, reducida. La de leer nunca se guarda. */
    const capturas: Array<{ lectura: Blob; prueba: Blob }> = [];
    for (const archivo of enOrden) {
      capturas.push({
        lectura: await paraLeer(archivo),
        prueba: await comprimir(archivo, LADO_PRUEBA),
      });
      alComprimir?.(capturas.length);
    }

    const datos = await leerCapturas(capturas);

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
      error: `No se pudieron leer las capturas. Detalle: ${
        fallo instanceof Error ? fallo.message : String(fallo)
      }`,
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
