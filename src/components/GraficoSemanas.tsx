"use client";

import { useState } from "react";

import type { SemanaResumen } from "@/lib/estadisticas";
import { formatearSoles } from "@/lib/pagos/reglas";
import { diasEntre, type FechaISO } from "@/lib/fechas";

/**
 * Semana a semana: una barra por semana, para ver de un vistazo cómo va esta
 * frente a las anteriores.
 *
 * Es lo que faltaba al elegir «30 días»: ese gráfico eran treinta barras de un
 * día que empezaban por las más viejas y dejaban la semana pasada y la de ahora
 * fuera de la vista. Aquí caben ocho semanas enteras, la más nueva a la derecha.
 *
 * Con `alElegir`, cada barra es un botón que lleva a esa semana; la elegida va
 * en el color fuerte y las demás en el suave. Las semanas de un mes que empieza
 * o termina a mitad de semana traen menos de siete días y se marcan con un
 * asterisco.
 */
export function GraficoSemanas({
  semanas,
  elegida,
  alElegir,
  titulo = "Semana a semana",
}: {
  semanas: readonly SemanaResumen[];
  /** El lunes de la semana resaltada, si hay una. */
  elegida?: FechaISO;
  alElegir?: (lunes: FechaISO) => void;
  titulo?: string;
}) {
  const [metrica, setMetrica] = useState<"pedidos" | "soles">("pedidos");

  const esParcial = (s: SemanaResumen) => s.desde !== s.lunes || diasEntre(s.desde, s.hasta) < 6;
  const valorDe = (s: SemanaResumen) => (metrica === "pedidos" ? s.totales.pedidos : s.totales.centimos / 100);
  const max = Math.max(1, ...semanas.map(valorDe));
  const ALTO = 112;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <span className="rotulo">{titulo}</span>
          <p className="text-sm text-tinta-2">
            {alElegir ? "Toca una semana para verla" : `La altura mide ${metrica === "pedidos" ? "pedidos" : "soles"}`}
          </p>
        </div>
        <div role="group" aria-label="Qué mide la altura de la barra" className="flex gap-0.5 rounded-chip bg-sup-2 p-0.5">
          {(["pedidos", "soles"] as const).map((m) => (
            <button
              key={m}
              type="button"
              aria-pressed={metrica === m}
              onClick={() => setMetrica(m)}
              className={`rounded-chip px-3 py-1.5 text-xs font-bold capitalize ${
                metrica === m ? "bg-sup text-tinta" : "text-tinta-3"
              }`}
            >
              {m}
            </button>
          ))}
        </div>
      </div>

      <div className="flex items-end gap-1.5 pt-1">
        {semanas.map((s) => {
          const valor = valorDe(s);
          const alto = valor > 0 ? Math.max(6, Math.round((valor / max) * ALTO)) : 0;
          const esta = elegida === s.lunes;
          // Una semana sin ningún día trabajado no es un «0»: es que no hay nada que contar.
          const vacia = s.totales.diasTrabajados === 0;
          const parcial = esParcial(s);
          const etiqueta = `Sem. ${Number(s.desde.slice(8))}–${Number(s.hasta.slice(8))}: ${s.totales.pedidos} pedidos, ${formatearSoles(s.totales.centimos)}`;

          const contenido = (
            <>
              <span className="flex flex-col items-center">
                <span className="font-display text-[14px] leading-tight font-bold tabular-nums">
                  {vacia ? "–" : metrica === "pedidos" ? s.totales.pedidos : Math.round(s.totales.centimos / 100)}
                </span>
                <span className="font-mono text-[9px] text-tinta-3 tabular-nums">
                  {vacia ? "\u00a0" : metrica === "pedidos" ? Math.round(s.totales.centimos / 100) : `${s.totales.pedidos} ped.`}
                </span>
              </span>
              <span className="flex w-full flex-1 items-end justify-center" style={{ height: `${ALTO}px` }}>
                {alto > 0 ? (
                  <span
                    className={`w-[70%] max-w-[30px] rounded-t rounded-b-[2px] ${esta || !elegida ? "bg-barra" : "bg-barra-extra"}`}
                    style={{ height: `${alto}px` }}
                  />
                ) : (
                  <span className="h-3 w-[70%] max-w-[30px] rounded-chip border border-dashed border-linea-fuerte" />
                )}
              </span>
              <span className={`font-mono text-[9px] whitespace-nowrap ${esta ? "font-bold text-tinta" : "text-tinta-3"}`}>
                {Number(s.desde.slice(8))}–{Number(s.hasta.slice(8))}
                {parcial && "*"}
              </span>
            </>
          );

          const clases = `flex min-w-0 flex-1 flex-col items-center gap-1 rounded-chip px-0.5 py-1.5 ${
            esta ? "bg-sup-2 ring-2 ring-acento" : ""
          }`;

          return alElegir ? (
            <button
              key={s.lunes}
              type="button"
              aria-pressed={esta}
              aria-label={etiqueta}
              onClick={() => alElegir(s.lunes)}
              className={`${clases} hover:bg-sup-2`}
            >
              {contenido}
            </button>
          ) : (
            <div key={s.lunes} role="img" aria-label={etiqueta} className={clases}>
              {contenido}
            </div>
          );
        })}
      </div>

      {semanas.some(esParcial) && (
        <p className="text-[11px] text-tinta-3">* Semana incompleta: solo cuenta los días de este rango.</p>
      )}
    </div>
  );
}
