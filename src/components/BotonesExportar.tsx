"use client";

import { useState } from "react";

import { Alerta, Hoja } from "@/components/iconos";
import { nombreArchivo, type DatosExportacion } from "@/lib/exportar/datos";

/**
 * Exportar el rango a Excel o PDF (§11).
 *
 * Todo ocurre en el celular: las librerías se cargan solo al pulsar —pesan casi
 * un mega entre las dos y no tienen por qué estar en el arranque de la app— y
 * el archivo se arma en memoria.
 *
 * Tras generar se ofrece **compartir** antes que descargar: en Android es lo
 * que lleva el archivo a WhatsApp, al correo o a Drive de un toque, que es lo
 * que se hace de verdad con él.
 */
export function BotonesExportar({ datos }: { datos: DatosExportacion }) {
  const [trabajando, setTrabajando] = useState<"excel" | "pdf" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const vacio = datos.jornadas.length === 0;

  async function exportar(formato: "excel" | "pdf") {
    setTrabajando(formato);
    setError(null);
    try {
      const { blob, nombre } =
        formato === "excel"
          ? {
              blob: await (await import("@/lib/exportar/excel")).generarExcel(datos),
              nombre: nombreArchivo(datos, "xlsx"),
            }
          : {
              blob: await (await import("@/lib/exportar/pdf")).generarPdf(datos),
              nombre: nombreArchivo(datos, "pdf"),
            };

      await entregar(blob, nombre);
    } catch (e) {
      setError(
        e instanceof Error
          ? `No se pudo generar el archivo: ${e.message}`
          : "No se pudo generar el archivo.",
      );
    } finally {
      setTrabajando(null);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className="boton-sec flex-1"
          disabled={vacio || trabajando !== null}
          onClick={() => void exportar("excel")}
        >
          <Hoja className="size-4" />
          {trabajando === "excel" ? "Generando…" : "Exportar Excel"}
        </button>
        <button
          type="button"
          className="boton-sec flex-1"
          disabled={vacio || trabajando !== null}
          onClick={() => void exportar("pdf")}
        >
          <Hoja className="size-4" />
          {trabajando === "pdf" ? "Generando…" : "Exportar PDF"}
        </button>
      </div>

      {error && (
        <p className="flex items-center gap-2 text-sm font-semibold text-mal">
          <Alerta className="size-4 shrink-0" />
          {error}
        </p>
      )}

      <p className="text-xs text-tinta-3">
        Se genera en tu celular con lo que ves filtrado en pantalla. El Excel lleva todo el dato
        del rango; el PDF es el que se enseña cuando un pago no cuadra.
      </p>
    </div>
  );
}

/**
 * Comparte el archivo si el equipo puede, y si no lo descarga.
 *
 * `canShare` con el archivo delante es la única comprobación fiable: hay
 * navegadores que tienen `navigator.share` pero rechazan archivos.
 */
async function entregar(blob: Blob, nombre: string): Promise<void> {
  const archivo = new File([blob], nombre, { type: blob.type });

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
