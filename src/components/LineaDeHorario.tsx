"use client";

import { useState } from "react";

import { sonar } from "@/lib/sonidos";

const aHoras = (h: string): number => Number(h.slice(0, 2)) + Number(h.slice(3, 5)) / 60;

/**
 * El horario de un apoyo o de una carrera sobre la cinta de horas del día: una
 * barra que crece de la entrada a la salida y un **cursor luminoso** que
 * recorre el día hasta la hora de salida. Tocarla repite el recorrido, con su
 * sonido.
 */
export function LineaDeHorario({
  inicio,
  fin,
  color,
  etiqueta,
}: {
  inicio: string;
  fin: string | null;
  color: string;
  etiqueta?: string;
}) {
  const [vuelta, setVuelta] = useState(0);
  const desde = 5;
  const hasta = 24;
  const x = (h: number) => Math.min(100, Math.max(0, ((h - desde) / (hasta - desde)) * 100));
  const a = aHoras(inicio);
  const b = fin ? aHoras(fin) : a + 0.4;
  const termina = b < a ? hasta : b; // pasó de medianoche: se corta en el borde

  return (
    <button
      key={vuelta}
      type="button"
      onClick={() => {
        sonar("barrido");
        setVuelta((v) => v + 1);
      }}
      aria-label={`Horario de ${inicio} a ${fin ?? "—"}. Toca para repetir la animación`}
      className="relative h-[84px] w-full overflow-hidden rounded-[14px] bg-tinta text-left"
    >
      {[6, 9, 12, 15, 18, 21].map((h) => (
        <span key={h} className="absolute inset-y-0 border-l border-dashed border-white/20 pl-1 text-[10px] font-semibold text-white/60" style={{ left: `${x(h)}%` }}>
          {h}
        </span>
      ))}
      <span
        className="linea-crece absolute top-7 flex h-[34px] items-center justify-center overflow-hidden rounded-[10px] px-1 text-[11px] font-bold text-white"
        style={{ left: `${x(a)}%`, width: `${Math.max(x(termina) - x(a), 3)}%`, background: color }}
      >
        {etiqueta}
      </span>
      <span
        className="linea-cursor absolute inset-y-0 w-[2px] bg-white"
        style={{ "--fin": `${x(termina)}%` } as React.CSSProperties}
      />
      <span className="absolute right-2 bottom-1 font-mono text-[11px] text-white/80">
        {inicio} → {fin ?? "—"}
      </span>
    </button>
  );
}
