"use client";

import { useState } from "react";
import { createPortal } from "react-dom";

import { Luna } from "@/components/iconos";
import { useCapa } from "@/hooks/useCapa";
import { marcarDescanso, quitarDescanso } from "@/lib/db/sqlite/descansos";
import { formatearFechaLarga, type FechaISO } from "@/lib/fechas";
import { sonar } from "@/lib/sonidos";

/**
 * Las opciones de un día de la barra de fechas, que se abren **manteniéndolo
 * presionado**: marcarlo como día de descanso (o quitar la marca) o ir a él.
 *
 * Un día con pedidos, rutas, apoyo o taxi no se puede marcar: se trabajó. La
 * hoja lo dice con palabras en vez de esconder el botón.
 */
export function HojaDeDia({
  fecha,
  cargado,
  descanso,
  alElegir,
  alCambiar,
  alCerrar,
}: {
  fecha: FechaISO;
  /** El día tiene algo cargado. */
  cargado: boolean;
  descanso: boolean;
  alElegir: () => void;
  alCambiar: () => void;
  alCerrar: () => void;
}) {
  useCapa(alCerrar);
  const [ocupado, setOcupado] = useState(false);

  async function alternar() {
    setOcupado(true);
    try {
      if (descanso) await quitarDescanso([fecha]);
      else await marcarDescanso([fecha]);
      sonar("moneda");
      alCambiar();
      alCerrar();
    } finally {
      setOcupado(false);
    }
  }

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center sm:p-5"
      onClick={(e) => {
        if (e.target === e.currentTarget) alCerrar();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Opciones del día ${fecha}`}
        className="flex w-full max-w-md flex-col gap-3 rounded-t-hoja bg-sup px-4 pt-3 pb-[calc(1rem+env(safe-area-inset-bottom,0px))] shadow-alta sm:rounded-hoja"
      >
        <span className="mx-auto h-1 w-9 shrink-0 rounded-full bg-linea-fuerte sm:hidden" />
        <div>
          <h3 className="text-xl leading-tight first-letter:uppercase">{formatearFechaLarga(fecha).replace(/ de \d{4}$/, "")}</h3>
          <p className="text-sm text-tinta-2">
            {descanso ? "Marcado como día de descanso." : cargado ? "Este día tiene cosas cargadas." : "Este día no tiene nada cargado."}
          </p>
        </div>

        {cargado ? (
          <p className="rounded-btn bg-aviso-suave px-3 py-2 text-sm text-aviso">
            No se puede marcar como descanso: trabajaste ese día (tiene pedidos, rutas, apoyo o taxi).
          </p>
        ) : (
          <button type="button" className="boton-fila" disabled={ocupado} onClick={() => void alternar()}>
            <Luna className="size-[18px]" />
            {descanso ? "Quitar el día de descanso" : "Marcar como día de descanso"}
          </button>
        )}

        <button
          type="button"
          className="boton-fila"
          onClick={() => {
            alElegir();
            alCerrar();
          }}
        >
          Ir a este día
        </button>
        <button type="button" className="boton-sec" onClick={alCerrar}>
          Cerrar
        </button>
      </div>
    </div>,
    document.body,
  );
}
