"use client";

import { formatearFecha } from "@/lib/fechas";

import { BotonCopiar } from "./Copiar";
import type { Resultado } from "./tipos";

/** Lo que se ve tras firmar: el mensaje listo para WhatsApp y el botón para copiarlo. */
export function ResultadoFirma({ r }: { r: Resultado }) {
  return (
    <div className="lic-resultado">
      <p className="text-sm font-bold text-bien">Listo: válida hasta el {formatearFecha(r.hasta)}.</p>
      <textarea readOnly rows={5} value={r.mensaje} aria-label="Mensaje para WhatsApp" className="select-all" />
      <div className="flex flex-wrap gap-2">
        <BotonCopiar texto={r.mensaje} etiqueta="Copiar mensaje para WhatsApp" tipo="verde" />
        <BotonCopiar texto={r.codigo} etiqueta="Copiar código" />
      </div>
    </div>
  );
}
