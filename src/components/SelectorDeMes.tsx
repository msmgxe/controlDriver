"use client";

import { Flecha } from "@/components/iconos";
import {
  hoyEnLima,
  nombreDelMes,
  primerDiaDelMes,
  sumarMeses,
  type FechaISO,
} from "@/lib/fechas";

/**
 * Elegir **qué mes** se mira: el nombre, y una flecha a cada lado. No pasa del
 * mes en curso.
 */
export function SelectorDeMes({
  mes,
  alCambiar,
}: {
  /** El primer día del mes elegido. */
  mes: FechaISO;
  alCambiar: (primerDia: FechaISO) => void;
}) {
  const actual = primerDiaDelMes(hoyEnLima());
  const esActual = mes === actual;

  return (
    <div className="flex items-center justify-between gap-2 rounded-btn border border-linea-fuerte bg-sup p-1">
      <button
        type="button"
        aria-label="Mes anterior"
        onClick={() => alCambiar(sumarMeses(mes, -1))}
        className="grid size-11 place-items-center rounded-btn hover:bg-sup-2"
      >
        <Flecha className="size-5 rotate-180" />
      </button>

      <div className="flex min-w-0 flex-col items-center">
        <h2 className="text-[20px] leading-tight first-letter:uppercase">{nombreDelMes(mes)}</h2>
        {!esActual && (
          <button
            type="button"
            onClick={() => alCambiar(actual)}
            className="text-xs font-bold text-acento-tinta underline underline-offset-2"
          >
            Este mes
          </button>
        )}
      </div>

      <button
        type="button"
        aria-label="Mes siguiente"
        disabled={esActual}
        onClick={() => alCambiar(sumarMeses(mes, 1))}
        className="grid size-11 place-items-center rounded-btn hover:bg-sup-2 disabled:opacity-30"
      >
        <Flecha className="size-5" />
      </button>
    </div>
  );
}
