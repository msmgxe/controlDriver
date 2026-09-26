"use client";

import { Calendario } from "@/components/iconos";
import { TiraDeSemanas } from "@/components/TiraDeSemanas";
import { useTiraDeSemanas } from "@/hooks/useTiraDeSemanas";
import {
  formatearFecha,
  hoyEnLima,
  lunesDeLaSemana,
  rangoDeFechas,
  sumarDias,
  type FechaISO,
} from "@/lib/fechas";

/**
 * Elegir **qué semana** se mira: el título, un calendario para saltar a una
 * fecha, y la barra de siete días que se arrastra —la misma de Inicio y Pagos—.
 *
 * Es lo que faltaba en Estadísticas e Historial, que solo ofrecían «esta semana»
 * y «la pasada»: no había forma de ir a otra ni de ver dos juntas. Aquí la barra
 * solo elige la semana; cada día enseña sus pedidos, pero no se toca.
 *
 * Se arrastra hacia la derecha para ir atrás y hacia la izquierda para volver; no
 * pasa de la semana en curso.
 */
export function SelectorDeSemana({
  semana,
  alCambiar,
  etiqueta,
}: {
  /** El lunes de la semana elegida. */
  semana: FechaISO;
  alCambiar: (lunes: FechaISO) => void;
  /** Un rótulo sobre el título, si la pantalla lo necesita («Esta semana», «Semana anterior»…). */
  etiqueta?: string;
}) {
  const hoy = hoyEnLima();
  const actual = lunesDeLaSemana(hoy);
  const fin = sumarDias(semana, 6);
  const esActual = semana === actual;

  const { datos: tira } = useTiraDeSemanas(semana, hoy);
  const cargados = tira ? rangoDeFechas(semana, fin).filter((f) => tira.get(f)?.cargado).length : null;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-end justify-between gap-3">
        <div className="min-w-0">
          {etiqueta && <span className="rotulo">{etiqueta}</span>}
          <h2 className="text-[24px] leading-tight">
            Sem. {Number(semana.slice(8, 10))}–{Number(fin.slice(8, 10))}
          </h2>
          <p className="text-xs text-tinta-3">
            {formatearFecha(semana).slice(0, 5)} – {formatearFecha(fin).slice(0, 5)}
            {cargados !== null && ` · ${cargados} de 7 días`}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {!esActual && (
            <button
              type="button"
              onClick={() => alCambiar(actual)}
              className="min-h-11 px-2 text-xs font-bold text-acento-tinta underline underline-offset-2"
            >
              Esta semana
            </button>
          )}
          {/* Para saltar a cualquier fecha sin arrastrar semana a semana. */}
          <label className="relative grid size-11 place-items-center rounded-btn border border-linea-fuerte bg-sup">
            <span className="sr-only">Ir a la semana de una fecha</span>
            <Calendario className="size-5" />
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
        </div>
      </div>

      {tira ? (
        <TiraDeSemanas
          semana={semana}
          dia={null}
          hoy={hoy}
          modo="pedidos"
          datos={tira}
          interactivo={false}
          alElegirDia={() => {}}
          alMoverSemana={(delta) => {
            const siguiente = sumarDias(semana, delta * 7);
            alCambiar(siguiente > actual ? actual : siguiente);
          }}
        />
      ) : (
        <div className="h-[66px] animate-pulse rounded-btn bg-sup-2" aria-hidden />
      )}

      <p className="text-[11px] text-tinta-3">
        Desliza los días para cambiar de semana, o toca el calendario para ir a una fecha.
      </p>
    </div>
  );
}
