"use client";

import { useEffect, useState } from "react";

import { sonar } from "@/lib/sonidos";
import type { CategoriaIngreso } from "@/lib/pagos/bloques-extra";
import { formatearSoles } from "@/lib/pagos/reglas";

const COLOR: Record<CategoriaIngreso, string> = { tienda: "var(--acento)", apoyo: "var(--f-apoyo)", taxi: "var(--f-taxi)" };
const R = 100;
const MEDIO = Math.PI * R;

function arco(a0: number, a1: number): string {
  const p = (a: number) => [150 + R * Math.cos(a), 150 + R * Math.sin(a)];
  const [x0, y0] = p(a0);
  const [x1, y1] = p(a1);
  return `M${x0},${y0} A${R},${R} 0 ${a1 - a0 > Math.PI ? 1 : 0} 1 ${x1},${y1}`;
}

/**
 * El velocímetro de la meta: una media luna dividida en los colores de cada
 * fuente (tienda, apoyo, taxi) que se dibuja sola, y una aguja que **sube y
 * rebota** hasta tu avance. Tocarlo lo repite, con el sonido de un acelerón.
 */
export function VelocimetroDeMeta({
  titulo,
  porFuente,
  metaCentimos,
}: {
  titulo: string;
  porFuente: ReadonlyArray<{ categoria: CategoriaIngreso; centimos: number }>;
  metaCentimos: number;
}) {
  const [vuelta, setVuelta] = useState(0);
  const [listo, setListo] = useState(false);
  const total = porFuente.reduce((s, f) => s + f.centimos, 0);
  const p = metaCentimos > 0 ? Math.min(total / metaCentimos, 1) : 0;

  useEffect(() => {
    const t0 = setTimeout(() => setListo(false), 0);
    const t1 = setTimeout(() => setListo(true), 180);
    return () => {
      clearTimeout(t0);
      clearTimeout(t1);
    };
  }, [vuelta, total]);

  const activos = porFuente.filter((f) => f.centimos > 0);
  const tramos = activos.map((f, i) => {
    const barrido = (n: number) => (total > 0 ? (activos[n].centimos / total) * p * Math.PI : 0);
    const desde = Math.PI + activos.slice(0, i).reduce((s, _, n) => s + barrido(n), 0);
    return { ...f, d: arco(desde, desde + Math.max(barrido(i), 0.001)) };
  });

  return (
    <section className="tarjeta entra flex flex-col items-center gap-1 !p-3.5" aria-label={titulo}>
      <h3 className="self-start text-base leading-tight font-bold">{titulo}</h3>
      <button
        type="button"
        onClick={() => {
          sonar("acelerar");
          setVuelta((v) => v + 1);
        }}
        aria-label={`Vas en ${Math.round(p * 100)} % de la meta. Toca para repetir`}
        className="relative w-full max-w-[300px]"
      >
        <svg viewBox="0 0 300 170" className="w-full overflow-visible">
          <path d={arco(Math.PI, 2 * Math.PI)} fill="none" stroke="var(--sup-2)" strokeWidth="20" />
          {/* Marcas del 0, 50 y 100 %. */}
          {[0, 0.5, 1].map((f) => {
            const ang = Math.PI + f * Math.PI;
            return (
              <text key={f} x={150 + 122 * Math.cos(ang)} y={156 + 122 * Math.sin(ang) * 0.98} fontSize="11" textAnchor="middle" fill="var(--tinta-3)">
                {f * 100}%
              </text>
            );
          })}
          {tramos.map((t) => (
            <path
              key={t.categoria}
              d={t.d}
              fill="none"
              stroke={COLOR[t.categoria]}
              strokeWidth="20"
              strokeDasharray={MEDIO}
              strokeDashoffset={listo ? 0 : MEDIO}
              style={{ transition: "stroke-dashoffset 1.6s cubic-bezier(.2,.8,.2,1)" }}
            />
          ))}
          <g
            style={{
              transformOrigin: "150px 150px",
              transform: `rotate(${listo ? -90 + p * 180 : -90}deg)`,
              transition: "transform 2s cubic-bezier(.3,1.5,.4,1)",
            }}
          >
            <line x1="150" y1="150" x2="150" y2="56" stroke="var(--tinta)" strokeWidth="5" strokeLinecap="round" />
            <circle cx="150" cy="150" r="9" fill="var(--acento-2)" stroke="var(--tinta)" strokeWidth="3" />
          </g>
        </svg>
      </button>
      <div className="text-center">
        <b className="font-display text-[26px] leading-none tabular-nums [zoom:var(--zoom-titulo,1)]">{formatearSoles(total)}</b>
        <p className="text-xs text-tinta-2">
          {Math.round(p * 100)} % de tu meta de {formatearSoles(metaCentimos)}
        </p>
      </div>
    </section>
  );
}
