"use client";

import { useState } from "react";

import { FiguraDeAccion, type ClaveDeAccion } from "@/components/Acciones";
import { tituloYDetalleDeBloque } from "@/components/bloques-visual";
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
  const { titulo, detalle } = tituloYDetalleDeBloque(bloque);
  /* La figura es la de su acción: apoyo turquesa, taxi amarillo, otro adicional vino. */
  const clave: ClaveDeAccion =
    bloque.tipo === "taxi" ? ((bloque.categoriaNombre ?? "Taxi") === "Taxi" ? "taxi" : "adicional") : "apoyo";

  return (
    <>
      <button
        type="button"
        onClick={() => setAbierta(true)}
        aria-label={`Ver el detalle de ${titulo}`}
        className="fila-color"
      >
        <FiguraDeAccion k={clave} />
        <span className="min-w-0 flex-1">
          <b className="block truncate text-sm font-bold">{titulo}</b>
          <span className="block truncate text-xs text-tinta-2">
            {bloque.horaInicio ? `${bloque.horaInicio} · ` : ""}
            {detalle}
          </span>
        </span>
        <b className="shrink-0 font-display text-base tabular-nums">{formatearSoles(bloque.montoCentimos)}</b>
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
