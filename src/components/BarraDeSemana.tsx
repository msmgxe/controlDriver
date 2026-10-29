"use client";

import { BotonPag, FlechaBoton } from "@/components/PagUi";
import { Calendario } from "@/components/iconos";
import {
  formatearFecha,
  hoyEnLima,
  lunesDeLaSemana,
  sumarDias,
  type FechaISO,
} from "@/lib/fechas";

/**
 * Elegir la semana con dos flechas: `‹  Sem. 21–27  ›`.
 *
 * Es la forma compacta —una sola línea— para pantallas que tienen que caber
 * enteras, como Estadísticas. Las flechas van a la semana anterior y a la
 * siguiente; tocar el nombre abre un calendario para saltar a cualquier fecha.
 * No pasa de la semana en curso, y cuando se está en otra, un «Hoy» vuelve a
 * ella.
 */
export function BarraDeSemana({
  semana,
  alCambiar,
  etiqueta,
}: {
  /** El lunes de la semana elegida. */
  semana: FechaISO;
  alCambiar: (lunes: FechaISO) => void;
  /** Un rótulo sobre la barra, si la pantalla lo necesita («Semana que miras»). */
  etiqueta?: string;
}) {
  const hoy = hoyEnLima();
  const actual = lunesDeLaSemana(hoy);
  const fin = sumarDias(semana, 6);
  const esActual = semana === actual;

  return (
    <div className="flex flex-col gap-1">
      {etiqueta && <span className="rotulo">{etiqueta}</span>}
      <div className="flex items-center gap-0.5 rounded-btn border border-linea-fuerte bg-sup p-1">
        <FlechaBoton atras etiqueta="Semana anterior" onClick={() => alCambiar(sumarDias(semana, -7))} />

        {/* Tocar el nombre abre el calendario: el campo de fecha va encima, invisible. */}
        <label className="relative flex min-w-0 flex-1 flex-col items-center justify-center rounded-btn py-0.5 hover:bg-sup-2">
          <span className="flex items-center gap-1.5 text-[17px] leading-tight font-bold">
            Sem. {Number(semana.slice(8, 10))}–{Number(fin.slice(8, 10))}
            <Calendario className="size-4 text-tinta-3" aria-hidden />
          </span>
          <span className="text-[11px] leading-tight text-tinta-3">
            {formatearFecha(semana).slice(0, 5)} – {formatearFecha(fin).slice(0, 5)}
          </span>
          <span className="sr-only">Ir a la semana de una fecha</span>
          <input
            type="date"
            value={semana}
            max={hoy}
            onChange={(e) => e.target.value && alCambiar(lunesDeLaSemana(e.target.value as FechaISO))}
            onClick={(e) => {
              try {
                e.currentTarget.showPicker();
              } catch {
                /* Algunos navegadores solo lo abren con un toque directo en el campo. */
              }
            }}
            className="absolute inset-0 cursor-pointer opacity-0"
          />
        </label>

        {!esActual && (
          <BotonPag k="taxi" className="!min-h-11 shrink-0 !px-3" onClick={() => alCambiar(actual)}>
            Hoy
          </BotonPag>
        )}

        <FlechaBoton etiqueta="Semana siguiente" disabled={esActual} onClick={() => alCambiar(sumarDias(semana, 7))} />
      </div>
    </div>
  );
}
