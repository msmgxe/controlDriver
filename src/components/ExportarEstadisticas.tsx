"use client";

import { useState } from "react";

import { Alerta, Hoja } from "@/components/iconos";
import { formatearFecha } from "@/lib/fechas";

/**
 * Exportar las estadísticas a PDF (§10).
 *
 * Las estadísticas son gráficos, así que no van a Excel: cada bloque se
 * convierte a imagen y se compone un PDF con portada, cifras clave y un gráfico
 * por página con su línea de lectura.
 *
 * **Siempre en tema claro**, aunque la app esté en oscuro: un PDF con fondo
 * negro es ilegible impreso y se come la tinta. Se consigue poniendo
 * `data-tema="claro"` en el bloque justo antes de capturarlo.
 */

export interface BloqueExportable {
  /** `id` del elemento a capturar. */
  id: string;
  titulo: string;
  /** Una línea que explique qué se está mirando. */
  lectura: string;
}

export function ExportarEstadisticas({
  bloques,
  driver,
  desde,
  hasta,
  cifras,
}: {
  bloques: BloqueExportable[];
  driver: string;
  desde: string;
  hasta: string;
  cifras: { etiqueta: string; valor: string }[];
}) {
  const [trabajando, setTrabajando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function exportar() {
    setTrabajando(true);
    setError(null);

    // Elementos a los que se les forzó el tema, para poder devolverlos como
    // estaban pase lo que pase.
    const tocados: HTMLElement[] = [];

    try {
      const { toPng } = await import("html-to-image");
      const { jsPDF } = await import("jspdf");

      const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
      const anchoPagina = doc.internal.pageSize.getWidth();
      const altoPagina = doc.internal.pageSize.getHeight();
      const margen = 14;
      const anchoUtil = anchoPagina - margen * 2;

      /* ----------------------------- portada ----------------------------- */
      doc.setFont("helvetica", "bold");
      doc.setFontSize(22);
      doc.text("RutaLog", margen, 28);

      doc.setFont("helvetica", "normal");
      doc.setFontSize(12);
      doc.text("Estadísticas", margen, 37);

      doc.setFontSize(10);
      doc.setTextColor(90);
      doc.text(driver, margen, 48);
      doc.text(`Del ${formatearFecha(desde)} al ${formatearFecha(hasta)}`, margen, 54);
      doc.text(
        `Generado el ${formatearFecha(new Date().toISOString().slice(0, 10))}`,
        margen,
        60,
      );

      // Cifras clave en dos columnas.
      doc.setTextColor(30);
      let y = 76;
      cifras.forEach((c, i) => {
        const x = margen + (i % 2) * (anchoUtil / 2);
        if (i % 2 === 0 && i > 0) y += 18;
        doc.setFont("helvetica", "normal");
        doc.setFontSize(9);
        doc.setTextColor(120);
        doc.text(c.etiqueta, x, y);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(16);
        doc.setTextColor(30);
        doc.text(c.valor, x, y + 7);
      });

      /* ------------------------ un gráfico por bloque ------------------------ */
      for (const bloque of bloques) {
        const nodo = document.getElementById(bloque.id);
        if (!nodo) continue;

        nodo.setAttribute("data-tema", "claro");
        tocados.push(nodo);

        const imagen = await toPng(nodo, {
          pixelRatio: 2,
          // Sin fondo explícito, html-to-image deja transparente lo que en
          // pantalla pinta el body, y en el PDF saldría negro.
          backgroundColor: "#ffffff",
          cacheBust: true,
        });

        doc.addPage();

        doc.setFont("helvetica", "bold");
        doc.setFontSize(14);
        doc.setTextColor(30);
        doc.text(bloque.titulo, margen, 22);

        doc.setFont("helvetica", "normal");
        doc.setFontSize(9);
        doc.setTextColor(110);
        const lineas = doc.splitTextToSize(bloque.lectura, anchoUtil);
        doc.text(lineas, margen, 29);

        const propiedades = doc.getImageProperties(imagen);
        const alto = (propiedades.height * anchoUtil) / propiedades.width;
        const arriba = 29 + lineas.length * 4.5 + 5;
        // Si el bloque es muy alto se encoge para que quepa entero: partirlo
        // entre páginas dejaría medio gráfico sin eje.
        const altoFinal = Math.min(alto, altoPagina - arriba - 18);
        const anchoFinal = (propiedades.width * altoFinal) / propiedades.height;

        doc.addImage(imagen, "PNG", margen, arriba, anchoFinal, altoFinal);
      }

      /* -------------------------------- pie -------------------------------- */
      const paginas = doc.getNumberOfPages();
      for (let i = 1; i <= paginas; i++) {
        doc.setPage(i);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(8);
        doc.setTextColor(140);
        doc.text(`Página ${i} de ${paginas}`, anchoPagina - margen, altoPagina - 8, {
          align: "right",
        });
        doc.text("RutaLog", margen, altoPagina - 8);
      }

      await entregar(doc.output("blob"), `estadisticas_${desde}_a_${hasta}.pdf`);
    } catch (e) {
      setError(
        e instanceof Error ? `No se pudo generar el PDF: ${e.message}` : "No se pudo generar el PDF.",
      );
    } finally {
      for (const nodo of tocados) nodo.removeAttribute("data-tema");
      setTrabajando(false);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        className="boton-sec w-full"
        disabled={trabajando}
        onClick={() => void exportar()}
      >
        <Hoja className="size-4" />
        {trabajando ? "Componiendo el PDF…" : "Exportar estadísticas a PDF"}
      </button>

      {error && (
        <p className="flex items-center gap-2 text-sm font-semibold text-mal">
          <Alerta className="size-4 shrink-0" />
          {error}
        </p>
      )}

      <p className="text-xs text-tinta-3">
        Los gráficos van como imagen y siempre en tema claro, para que se lean impresos.
      </p>
    </div>
  );
}

/** Comparte si el equipo puede, y si no descarga. Igual que en el listado. */
async function entregar(blob: Blob, nombre: string): Promise<void> {
  const archivo = new File([blob], nombre, { type: blob.type });

  if (navigator.canShare?.({ files: [archivo] })) {
    try {
      await navigator.share({ files: [archivo], title: nombre });
      return;
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") return;
    }
  }

  const url = URL.createObjectURL(blob);
  const enlace = document.createElement("a");
  enlace.href = url;
  enlace.download = nombre;
  document.body.appendChild(enlace);
  enlace.click();
  enlace.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
