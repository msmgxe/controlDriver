"use client";

import { useState } from "react";

/** Copia un texto al portapapeles y avisa un momento. */
export function BotonCopiar({
  texto,
  etiqueta,
  tipo = "suave",
}: {
  texto: string;
  etiqueta: string;
  tipo?: "suave" | "verde" | "principal";
}) {
  const [estado, setEstado] = useState<"" | "ok" | "fallo">("");

  async function copiar() {
    try {
      await navigator.clipboard.writeText(texto);
      setEstado("ok");
    } catch {
      setEstado("fallo");
    }
    setTimeout(() => setEstado(""), 2200);
  }

  return (
    <button type="button" className="lic-btn" data-t={tipo} onClick={copiar}>
      {estado === "ok" ? "Copiado ✓" : estado === "fallo" ? "No se pudo copiar" : etiqueta}
    </button>
  );
}
