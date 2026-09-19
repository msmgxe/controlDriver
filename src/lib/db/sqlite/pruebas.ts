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
 * Guarda una imagen como prueba. Devuelve su id.
 *
 * `ordenId` la ata a un pedido concreto —el caso de la foto que se saca al
 * añadir un pedido a mano—; sin él, respalda el día entero, que es lo que
 * hacen las capturas de la carga.
 */
export async function guardarPrueba(
  fecha: FechaISO,
  imagen: Blob,
  ordenId?: string,
): Promise<string> {
  const id = nuevoId();
  const archivo = `${CARPETA}/${fecha}/${id}.jpg`;

  await Filesystem.writeFile({
    path: archivo,
    data: await aBase64(imagen),
    directory: Directory.Data,
    recursive: true,
  });

  await ejecutar(
    `insert into pruebas (id, fecha, orden_id, archivo, bytes, creado_en)
     values (?, ?, ?, ?, ?, ?)`,
    [id, fecha, ordenId ?? null, archivo, imagen.size, new Date().toISOString()],
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
