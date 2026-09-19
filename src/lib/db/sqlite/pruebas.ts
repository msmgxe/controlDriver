/**
 * Las capturas que respaldan cada jornada.
 *
 * La especificación pedía descartarlas tras leerlas (§7), y era lo correcto
 * mientras viajaban a un servidor ajeno: guardar fotos de otra persona en una
 * máquina que no es suya es una responsabilidad que no hacía falta asumir.
 *
 * Dentro del APK la situación es otra. Las imágenes no salen del teléfono, y
 * cubren algo que ninguna otra cosa cubre: **si la tienda discute un pago, la
 * captura original es la prueba**. Eso vale más que el espacio que ocupan.
 *
 * Dónde viven: en el directorio privado de la aplicación. No aparecen en la
 * galería, ninguna otra app las ve, y desinstalar Rutas-A se las lleva. Se
 * pueden borrar una a una o el día entero.
 */
import { Directory, Filesystem } from "@capacitor/filesystem";

import { consultar, ejecutar, nuevoId } from "./conexion";
import type { FechaISO } from "@/lib/fechas";

const CARPETA = "pruebas";

export interface Prueba {
  id: string;
  fecha: FechaISO;
  archivo: string;
  bytes: number;
  creadoEn: string;
}

/**
 * Guarda una imagen como prueba, **si no está ya**. Devuelve su id, o el de la
 * que ya estaba.
 *
 * Subir el mismo día dos veces es lo más normal —se prueba, se corrige, se
 * vuelve a subir—, y cada vez se guardaban todas las capturas de nuevo: once
 * capturas subidas tres veces eran 33. Se evitan dos clases de repetición:
 *
 *   · **idénticas**: la misma captura otra vez. Se reconoce por la huella de
 *     sus bytes.
 *   · **redundantes**: una captura distinta pero que no aporta nada, porque
 *     todo lo que se leyó en ella —códigos y horarios— ya está en otra del
 *     mismo día. Pasa al volver a fotografiar la misma parte de la lista.
 *
 * `ordenId` la ata a un pedido concreto —la foto de un pedido a mano—; sin él,
 * respalda el día entero.
 */
export async function guardarPrueba(
  fecha: FechaISO,
  imagen: Blob,
  ordenId?: string,
  contenido: readonly string[] = [],
): Promise<string> {
  const huella = await huellaDe(await imagen.arrayBuffer());

  const identica = await consultar<{ id: string }>(
    `select id from pruebas where fecha = ? and huella = ? limit 1`,
    [fecha, huella],
  );
  if (identica[0]) return identica[0].id;

  if (!ordenId && contenido.length > 0) {
    const yaVisto = await contenidoDelDia(fecha);
    const aportaAlgo = contenido.some((c) => !yaVisto.has(c));
    if (!aportaAlgo) return "";
  }

  const id = nuevoId();
  const archivo = `${CARPETA}/${fecha}/${id}.jpg`;

  await Filesystem.writeFile({
    path: archivo,
    data: await aBase64(imagen),
    directory: Directory.Data,
    recursive: true,
  });

  await ejecutar(
    `insert into pruebas (id, fecha, orden_id, archivo, bytes, huella, contenido, creado_en)
     values (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id, fecha, ordenId ?? null, archivo, imagen.size, huella,
      contenido.length > 0 ? JSON.stringify(contenido) : null,
      new Date().toISOString(),
    ],
  );
  return id;
}

/** Las pruebas de un día, de la más antigua a la más reciente. */
export async function pruebasDelDia(fecha: FechaISO): Promise<Prueba[]> {
  const filas = await consultar<{
    id: string;
    fecha: string;
    archivo: string;
    bytes: number;
    creado_en: string;
  }>(
    `select id, fecha, archivo, bytes, creado_en from pruebas
      where fecha = ? order by creado_en asc`,
    [fecha],
  );
  return filas.map((f) => ({
    id: f.id,
    fecha: f.fecha as FechaISO,
    archivo: f.archivo,
    bytes: f.bytes,
    creadoEn: f.creado_en,
  }));
}

/**
 * La imagen, lista para pintar en un `<img>`.
 *
 * Se devuelve como texto en base64 y no como una ruta de archivo porque el
 * navegador que va dentro de la aplicación no puede abrir rutas del sistema
 * directamente: se lo impide su propio aislamiento, y está bien que sea así.
 */
export async function contenidoDePrueba(archivo: string): Promise<string | null> {
  try {
    const { data } = await Filesystem.readFile({ path: archivo, directory: Directory.Data });
    return `data:image/jpeg;base64,${typeof data === "string" ? data : ""}`;
  } catch {
    return null;
  }
}

/** Borra una prueba: primero el archivo, luego su fila. */
export async function borrarPrueba(id: string): Promise<void> {
  const filas = await consultar<{ archivo: string }>(
    `select archivo from pruebas where id = ?`,
    [id],
  );
  if (filas[0]) {
    try {
      await Filesystem.deleteFile({ path: filas[0].archivo, directory: Directory.Data });
    } catch {
      /* Si el archivo ya no está, la fila sobra igual. */
    }
  }
  await ejecutar(`delete from pruebas where id = ?`, [id]);
}

/** Todo lo que ya respaldan las capturas guardadas de un día. */
async function contenidoDelDia(fecha: FechaISO): Promise<Set<string>> {
  const filas = await consultar<{ contenido: string | null }>(
    `select contenido from pruebas where fecha = ? and contenido is not null`,
    [fecha],
  );
  const visto = new Set<string>();
  for (const f of filas) {
    try {
      for (const c of JSON.parse(f.contenido as string) as string[]) visto.add(c);
    } catch {
      /* Una fila rota no impide mirar las demás. */
    }
  }
  return visto;
}

/**
 * Quita las capturas repetidas de un día, dejando la más antigua de cada una.
 *
 * Arregla lo que se guardó antes de que existiera la huella. Solo borra
 * capturas **idénticas byte a byte** a otra que se queda, así que no se pierde
 * nada. Devuelve cuántas quitó.
 */
export async function quitarRepetidas(fecha: FechaISO): Promise<number> {
  const filas = await consultar<{ id: string; archivo: string; huella: string | null }>(
    `select id, archivo, huella from pruebas where fecha = ? order by creado_en asc`,
    [fecha],
  );

  const vistas = new Set<string>();
  let quitadas = 0;

  for (const fila of filas) {
    let huella = fila.huella;
    if (!huella) {
      try {
        const { data } = await Filesystem.readFile({ path: fila.archivo, directory: Directory.Data });
        huella = await huellaDe(deBase64(typeof data === "string" ? data : ""));
        await ejecutar(`update pruebas set huella = ? where id = ?`, [huella, fila.id]);
      } catch {
        continue; // Sin poder leerla no se puede comparar: se deja.
      }
    }

    if (vistas.has(huella)) {
      await borrarPrueba(fila.id);
      quitadas++;
    } else {
      vistas.add(huella);
    }
  }
  return quitadas;
}

async function huellaDe(bytes: ArrayBuffer | Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", bytes as BufferSource);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function deBase64(texto: string): Uint8Array {
  const binario = atob(texto);
  return Uint8Array.from(binario, (c) => c.charCodeAt(0));
}

/** Borra todas las pruebas de un día. */
export async function borrarPruebasDelDia(fecha: FechaISO): Promise<void> {
  for (const prueba of await pruebasDelDia(fecha)) {
    await borrarPrueba(prueba.id);
  }
}

/** Cuánto ocupan todas las pruebas guardadas. Para poder decidir si conviene limpiar. */
export async function espacioOcupado(): Promise<{ cuantas: number; bytes: number }> {
  const filas = await consultar<{ cuantas: number; bytes: number }>(
    `select count(*) as cuantas, coalesce(sum(bytes), 0) as bytes from pruebas`,
  );
  return { cuantas: filas[0]?.cuantas ?? 0, bytes: filas[0]?.bytes ?? 0 };
}

function aBase64(blob: Blob): Promise<string> {
  return new Promise((resolver, rechazar) => {
    const lector = new FileReader();
    lector.onload = () => {
      const texto = String(lector.result);
      // `readAsDataURL` devuelve `data:image/jpeg;base64,XXXX`; aquí solo hace
      // falta la parte de después de la coma.
      resolver(texto.slice(texto.indexOf(",") + 1));
    };
    lector.onerror = () => rechazar(new Error("No se pudo leer la imagen."));
    lector.readAsDataURL(blob);
  });
}
