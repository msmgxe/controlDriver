"use client";

import { BotonPag, FlechaBoton } from "@/components/PagUi";
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
      <FlechaBoton atras etiqueta="Mes anterior" onClick={() => alCambiar(sumarMeses(mes, -1))} />

      <div className="flex min-w-0 flex-col items-center gap-1">
        <h2 className="text-[20px] leading-tight first-letter:uppercase">{nombreDelMes(mes)}</h2>
        {!esActual && (
          <BotonPag k="taxi" className="!min-h-9 !px-3 !text-sm" onClick={() => alCambiar(actual)}>
            Este mes
          </BotonPag>
        )}
      </div>

      <FlechaBoton etiqueta="Mes siguiente" disabled={esActual} onClick={() => alCambiar(sumarMeses(mes, 1))} />
    </div>
  );
}
