"use client";

import { useMemo, useState } from "react";

import { BotonDeAccion } from "@/components/Acciones";
import { ArchivoGenerado } from "@/components/ArchivoGenerado";
import { Alerta, Hoja } from "@/components/iconos";
import type { JornadaCompleta } from "@/lib/db/tipos";
import { armarSemana, nombreArchivoDeSemana } from "@/lib/exportar/semana";
import { prepararArchivo, type ArchivoListo } from "@/lib/exportar/entregar";
import type { FechaISO } from "@/lib/fechas";
import { formatearSoles, type ReglaPago } from "@/lib/pagos/reglas";

/**
 * «PDF de la semana»: todos los pedidos de la semana con su día, ruta, código,
 * destino y origen, el subtotal de cada día y el total, para mandarlo por
 * WhatsApp. Si ya se cotejó con la lista de la empresa, marca en rojo los que no
 * figuran y los junta al final; con «Solo los que no figuran» sale el papel corto
 * para reclamar solo lo que falta.
 *
 * Se arma en el teléfono y, al terminar, se ofrece Ver / Guardar / Compartir
 * (el compartir de Android trae WhatsApp).
 */
export function PdfDeLaSemana({
  jornadas,
  regla,
  conductor,
  tienda,
  desde,
  hasta,
}: {
  jornadas: readonly JornadaCompleta[];
  regla: ReglaPago;
  conductor: string;
  tienda: string | null;
  desde: FechaISO;
  hasta: FechaISO;
}) {
  const [modo, setModo] = useState<"todos" | "faltan">("todos");
  const [trabajando, setTrabajando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [listo, setListo] = useState<ArchivoListo | null>(null);

  const semana = useMemo(
    () => armarSemana({ conductor, tienda, desde, hasta, jornadas, regla }),
    [conductor, tienda, desde, hasta, jornadas, regla],
  );
  const t = semana.totales;
  const vacio = t.pedidos === 0;

  async function generar() {
    setTrabajando(true);
    setError(null);
    setListo(null);
    try {
      const { generarPdfSemana } = await import("@/lib/exportar/pdf-semana");
      const blob = await generarPdfSemana(semana, { soloNoFiguran: modo === "faltan" });
      const nombre = nombreArchivoDeSemana(semana).replace(".pdf", modo === "faltan" ? "_no-figuran.pdf" : ".pdf");
      setListo(await prepararArchivo(blob, nombre));
    } catch (e) {
      setError(e instanceof Error ? `No se pudo generar el PDF: ${e.message}` : "No se pudo generar el PDF.");
    } finally {
      setTrabajando(false);
    }
  }

  return (
    <section className="flex flex-col gap-3 rounded-card border border-linea-fuerte bg-sup p-4" aria-label="PDF de la semana">
      <div className="flex items-center gap-3">
        <span className="fig-color" style={{ "--c": "var(--c-adic)", "--c-texto": "#fff" } as React.CSSProperties} aria-hidden>
          <Hoja className="size-6" />
        </span>
        <div className="min-w-0">
          <b className="block leading-tight">PDF de la semana</b>
          <small className="block text-tinta-2">Para mandar por WhatsApp</small>
        </div>
      </div>

      <p className="text-sm text-tinta-2">
        {vacio
          ? "Esta semana no tiene pedidos todavía."
          : semana.cotejado
            ? `${t.pedidos} pedidos · ${t.contados} figuran en el reporte de la empresa · ${t.noFiguran} no figuran (${formatearSoles(t.noFiguranCentimos)}).`
            : `${t.pedidos} pedidos · ${formatearSoles(t.subtotalCentimos)}. Aún no los cotejaste con la empresa: sube su reporte arriba y saldrán marcados los que no figuran.`}
      </p>

      <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Qué pedidos incluir">
        <button
          type="button"
          role="radio"
          aria-checked={modo === "todos"}
          onClick={() => setModo("todos")}
          className={`min-h-12 rounded-btn border-2 text-sm font-bold ${modo === "todos" ? "border-tinta bg-sup-2" : "border-linea-fuerte"}`}
        >
          Todos los pedidos
        </button>
        <button
          type="button"
          role="radio"
          aria-checked={modo === "faltan"}
          disabled={!semana.cotejado || t.noFiguran === 0}
          onClick={() => setModo("faltan")}
          className={`min-h-12 rounded-btn border-2 text-sm font-bold disabled:opacity-45 ${modo === "faltan" ? "border-tinta bg-sup-2" : "border-linea-fuerte"}`}
        >
          Solo los que no figuran
        </button>
      </div>

      <BotonDeAccion k="adicional" disabled={vacio || trabajando} onClick={() => void generar()}>
        <Hoja className="size-5" />
        {trabajando ? "Preparando…" : "Preparar el PDF"}
      </BotonDeAccion>

      {listo && <ArchivoGenerado archivo={listo} alCerrar={() => setListo(null)} />}
      {error && (
        <p className="flex items-center gap-2 text-sm font-semibold text-mal">
          <Alerta className="size-4 shrink-0" />
          {error}
        </p>
      )}
    </section>
  );
}
