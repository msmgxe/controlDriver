"use client";

import { useId } from "react";

import { FiguraDeAccion, type ClaveDeAccion } from "@/components/Acciones";
import { Check, Flecha, Suma } from "@/components/iconos";

/**
 * Una fila de «¿Qué hiciste hoy?»: una pregunta simple con su respuesta.
 *
 *   · **Hecha** (✓ verde que salta al aparecer): dice qué se anotó y cuánto
 *     dio, y al tocarla se despliega el detalle, con animación.
 *   · **Por hacer** (+ punteado): al tocarla empieza a anotar, sin pasos extra.
 *
 * La figura de la izquierda es la de su acción (color + icono): la tienda, el
 * apoyo, el taxi o el adicional se reconocen sin leer.
 */
export function FilaDeLista({
  indice,
  k,
  titulo,
  resumen,
  monto,
  hecha,
  abierta,
  alPulsar,
  children,
}: {
  indice: number;
  /** La acción de la fila: pone el color y la figura. */
  k: ClaveDeAccion;
  titulo: string;
  resumen: string;
  monto?: string;
  hecha: boolean;
  abierta: boolean;
  /** Hecha: despliega o pliega. Por hacer: empieza a anotar. */
  alPulsar: () => void;
  children?: React.ReactNode;
}) {
  const id = useId();
  return (
    <section
      className="ini-fila ini-rise"
      style={{ animationDelay: `${(indice + 2) * 70}ms` }}
    >
      <button
        type="button"
        onClick={alPulsar}
        aria-expanded={hecha ? abierta : undefined}
        aria-controls={hecha ? id : undefined}
        className="ini-fila__cab"
      >
        <FiguraDeAccion k={k} />
        <span className="flex min-w-0 flex-1 flex-col">
          <b className="text-base leading-tight">{titulo}</b>
          <span className="text-[0.8rem] leading-snug text-tinta-2">{resumen}</span>
        </span>
        {monto && <b className="shrink-0 font-display text-base tabular-nums">{monto}</b>}
        {hecha ? (
          <>
            <span className="pop grid size-6 shrink-0 place-items-center rounded-full bg-bien text-white" style={{ "--i": indice } as React.CSSProperties}>
              <Check className="size-3.5" />
            </span>
            <Flecha className={`size-4 shrink-0 text-tinta-3 transition-transform duration-300 ${abierta ? "-rotate-90" : "rotate-90"}`} />
          </>
        ) : (
          <span className="grid size-7 shrink-0 place-items-center rounded-full border-2 border-dashed border-linea-fuerte text-tinta-3">
            <Suma className="size-3.5" />
          </span>
        )}
      </button>

      {hecha && (
        <div
          className="grid transition-[grid-template-rows] duration-300 ease-in-out"
          style={{ gridTemplateRows: abierta ? "1fr" : "0fr" }}
        >
          <div id={id} className="overflow-hidden" inert={!abierta}>
            <div className="flex flex-col gap-3 border-t border-linea px-3.5 py-3.5">{children}</div>
          </div>
        </div>
      )}
    </section>
  );
}
