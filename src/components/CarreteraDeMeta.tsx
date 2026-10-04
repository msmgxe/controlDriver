"use client";

import { useEffect, useState } from "react";

import { Auto } from "@/components/Auto";
import { sonar } from "@/lib/sonidos";
import { formatearSoles, type TipoVehiculo } from "@/lib/pagos/reglas";

/**
 * La carretera de la meta: el vehículo avanza **de izquierda a derecha** hasta
 * donde va el total de lo que llevas de la meta de la semana. Lleva banderines
 * al 25, 50, 75 y 100 % —se encienden al pasarlos—, una raya de eje que corre y
 * monedas que suben mientras avanza. Tocar la carretera la repite, con el sonido
 * del motor y, al llegar, la bocina.
 */
export function CarreteraDeMeta({
  totalCentimos,
  metaCentimos,
  vehiculo,
  porHoraCentimos,
}: {
  totalCentimos: number;
  metaCentimos: number;
  vehiculo: TipoVehiculo;
  /** Lo que rinde cada hora trabajada, si se sabe. */
  porHoraCentimos?: number | null;
}) {
  const [vuelta, setVuelta] = useState(0);
  const [avance, setAvance] = useState(0);
  const p = metaCentimos > 0 ? Math.min(totalCentimos / metaCentimos, 1) : 0;

  useEffect(() => {
    // Primero a la salida y luego hasta donde llega: dos pasos para que la transición se vea.
    const t0 = setTimeout(() => setAvance(0), 0);
    const t1 = setTimeout(() => setAvance(p), 160);
    return () => {
      clearTimeout(t0);
      clearTimeout(t1);
    };
  }, [p, vuelta]);

  function repetir() {
    sonar("motor");
    setVuelta((v) => v + 1);
    if (p >= 1) setTimeout(() => sonar("bocina"), 2300);
  }

  const falta = Math.max(metaCentimos - totalCentimos, 0);

  return (
    <div className="flex flex-col gap-1.5">
      <button
        type="button"
        onClick={repetir}
        aria-label={`Vas en ${Math.round(p * 100)} % de tu meta. Toca para repetir la animación`}
        className="carretera relative block h-[92px] w-full overflow-hidden rounded-[16px] bg-sup-2 text-left"
      >
        {/* Banderines de 25, 50, 75 y 100 %. */}
        {[0.25, 0.5, 0.75, 1].map((f) => (
          <span
            key={f}
            className="absolute top-2 flex flex-col items-center text-[10px] font-bold"
            style={{ left: `calc(${f * 100}% - ${f === 1 ? 34 : 10}px)` }}
          >
            <span className={`transition-colors duration-500 ${p >= f ? "text-[#c99700]" : "text-tinta-3"}`}>⚑</span>
            <span className="text-tinta-3">{f * 100}%</span>
          </span>
        ))}
        {/* La carretera, con su raya de eje corriendo. */}
        <span className="absolute inset-x-0 bottom-2 h-10 rounded-[10px] bg-tinta/90">
          <span className="carretera-raya absolute inset-x-2 top-1/2 h-[3px] -translate-y-1/2" />
        </span>
        {/* Lo recorrido, por debajo del vehículo. */}
        <span
          className="absolute bottom-2 left-0 h-10 rounded-l-[10px] bg-acento/40"
          style={{ width: `${avance * 100}%`, transition: "width 2.4s cubic-bezier(.3,.9,.3,1)" }}
        />
        <span
          className="absolute bottom-[10px] left-0"
          style={{
            transform: `translateX(calc(${avance} * (100cqw - 76px)))`,
            transition: "transform 2.4s cubic-bezier(.3,.9,.3,1)",
          }}
        >
          <Auto vehiculo={vehiculo} className="carretera-bota w-[72px]" />
        </span>
        {[0, 1, 2].map((i) => (
          <span key={i} className="carretera-moneda absolute top-9 text-[15px]" style={{ left: `${18 + i * 28}%`, animationDelay: `${i * 0.7}s` }}>
            <span className="grid size-[18px] place-items-center rounded-full border-2 border-[#8a6200] bg-[#ffc800] text-[9px] font-bold text-[#6b4a00]">S/</span>
          </span>
        ))}
      </button>

      <div className="flex items-baseline justify-between gap-2 text-xs text-tinta-2">
        <span>
          {p >= 1 ? "🏁 ¡Meta cumplida!" : `${Math.round(p * 100)} % de la meta · faltan ${formatearSoles(falta)}`}
        </span>
        <span className="font-mono text-tinta-3">meta {formatearSoles(metaCentimos)}</span>
      </div>
      {porHoraCentimos ? (
        <p className="text-xs text-tinta-2">
          Rindes <b className="font-mono">{formatearSoles(Math.round(porHoraCentimos))}</b> por hora trabajada (en ruta y apoyando).
        </p>
      ) : null}
    </div>
  );
}
