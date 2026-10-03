"use client";

import { useState } from "react";

import { FONDO_DE_BLOQUE, ICONO_DE_BLOQUE, tituloYDetalleDeBloque } from "@/components/bloques-visual";
import { HojaDeDetalleBloque } from "@/components/HojaDeDetalleBloque";
import { Flecha } from "@/components/iconos";
import type { FechaISO } from "@/lib/fechas";
import type { BloqueExtraFila } from "@/lib/db/tipos";
import { formatearSoles } from "@/lib/pagos/reglas";

/**
 * Un apoyo o un taxi del día, como tarjeta. Se toca para abrir su detalle
 * (de dónde sale el monto, cada pedido…) y desde ahí se corrige o se quita.
 */
export function TarjetaBloqueExtra({
  bloque,
  fecha,
  editable,
  alCambiar,
}: {
  bloque: BloqueExtraFila;
  fecha: FechaISO;
  editable: boolean;
  alCambiar: () => void;
}) {
  const [abierta, setAbierta] = useState(false);
  const Icono = ICONO_DE_BLOQUE[bloque.tipo];
  const { titulo, detalle } = tituloYDetalleDeBloque(bloque);

  return (
    <>
      <button
        type="button"
        onClick={() => setAbierta(true)}
        aria-label={`Ver el detalle de ${titulo}`}
        className="tarjeta flex w-full items-center gap-3 text-left"
      >
        <span className={`grid size-10 shrink-0 place-items-center rounded-full ${FONDO_DE_BLOQUE[bloque.tipo]}`}>
          <Icono className="size-[19px]" />
        </span>
        <span className="min-w-0 flex-1">
          <b className="block truncate text-sm font-bold">{titulo}</b>
          <span className="block truncate text-xs text-tinta-2">
            {bloque.horaInicio ? `${bloque.horaInicio} · ` : ""}
            {detalle}
          </span>
        </span>
        <b className="shrink-0 font-mono text-sm tabular-nums">{formatearSoles(bloque.montoCentimos)}</b>
        <Flecha className="size-4 shrink-0 text-tinta-3" />
      </button>

      {abierta && (
        <HojaDeDetalleBloque
          bloque={bloque}
          fecha={fecha}
          editable={editable}
          alCerrar={() => setAbierta(false)}
          alCambiar={alCambiar}
        />
      )}
    </>
  );
}
