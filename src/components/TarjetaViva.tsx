"use client";

import { useEffect, useState } from "react";

import { Auto } from "@/components/Auto";
import { Estrella } from "@/components/iconos";
import { useCifraAnimada } from "@/hooks/useCifraAnimada";
import { sonar } from "@/lib/sonidos";
import type { CategoriaIngreso } from "@/lib/pagos/bloques-extra";
import type { FilaDeDesglose } from "@/lib/pagos/desglose";
import { formatearSoles, type TipoVehiculo } from "@/lib/pagos/reglas";

/* Colores de cada fuente SOBRE la tarjeta, sacados de la cara activa (ver `--h-*`
   en globals.css): se leen contra el color de la tarjeta en las seis caras. */
const COLOR: Record<CategoriaIngreso, string> = { tienda: "var(--h-tienda)", apoyo: "var(--h-apoyo)", taxi: "var(--h-taxi)" };
const NOMBRE: Record<CategoriaIngreso, string> = { tienda: "Tienda", apoyo: "Apoyo", taxi: "Taxi" };
const R = 44;
const C = 2 * Math.PI * R;

/** Las animaciones propias de cada ficha: barras que suben, un reloj que gira, una ruta que se dibuja. */
function Mini({ c }: { c: CategoriaIngreso }) {
  if (c === "tienda")
    return (
      <svg viewBox="0 0 60 28" className="h-7 w-full overflow-visible" aria-hidden>
        {[10, 17, 13, 24, 19].map((h, i) => (
          <rect key={i} className="barra-sube" style={{ "--i": i } as React.CSSProperties} x={i * 12} y={28 - h} width="8" height={h} rx="2.5" fill="var(--acento-tinta)" />
        ))}
      </svg>
    );
  if (c === "apoyo")
    return (
      <svg viewBox="0 0 30 28" className="h-7 w-full overflow-visible" aria-hidden>
        <circle cx="15" cy="14" r="11" fill="none" stroke="var(--sup-2)" strokeWidth="3.5" />
        <circle cx="15" cy="14" r="11" fill="none" stroke="var(--f-apoyo)" strokeWidth="3.5" strokeLinecap="round" strokeDasharray="52 70" transform="rotate(-90 15 14)" />
        <line className="aguja-gira" x1="15" y1="14" x2="15" y2="7" stroke="var(--tinta)" strokeWidth="2" strokeLinecap="round" />
      </svg>
    );
  return (
    <svg viewBox="0 0 60 28" className="h-7 w-full overflow-visible" aria-hidden>
      <path className="ruta-traza" d="M2,23 C14,21 14,6 27,10 S45,24 58,5" fill="none" stroke="var(--f-taxi)" strokeWidth="3" strokeLinecap="round" />
      <circle cx="58" cy="5" r="3" fill="var(--f-taxi)" />
    </svg>
  );
}

/**
 * La tarjeta del día, con vida: un **anillo** que se dibuja solo y reparte lo de
 * hoy entre tienda, apoyo y taxi, el total que cuenta hacia arriba, y —si hay
 * más de una fuente— una **ficha** por cada una con su propia animación.
 *
 * Tocar un tramo del anillo o una ficha suena (cada fuente suena distinto) y
 * despliega el detalle de esa fuente en la lista de abajo.
 */
export function TarjetaViva({
  encabezado,
  pedidos,
  rutas,
  filas,
  totalCentimos,
  vehiculo,
  racha = 0,
  record = false,
  alElegir,
}: {
  encabezado: string;
  pedidos: number;
  rutas: number;
  filas: readonly FilaDeDesglose[];
  totalCentimos: number;
  vehiculo: TipoVehiculo;
  /** Días seguidos cargados, contando este. */
  racha?: number;
  /** Hoy superó cualquier otro día cercano. */
  record?: boolean;
  alElegir: (categoria: CategoriaIngreso) => void;
}) {
  const [listo, setListo] = useState(false);
  const total = useCifraAnimada(totalCentimos);

  useEffect(() => {
    const t = setTimeout(() => setListo(true), 120);
    return () => clearTimeout(t);
  }, []);

  const porCategoria = (["tienda", "apoyo", "taxi"] as const)
    .map((c) => ({ c, centimos: filas.filter((f) => f.categoria === c).reduce((s, f) => s + f.centimos, 0) }))
    .filter((x) => x.centimos > 0);
  const suma = porCategoria.reduce((s, x) => s + x.centimos, 0);
  let acumulado = 0;

  function tocar(c: CategoriaIngreso) {
    sonar(c);
    alElegir(c);
  }

  return (
    <section id="recorrido-tarjeta" className="tarjeta-dia" aria-label={`${encabezado} ${formatearSoles(totalCentimos)}`}>
      <div className="flex items-start justify-between gap-2">
        <p className="text-[13px] font-semibold opacity-90">{encabezado}</p>
        <div className="flex gap-1.5">
          {record && (
            <span className="pop inline-flex items-center gap-1 rounded-chip bg-acento-texto px-2 py-0.5 text-[11px] font-bold text-acento">
              <Estrella className="size-3" />
              ¡Récord!
            </span>
          )}
          {racha >= 2 && (
            <span className="pop rounded-chip border border-acento-texto/40 px-2 py-0.5 text-[11px] font-bold" style={{ "--i": 1 } as React.CSSProperties}>
              <span className="inline-block animate-[llama_1.2s_ease-in-out_infinite_alternate]">🔥</span> {racha} días
            </span>
          )}
        </div>
      </div>

      <div className="mt-1 flex items-center gap-3">
        <div className="relative size-[136px] shrink-0">
          <svg viewBox="0 0 100 100" className="size-full -rotate-90 overflow-visible" role="img" aria-label="Reparto de lo de hoy">
            <circle cx="50" cy="50" r={R} fill="none" stroke="rgba(255,255,255,.2)" strokeWidth="11" />
            {suma > 0 &&
              porCategoria.map((x) => {
                const fraccion = x.centimos / suma;
                const largo = Math.max(fraccion * C - (porCategoria.length > 1 ? 4 : 0), 3);
                const desde = acumulado;
                acumulado += fraccion * C;
                return (
                  <circle
                    key={x.c}
                    cx="50"
                    cy="50"
                    r={R}
                    fill="none"
                    stroke={COLOR[x.c]}
                    strokeWidth="11"
                    strokeLinecap="round"
                    strokeDasharray={`${largo} ${C}`}
                    strokeDashoffset={listo ? -desde : largo}
                    style={{ transition: "stroke-dashoffset 1.3s cubic-bezier(.2,.8,.2,1)", cursor: "pointer" }}
                    onClick={() => tocar(x.c)}
                  />
                );
              })}
          </svg>
          <div className="pointer-events-none absolute inset-0 grid place-content-center text-center">
            <span className="font-mono text-[19px] leading-none font-bold tabular-nums">{formatearSoles(Math.round(total))}</span>
            <span className="mt-1 text-[10.5px] font-semibold opacity-85">Total del día</span>
          </div>
        </div>

        <div className="relative flex min-w-0 flex-1 flex-col gap-1">
          <span className="text-[12px] font-semibold opacity-90">Toca un color</span>
          {porCategoria.map((x) => (
            <button key={x.c} type="button" onClick={() => tocar(x.c)} className="flex min-h-8 items-center gap-1.5 text-left text-[12.5px]">
              <span className="size-2.5 shrink-0 rounded-full" style={{ background: COLOR[x.c] }} />
              <span className="flex min-w-0 flex-col leading-tight">
                <span className="opacity-90">{NOMBRE[x.c]}</span>
                {/* Los pedidos y las rutas son solo de la tienda: se dicen junto a ella, no bajo el total. */}
                {x.c === "tienda" && pedidos > 0 && (
                  <span className="text-[10.5px] opacity-75">
                    {pedidos} pedido{pedidos === 1 ? "" : "s"} · {rutas} ruta{rutas === 1 ? "" : "s"}
                  </span>
                )}
              </span>
              <b className="ml-auto font-mono tabular-nums">{formatearSoles(x.centimos)}</b>
            </button>
          ))}
          <Auto vehiculo={vehiculo} sobreAcento animado className="pointer-events-none mt-1 ml-auto w-[88px] -rotate-[3deg]" />
        </div>
      </div>

      {porCategoria.length > 1 && (
        <div className="mt-3 grid grid-cols-3 gap-2" style={{ gridTemplateColumns: `repeat(${porCategoria.length}, minmax(0, 1fr))` }}>
          {porCategoria.map((x, i) => (
            <button
              key={x.c}
              type="button"
              onClick={() => tocar(x.c)}
              className="entra flex flex-col gap-0.5 rounded-[16px] bg-sup p-2.5 text-left text-tinta active:scale-95"
              style={{ "--i": i + 3, transition: "transform .15s" } as React.CSSProperties}
            >
              <Mini c={x.c} />
              <small className="text-[10.5px] font-semibold text-tinta-2">{NOMBRE[x.c]}</small>
              <b className="font-mono text-[13px] tabular-nums">{formatearSoles(x.centimos)}</b>
            </button>
          ))}
        </div>
      )}
    </section>
  );
}
