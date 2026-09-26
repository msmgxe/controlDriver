"use client";

import { useState } from "react";

import { ArchivoGenerado } from "@/components/ArchivoGenerado";
import { Alerta, Hoja } from "@/components/iconos";
import { nombreArchivo, type DatosExportacion } from "@/lib/exportar/datos";
import { prepararArchivo, type ArchivoListo } from "@/lib/exportar/entregar";

/**
 * Exportar el rango a Excel o PDF (§11).
 *
 * Todo ocurre en el celular: las librerías se cargan solo al pulsar —pesan casi
 * un mega entre las dos y no tienen por qué estar en el arranque de la app— y
 * el archivo se arma en memoria.
 *
 * Tras generar se dice **dónde está el archivo** y se ofrece verlo, guardarlo en
 * Descargas o compartirlo (ver `ArchivoGenerado`): dentro del APK el navegador
 * no descarga, y antes el archivo se generaba y no salía por ningún lado.
 */
export function BotonesExportar({ datos }: { datos: DatosExportacion }) {
  const [trabajando, setTrabajando] = useState<"excel" | "pdf" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [listo, setListo] = useState<ArchivoListo | null>(null);

  const vacio = datos.jornadas.length === 0;

  async function exportar(formato: "excel" | "pdf") {
    setTrabajando(formato);
    setError(null);
    setListo(null);
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

      setListo(await prepararArchivo(blob, nombre));
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

      {listo && <ArchivoGenerado archivo={listo} alCerrar={() => setListo(null)} />}

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
