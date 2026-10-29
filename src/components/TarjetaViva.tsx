"use client";

import { useEffect, useState } from "react";

import { FiguraDeAccion, type ClaveDeAccion } from "@/components/Acciones";
import { Auto } from "@/components/Auto";
import { Estrella, Flecha } from "@/components/iconos";
import { useCifraAnimada } from "@/hooks/useCifraAnimada";
import { sonar } from "@/lib/sonidos";
import type { CategoriaIngreso } from "@/lib/pagos/bloques-extra";
import type { FilaDeDesglose } from "@/lib/pagos/desglose";
import { formatearSoles, type TipoVehiculo } from "@/lib/pagos/reglas";

/* El color de cada fuente es el de su acción: la tienda lleva el de la marca, el
   apoyo el turquesa, y los adicionales el vino. El anillo y la leyenda los comparten. */
const COLOR: Record<CategoriaIngreso, string> = { tienda: "var(--acento)", apoyo: "var(--c-apoyo)", taxi: "var(--c-adic)" };
const NOMBRE: Record<CategoriaIngreso, string> = { tienda: "Mi tienda", apoyo: "Apoyo", taxi: "Adicionales" };
const ACCION_DE: Record<CategoriaIngreso, ClaveDeAccion> = { tienda: "tienda", apoyo: "apoyo", taxi: "adicional" };
const R = 44;
const C = 2 * Math.PI * R;

/**
 * La tarjeta del día, con vida: la cifra del día que cuenta hacia arriba, el auto
 * recorriendo su carretera, y un **anillo** que se dibuja solo y reparte lo de
 * hoy entre tienda, apoyo y adicionales. Debajo, una fila por fuente con su
 * figura de color y su propia cifra animada.
 *
 * Tocar un tramo del anillo o una fila suena (cada fuente suena distinto) y
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

  const fuentes = (["tienda", "apoyo", "taxi"] as const).map((c) => ({
    c,
    centimos: filas.filter((f) => f.categoria === c).reduce((s, f) => s + f.centimos, 0),
  }));
  const conMonto = fuentes.filter((x) => x.centimos > 0);
  const suma = conMonto.reduce((s, x) => s + x.centimos, 0);
  let acumulado = 0;

  function tocar(c: CategoriaIngreso) {
    sonar(c);
    alElegir(c);
  }

  return (
    <section id="recorrido-tarjeta" className="tarjeta-dia ini-hero ini-rise" style={{ animationDelay: "210ms" }} aria-label={`${encabezado} ${formatearSoles(totalCentimos)}`}>
      <div className="relative flex flex-wrap items-center gap-2 font-bold">
        <p className="text-sm">{encabezado}</p>
        {record && (
          <span className="pop ini-chip ini-chip--record">
            <Estrella className="size-3.5" />
            ¡Récord!
          </span>
        )}
        {racha >= 2 && (
          <span className="pop ini-chip" style={{ "--i": 1 } as React.CSSProperties}>
            <span className="inline-block animate-[llama_1.2s_ease-in-out_infinite_alternate]">🔥</span> {racha} días
          </span>
        )}
      </div>

      <b className="ini-tot">{formatearSoles(Math.round(total))}</b>
      <p className="relative text-sm font-bold opacity-90">
        {pedidos} pedido{pedidos === 1 ? "" : "s"} · {rutas} ruta{rutas === 1 ? "" : "s"}
      </p>

      <div className="ini-road" aria-hidden>
        <span className="ini-car">
          <Auto vehiculo={vehiculo} sobreAcento className="w-[58px]" />
        </span>
      </div>

      <div className="ini-anillo">
        <div className="relative mx-auto size-[156px]">
          <svg viewBox="0 0 100 100" className="size-full -rotate-90 overflow-visible" role="img" aria-label="Reparto de lo de hoy">
            <circle cx="50" cy="50" r={R} fill="none" stroke="var(--sup-2)" strokeWidth="11" />
            {suma > 0 &&
              conMonto.map((x) => {
                const fraccion = x.centimos / suma;
                const largo = Math.max(fraccion * C - (conMonto.length > 1 ? 4 : 0), 3);
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
            <span className="font-display text-xl leading-none font-semibold tabular-nums">{formatearSoles(Math.round(total))}</span>
            <span className="mt-1 text-[0.7rem] font-bold text-tinta-2">Total del día</span>
          </div>
        </div>

        <div className="mt-2 flex flex-col gap-1">
          {fuentes.map((x, i) => (
            <FilaDeFuente
              key={x.c}
              categoria={x.c}
              centimos={x.centimos}
              detalle={x.c === "tienda" && pedidos > 0 ? `${pedidos} pedido${pedidos === 1 ? "" : "s"}` : undefined}
              indice={i}
              alTocar={() => tocar(x.c)}
            />
          ))}
        </div>
      </div>
    </section>
  );
}

/** Una fuente del día: su figura de color, su nombre y su cifra, que cuenta hacia arriba. */
function FilaDeFuente({
  categoria,
  centimos,
  detalle,
  indice,
  alTocar,
}: {
  categoria: CategoriaIngreso;
  centimos: number;
  detalle?: string;
  indice: number;
  alTocar: () => void;
}) {
  const cifra = useCifraAnimada(centimos, 900);
  const vacia = centimos <= 0;
  return (
    <button
      type="button"
      onClick={alTocar}
      disabled={vacia}
      className={`ini-lg ini-rise ${vacia ? "ini-lg--cero" : ""}`}
      style={{ animationDelay: `${300 + indice * 90}ms` }}
    >
      <FiguraDeAccion k={ACCION_DE[categoria]} className="ini-lg__fig" />
      <span className="flex min-w-0 flex-1 flex-col text-left leading-tight">
        <b>{NOMBRE[categoria]}</b>
        {detalle && <small className="text-[0.7rem] text-tinta-2">{detalle}</small>}
      </span>
      <span className="font-display font-semibold tabular-nums">{vacia ? "—" : formatearSoles(Math.round(cifra))}</span>
      {!vacia && <Flecha className="size-4 shrink-0 text-tinta-3" />}
    </button>
  );
}
