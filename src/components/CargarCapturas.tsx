"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { Alerta, Check, Subir } from "@/components/iconos";

/**
 * Carga diaria (§4).
 *
 * El cliente comprime cada imagen antes de subirla: lado mayor 1600 px, JPEG
 * 0.8, y se redibuja en un canvas, lo que de paso **elimina los metadatos
 * EXIF** — incluida la ubicación GPS, que no tiene por qué salir del celular.
 *
 * El resultado de la extracción viaja a Revisión por `sessionStorage` en vez de
 * por la URL: son catorce pedidos con sus códigos, y no queremos códigos de
 * pedido en el historial del navegador ni en los registros del servidor (§7).
 */

export const CLAVE_REVISION = "rutalog.revision";

const LADO_MAYOR = 1600;
const CALIDAD = 0.8;
const MAX_IMAGENES = 12;

type Fase = "reposo" | "comprimiendo" | "leyendo" | "error";

export function CargarCapturas({ deshabilitado }: { deshabilitado?: boolean }) {
  const router = useRouter();
  const entrada = useRef<HTMLInputElement>(null);
  const [fase, setFase] = useState<Fase>("reposo");
  const [listas, setListas] = useState(0);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState<string | null>(null);

  async function alElegir(e: React.ChangeEvent<HTMLInputElement>) {
    const archivos = Array.from(e.target.files ?? []);
    if (archivos.length === 0) return;

    if (archivos.length > MAX_IMAGENES) {
      setFase("error");
      setError(`Elige como máximo ${MAX_IMAGENES} capturas por carga.`);
      return;
    }

    setTotal(archivos.length);
    setListas(0);
    setError(null);
    setFase("comprimiendo");

    try {
      const cuerpo = new FormData();
      for (const archivo of archivos) {
        const comprimida = await comprimir(archivo);
        cuerpo.append("imagenes", comprimida, archivo.name.replace(/\.\w+$/, ".jpg"));
        setListas((n) => n + 1);
      }

      setFase("leyendo");
      const respuesta = await fetch("/api/extraer", { method: "POST", body: cuerpo });
      const datos = await respuesta.json();

      if (!respuesta.ok) {
        setFase("error");
        setError(datos.error ?? "No se pudo procesar la carga.");
        return;
      }

      try {
        sessionStorage.setItem(CLAVE_REVISION, JSON.stringify(datos));
      } catch {
        setFase("error");
        setError("Tu navegador no permite guardar datos temporales. Prueba fuera del modo privado.");
        return;
      }
      router.push("/revision");
    } catch {
      setFase("error");
      setError("Necesitas conexión para procesar las fotos. Tus capturas siguen en la galería.");
    } finally {
      if (entrada.current) entrada.current.value = "";
    }
  }

  const trabajando = fase === "comprimiendo" || fase === "leyendo";

  return (
    <div className="flex flex-col gap-3">
      <input
        ref={entrada}
        id="capturas"
        type="file"
        accept="image/jpeg,image/png,image/webp"
        multiple
        className="sr-only"
        onChange={(e) => void alElegir(e)}
      />

      <button
        type="button"
        className="boton-principal"
        disabled={deshabilitado || trabajando}
        onClick={() => entrada.current?.click()}
      >
        <Subir className="size-[22px]" />
        {trabajando ? "Procesando…" : "Cargar capturas"}
      </button>

      {trabajando && (
        <div className="tarjeta flex flex-col gap-3" role="status" aria-live="polite">
          <div>
            <h2 className="text-lg">
              {fase === "comprimiendo" ? "Preparando las fotos" : "Leyendo capturas"}
            </h2>
            <p className="text-sm text-tinta-2">
              {fase === "comprimiendo"
                ? `${listas} de ${total} listas`
                : `${total} capturas en camino. Tarda unos segundos.`}
            </p>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-sup-2">
            <span
              className="block h-full rounded-full bg-acento transition-[width] duration-300"
              style={{ width: fase === "leyendo" ? "100%" : `${(listas / total) * 100}%` }}
            />
          </div>
          {fase === "comprimiendo" && (
            <ul className="flex flex-col gap-2">
              {Array.from({ length: total }, (_, i) => (
                <li
                  key={i}
                  className={`flex items-center gap-2 text-sm ${
                    i < listas ? "text-tinta" : "text-tinta-3"
                  }`}
                >
                  {i < listas ? (
                    <Check className="size-4 text-bien" />
                  ) : (
                    <span className="size-4 rounded-full border border-linea-fuerte" />
                  )}
                  Captura {i + 1}
                </li>
              ))}
            </ul>
          )}
          <p className="text-xs text-tinta-3">
            Las fotos se procesan y se descartan. No se guardan en ningún servidor.
          </p>
        </div>
      )}

      {fase === "error" && error && (
        <div className="flex gap-3 rounded-btn bg-mal-suave px-4 py-3 text-sm text-mal">
          <Alerta className="mt-0.5 size-[18px] shrink-0" />
          <div>
            <strong className="block font-bold">No se pudo cargar</strong>
            <p>{error}</p>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Reduce la imagen y la vuelve a dibujar en un canvas.
 *
 * El redibujado es lo que borra el EXIF: `toBlob` escribe un JPEG nuevo a
 * partir de los píxeles, sin ninguno de los metadatos del original.
 */
async function comprimir(archivo: File): Promise<Blob> {
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
