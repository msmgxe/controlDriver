"use client";

import { useActionState, useState } from "react";

import { emitirLicencia } from "./acciones";
import { Campo, CamposDePago } from "./Campos";
import { ResultadoFirma } from "./ResultadoFirma";
import { ESTADO_VACIO } from "./tipos";

/** El botón grande «Emitir licencia nueva», que despliega el formulario. */
export function EmitirNueva() {
  const [abierto, setAbierto] = useState(false);
  const [estado, accion, pendiente] = useActionState(emitirLicencia, ESTADO_VACIO);

  return (
    <div className="flex flex-col gap-3">
      <button type="button" className="boton-principal" aria-expanded={abierto} onClick={() => setAbierto(!abierto)}>
        {abierto ? "Cerrar" : "+ Emitir licencia nueva"}
      </button>
      {abierto && (
        <form action={accion} className="tarjeta flex flex-col gap-3">
          <div className="lic-rejilla">
            <Campo id="n-codigo" etiqueta="Código del teléfono">
              <input id="n-codigo" name="codigo" required className="font-mono" placeholder="Ajustes → Tu licencia → Copiar" autoComplete="off" />
            </Campo>
            <Campo id="n-nombre" etiqueta="Nombre">
              <input id="n-nombre" name="nombre" required maxLength={80} autoComplete="off" />
            </Campo>
            <CamposDePago prefijo="n" />
            <Campo id="n-telefono" etiqueta="WhatsApp (opcional)">
              <input id="n-telefono" name="telefono" inputMode="tel" placeholder="+51 9…" autoComplete="off" />
            </Campo>
          </div>
          <Campo id="n-notas" etiqueta="Notas (opcional)">
            <textarea id="n-notas" name="notas" rows={2} maxLength={500} />
          </Campo>
          {estado.error && <p className="lic-error">{estado.error}</p>}
          <button type="submit" className="lic-btn" data-t="principal" disabled={pendiente}>
            {pendiente ? "Firmando…" : "Firmar y registrar pago"}
          </button>
          {estado.resultado && <ResultadoFirma r={estado.resultado} />}
        </form>
      )}
    </div>
  );
}
