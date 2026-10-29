"use client";

import { formatearSoles } from "@/lib/pagos/reglas";

/**
 * Pedidos contra permanencia, como barras que compiten.
 *
 * Viene directo de la infografía (arquitectura.html → "El piso de
 * permanencia: compiten, no se suman"): dos barras horizontales, la más
 * larga es la que se cobra. Sustituye a una lista con tachado que decía lo
 * mismo en texto y costaba más leer de un vistazo.
 *
 * Las barras se dibujan a **la misma escala**: si no, dos montos que se
 * comparan por longitud pero no comparten regla engañarían al ojo antes de
 * que nadie leyera la cifra.
 */
export function DueloDePago({
  pedidosCentimos,
  permanenciaCentimos,
  horas,
}: {
  pedidosCentimos: number;
  /** null cuando la tienda no paga permanencia: no hay nada que comparar. */
  permanenciaCentimos: number | null;
  horas: number;
}) {
  if (permanenciaCentimos === null || horas <= 0) return null;

  const ganaPermanencia = permanenciaCentimos > pedidosCentimos;
  const tope = Math.max(pedidosCentimos, permanenciaCentimos, 1);
  const cobrado = Math.max(pedidosCentimos, permanenciaCentimos);

  return (
    <div className="ini-rise flex flex-col gap-3 rounded-card bg-sup-2 p-4">
      <Barra
        etiqueta="Pedidos"
        centimos={pedidosCentimos}
        ancho={(pedidosCentimos / tope) * 100}
        gana={!ganaPermanencia}
        color="bg-acento"
      />
      <Barra
        etiqueta={`Permanencia${horas > 0 ? ` (${horas} h)` : ""}`}
        centimos={permanenciaCentimos}
        ancho={(permanenciaCentimos / tope) * 100}
        gana={ganaPermanencia}
        color="bg-[var(--c-historial)]"
      />
      <div className="flex items-baseline justify-between border-t border-linea pt-2.5">
        <span className="text-sm text-tinta-2">
          {ganaPermanencia ? "Cobras el piso" : "Cobras los pedidos"}
        </span>
        <b className="font-display text-2xl leading-none tracking-tight tabular-nums">
          {formatearSoles(cobrado)}
        </b>
      </div>
    </div>
  );
}

function Barra({
  etiqueta,
  centimos,
  ancho,
  gana,
  color,
}: {
  etiqueta: string;
  centimos: number;
  ancho: number;
  gana: boolean;
  color: string;
}) {
  return (
    <div className={`grid grid-cols-[88px_1fr_76px] items-center gap-2.5 ${gana ? "" : "opacity-45"}`}>
      <span className="truncate text-xs font-semibold text-tinta-2">{etiqueta}</span>
      <div className="h-5 overflow-hidden rounded-chip bg-papel">
        <div
          className={`barra-crece h-full rounded-chip ${color}`}
          style={{ width: `${Math.max(ancho, 3)}%` }}
        />
      </div>
      <span className="text-right font-display text-[0.85rem] font-semibold tabular-nums">
        {formatearSoles(centimos)}
      </span>
    </div>
  );
}
