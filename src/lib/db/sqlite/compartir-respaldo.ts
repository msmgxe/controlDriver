/**
 * Crear el archivo de respaldo y entregarlo al selector de «compartir» de
 * Android (Drive, WhatsApp, correo…). Lo usan Ajustes y el recordatorio de
 * Inicio: es la misma acción, con un solo código.
 */
import { leerAjustesDeComandas } from "./ajustes";
import { anotarRespaldoCreado, crearRespaldo } from "./respaldo";
import { hoyEnLima } from "@/lib/fechas";

/** Lanza un `Error` con un mensaje legible si no se pudo. Termina cuando la persona cierra el selector. */
export async function crearYCompartirRespaldo(etiqueta = "", incluirImagenes = true): Promise<void> {
  const { Capacitor } = await import("@capacitor/core");
  if (!Capacitor.isNativePlatform()) {
    throw new Error("Crear y compartir el respaldo solo funciona en la app instalada.");
  }

  // Nombres, teléfonos y direcciones de clientes: solo si la persona lo eligió.
  const { clientesEnRespaldo } = await leerAjustesDeComandas();
  const respaldo = await crearRespaldo({ incluirClientes: clientesEnRespaldo, etiqueta, incluirImagenes });
  const contenido = JSON.stringify(respaldo, null, 2);
  const limpio = etiqueta.trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40);
  const archivo = `control-driver-respaldo${limpio ? `-${limpio}` : ""}-${hoyEnLima()}.json`;

  const { Filesystem, Directory, Encoding } = await import("@capacitor/filesystem");
  const { Share } = await import("@capacitor/share");

  await Filesystem.writeFile({ path: archivo, data: contenido, directory: Directory.Cache, encoding: Encoding.UTF8 });
  const { uri } = await Filesystem.getUri({ path: archivo, directory: Directory.Cache });

  await Share.share({ title: "Respaldo de Control Driver", url: uri });
  await anotarRespaldoCreado();
}
