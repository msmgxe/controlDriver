"use client";

import { useActionState, useState } from "react";

import { formatearFecha } from "@/lib/fechas";

import { emitirLicencia, type EstadoEmision } from "./acciones";

const ESTADO_INICIAL: EstadoEmision = { error: null, certificado: null, hasta: null };

export function FormularioEmitir() {
  const [estado, accion, pendiente] = useActionState(emitirLicencia, ESTADO_INICIAL);
  const [copiado, setCopiado] = useState(false);

  async function copiar() {
    if (!estado.certificado) return;
    try {
      await navigator.clipboard.writeText(estado.certificado);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    } catch {
      // Sin permiso de portapapeles: el texto sigue ahí, seleccionable a mano.
    }
  }

  return (
    <div className="tarjeta flex flex-col gap-3">
      <h2 className="text-lg font-semibold">Emitir licencia</h2>
      <form
        action={accion}
        className="flex flex-wrap items-end gap-3"
        onSubmit={() => setCopiado(false)}
      >
        <div className="flex min-w-64 flex-1 flex-col gap-1.5">
          <label htmlFor="codigo" className="text-sm font-semibold">
            Código del teléfono
          </label>
          <input
            id="codigo"
            name="codigo"
            required
            placeholder="Ajustes → Tu licencia → Copiar"
            className="min-h-11 rounded-btn border border-linea-fuerte bg-sup px-3 font-mono text-sm"
          />
        </div>
        <div className="flex min-w-40 flex-1 flex-col gap-1.5">
          <label htmlFor="nombre" className="text-sm font-semibold">
            Nombre
          </label>
          <input
            id="nombre"
            name="nombre"
            required
            className="min-h-11 rounded-btn border border-linea-fuerte bg-sup px-3 text-base"
          />
        </div>
        <div className="flex w-32 flex-col gap-1.5">
          <label htmlFor="duracion" className="text-sm font-semibold">
            Duración
          </label>
          <input
            id="duracion"
            name="duracion"
            defaultValue="1"
            required
            placeholder="1 · 15d"
            className="min-h-11 rounded-btn border border-linea-fuerte bg-sup px-3 text-base"
          />
        </div>
        <button type="submit" className="boton-principal" disabled={pendiente}>
          {pendiente ? "Firmando…" : "Emitir"}
        </button>
      </form>
      <p className="text-xs text-tinta-3">
        Meses como &quot;1&quot; o &quot;12&quot;, o días con una &quot;d&quot; —&quot;15d&quot;—
        para una renovación corta. Si el teléfono ya tenía licencia, se suma a lo que le quedaba.
      </p>

      {estado.error && <p className="text-sm text-mal">{estado.error}</p>}

      {estado.certificado && (
        <div className="flex flex-col gap-2 rounded-btn bg-bien-suave px-4 py-3">
          <p className="text-sm font-semibold text-bien">
            Válida hasta el {formatearFecha(estado.hasta!)}. Mándale esto por WhatsApp:
          </p>
          <textarea
            readOnly
            value={estado.certificado}
            rows={3}
            className="rounded-btn border border-linea-fuerte bg-sup px-3 py-2 font-mono text-xs select-all"
          />
          <button type="button" className="boton-sec self-start" onClick={copiar}>
            {copiado ? "Copiado ✓" : "Copiar"}
          </button>
        </div>
      )}
    </div>
  );
}
