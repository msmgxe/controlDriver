"use client";

import { useState } from "react";

import { FormularioApoyoHora } from "@/components/FormularioApoyoHora";
import { FormularioApoyoTramos } from "@/components/FormularioApoyoTramos";
import { FormularioTaxi } from "@/components/FormularioTaxi";
import { Equis } from "@/components/iconos";
import { useCapa } from "@/hooks/useCapa";
import type { FechaISO } from "@/lib/fechas";
import type { Tienda } from "@/lib/db/tipos";

type TipoFlujo = "apoyo" | "taxi";

/**
 * La hoja que abre "Apoyo a otra tienda" o "Taxi libre" desde el menú "+" de
 * Inicio (§ plan de apoyo/taxi). El apoyo tiene dos formas de tarifarse —por
 * hora o por tramos—, elegidas aquí mismo con un interruptor, porque es una
 * decisión del momento, no una preferencia fija.
 */
export function HojaDeBloqueExtra({
  tipo,
  fecha,
  tiendas,
  factorCalles,
  alCerrar,
  alGuardar,
}: {
  tipo: TipoFlujo;
  fecha: FechaISO;
  tiendas: Tienda[];
  factorCalles: number;
  alCerrar: () => void;
  alGuardar: () => void;
}) {
  useCapa(alCerrar);
  const [modoApoyo, setModoApoyo] = useState<"hora" | "tramos">("hora");

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center sm:p-5"
      onClick={(e) => {
        if (e.target === e.currentTarget) alCerrar();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={tipo === "taxi" ? "Taxi libre" : "Apoyo a otra tienda"}
        className="flex h-[94dvh] w-full max-w-md flex-col overflow-hidden rounded-t-hoja bg-sup shadow-alta sm:h-[88dvh] sm:rounded-hoja"
      >
        <div className="flex items-start justify-between gap-3 px-4 pt-4 pb-2">
          <div className="min-w-0">
            <span className="mx-auto mb-2 block h-1 w-9 rounded-full bg-linea-fuerte sm:hidden" />
            <h3 className="text-[21px] leading-tight">{tipo === "taxi" ? "Taxi libre" : "Apoyo a otra tienda"}</h3>
          </div>
          <button
            type="button"
            onClick={alCerrar}
            aria-label="Cerrar"
            className="grid size-11 shrink-0 place-items-center rounded-full bg-sup-2"
          >
            <Equis className="size-5" />
          </button>
        </div>

        {tipo === "apoyo" && (
          <div className="flex gap-2 px-4 pb-3">
            <button
              type="button"
              aria-pressed={modoApoyo === "hora"}
              onClick={() => setModoApoyo("hora")}
              className={`min-h-9 flex-1 rounded-btn border-2 text-sm font-semibold ${
                modoApoyo === "hora" ? "border-acento bg-acento-suave text-acento-tinta" : "border-linea text-tinta-2"
              }`}
            >
              Por hora
            </button>
            <button
              type="button"
              aria-pressed={modoApoyo === "tramos"}
              onClick={() => setModoApoyo("tramos")}
              className={`min-h-9 flex-1 rounded-btn border-2 text-sm font-semibold ${
                modoApoyo === "tramos" ? "border-acento bg-acento-suave text-acento-tinta" : "border-linea text-tinta-2"
              }`}
            >
              Por tramos
            </button>
          </div>
        )}

        {tipo === "taxi" ? (
          <FormularioTaxi fecha={fecha} factorCalles={factorCalles} alGuardar={alGuardar} />
        ) : modoApoyo === "hora" ? (
          <FormularioApoyoHora fecha={fecha} alGuardar={alGuardar} />
        ) : (
          <FormularioApoyoTramos fecha={fecha} tiendas={tiendas} alGuardar={alGuardar} />
        )}
      </div>
    </div>
  );
}
