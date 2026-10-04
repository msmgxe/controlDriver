"use client";

import { createPortal } from "react-dom";

import { useCapa } from "@/hooks/useCapa";

/**
 * La pregunta de seguridad antes de quitar algo.
 *
 * En un celular una «×» se toca sin querer con el pulgar; por eso **toda**
 * eliminación de un registro pasa por aquí. Va al centro de la pantalla, en un
 * portal —fuera de la lista donde se tocó—, con el botón de seguir a un lado y
 * el de cancelar al otro, y «Cancelar» es lo que hace el botón «atrás».
 */
export function DialogoConfirmar({
  titulo,
  texto,
  confirmar = "Sí, quitar",
  ocupado = false,
  alConfirmar,
  alCancelar,
}: {
  titulo: string;
  texto?: string;
  confirmar?: string;
  ocupado?: boolean;
  alConfirmar: () => void;
  alCancelar: () => void;
}) {
  useCapa(alCancelar);
  return createPortal(
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/55 p-5"
      onClick={(e) => {
        if (e.target === e.currentTarget) alCancelar();
      }}
    >
      <div
        role="alertdialog"
        aria-modal="true"
        aria-label={titulo}
        className="flex w-full max-w-sm flex-col gap-4 rounded-hoja bg-sup p-5 shadow-alta"
      >
        <div className="flex flex-col gap-1.5">
          <h3 className="text-lg leading-tight">{titulo}</h3>
          {texto && <p className="text-sm text-tinta-2">{texto}</p>}
        </div>
        <div className="grid grid-cols-2 gap-2">
          <button type="button" className="boton-sec !min-h-11" disabled={ocupado} onClick={alCancelar}>
            Cancelar
          </button>
          <button
            type="button"
            disabled={ocupado}
            onClick={alConfirmar}
            className="min-h-11 rounded-btn bg-mal px-3 text-sm font-bold text-white disabled:opacity-60"
          >
            {ocupado ? "Quitando…" : confirmar}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
