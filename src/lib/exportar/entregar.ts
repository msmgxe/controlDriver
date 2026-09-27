/**
 * Entregar un archivo generado en el teléfono: que se **vea** y que se **guarde**.
 *
 * Dentro del APK el navegador no descarga (un enlace con `download` no hace
 * nada) y su «compartir» no admite archivos. Así que el PDF y el Excel se
 * generaban y no salían por ningún lado, sin ningún aviso. Aquí el archivo se
 * escribe en la caché de la app con el plugin de `Filesystem`, y desde ahí se
 * ofrecen tres cosas:
 *
 *   · **ver** —lo abre la app que tenga el teléfono para ese tipo—;
 *   · **guardar** —lo deja en Descargas/Control Driver—;
 *   · **compartir** —el selector de Android: WhatsApp, correo, Drive—.
 *
 * En el navegador, donde sí se puede, se comparte o se descarga como siempre.
 */
import { Capacitor, registerPlugin } from "@capacitor/core";

interface ArchivosPlugin {
  abrir(opciones: { nombre: string; tipo: string }): Promise<void>;
  guardarEnDescargas(opciones: { nombre: string; tipo: string }): Promise<{ carpeta: string; nombre: string }>;
}

const Archivos = registerPlugin<ArchivosPlugin>("Archivos");

/** Un archivo ya escrito en el teléfono, listo para ver, guardar o compartir. */
export interface ArchivoListo {
  nombre: string;
  tipo: string;
  /** Dónde quedó, para el selector de compartir de Android. */
  uri: string;
}

const TIPOS: Record<string, string> = {
  pdf: "application/pdf",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  json: "application/json",
};

/** El tipo de un archivo por su extensión. */
export function tipoDeArchivo(nombre: string, respaldo = "application/octet-stream"): string {
  const extension = nombre.split(".").pop()?.toLowerCase() ?? "";
  return TIPOS[extension] ?? respaldo;
}

function aBase64(blob: Blob): Promise<string> {
  return new Promise((resolver, rechazar) => {
    const lector = new FileReader();
    lector.onload = () => {
      const texto = String(lector.result);
      // `readAsDataURL` devuelve `data:...;base64,XXXX`: aquí solo hace falta lo de después de la coma.
      resolver(texto.slice(texto.indexOf(",") + 1));
    };
    lector.onerror = () => rechazar(new Error("No se pudo leer el archivo."));
    lector.readAsDataURL(blob);
  });
}

/**
 * Deja el archivo listo.
 *
 * En el teléfono lo escribe y devuelve cómo enseñarlo (`ArchivoListo`). En el
 * navegador lo comparte o lo descarga directamente y devuelve `null`: ahí no
 * hay nada más que ofrecer.
 */
export async function prepararArchivo(blob: Blob, nombre: string): Promise<ArchivoListo | null> {
  const tipo = blob.type || tipoDeArchivo(nombre);

  if (!Capacitor.isNativePlatform()) {
    await entregarEnNavegador(blob, nombre, tipo);
    return null;
  }

  const { Filesystem, Directory } = await import("@capacitor/filesystem");
  await Filesystem.writeFile({ path: nombre, data: await aBase64(blob), directory: Directory.Cache });
  const { uri } = await Filesystem.getUri({ path: nombre, directory: Directory.Cache });
  return { nombre, tipo, uri };
}

/** Lo abre con la app del teléfono que sepa hacerlo. */
export async function verArchivo(a: ArchivoListo): Promise<void> {
  await Archivos.abrir({ nombre: a.nombre, tipo: a.tipo });
}

/** Lo deja en Descargas. Devuelve la carpeta, para decírselo a la persona. */
export async function guardarArchivo(a: ArchivoListo): Promise<string> {
  const { carpeta } = await Archivos.guardarEnDescargas({ nombre: a.nombre, tipo: a.tipo });
  return carpeta;
}

/** Abre el selector de compartir de Android. Cancelarlo no es un error. */
export async function compartirArchivo(a: ArchivoListo): Promise<void> {
  const { Share } = await import("@capacitor/share");
  try {
    await Share.share({ title: a.nombre, url: a.uri });
  } catch (e) {
    if (e instanceof Error && /cancel/i.test(e.message)) return;
    throw e;
  }
}

/** Comparte si el navegador puede con archivos, y si no, descarga. */
async function entregarEnNavegador(blob: Blob, nombre: string, tipo: string): Promise<void> {
  const archivo = new File([blob], nombre, { type: tipo });

  if (navigator.canShare?.({ files: [archivo] })) {
    try {
      await navigator.share({ files: [archivo], title: nombre });
      return;
    } catch (e) {
      // Cancelar el diálogo de compartir no es un error: se sale sin descargar.
      if (e instanceof DOMException && e.name === "AbortError") return;
      // Cualquier otro fallo cae a la descarga de toda la vida.
    }
  }

  const url = URL.createObjectURL(blob);
  const enlace = document.createElement("a");
  enlace.href = url;
  enlace.download = nombre;
  document.body.appendChild(enlace);
  enlace.click();
  enlace.remove();
  // Se libera después para no cortar la descarga mientras arranca.
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
