"use client";

import { useState } from "react";

import { Luna } from "@/components/iconos";
import { escalaDelEje, type DiaGrafico } from "@/lib/estadisticas";
import { formatearDuracion, nombreDelDia } from "@/lib/fechas";
import { formatearSoles } from "@/lib/pagos/reglas";

/**
 * Pedidos (o soles) por día de una semana, en el espacio de una pantalla: título
 * con su selector, eje con marcas redondas, la cifra sobre cada barra y la línea
 * del promedio.
 *
 * Es la versión compacta de `GraficoDias`, hecha para siete días que caben sin
 * deslizar. Lo que se conserva de aquella: los días **sin carga son un hueco**
 * con un guion —no una barra en cero— y los de descanso llevan luna; y el
 * segmento de arriba, en un tono más claro, son los pedidos de más de 3 km.
 * Tocar una barra dice qué hubo ese día.
 */

const ALTO = 132;
/** Lo que ocupan las etiquetas de abajo dentro de la altura del gráfico. */
const PIE = 20;

export function GraficoDeLaSemana({ dias }: { dias: DiaGrafico[] }) {
  const [metrica, setMetrica] = useState<"pedidos" | "soles">("pedidos");
  const [activo, setActivo] = useState<number | null>(null);

  const valorDe = (d: DiaGrafico) => (metrica === "pedidos" ? d.pedidos : d.centimos / 100);
  const conDatos = dias.filter((d) => d.cargado);
  const escala = escalaDelEje(Math.max(0, ...conDatos.map(valorDe)));
  const promedio = conDatos.length ? conDatos.reduce((s, d) => s + valorDe(d), 0) / conDatos.length : 0;
  const alturaDe = (v: number) => Math.round((v / escala.techo) * ALTO);
  const hayExtra = conDatos.some((d) => d.fueraTramo1 > 0);

  return (
    <section className="tarjeta flex flex-col gap-2 !p-3.5" aria-label="Gráfico de la semana">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-base leading-tight font-bold">
          {metrica === "pedidos" ? "Pedidos por día" : "Soles por día"}
        </h3>
        <label className="relative">
          <span className="sr-only">Qué mide la altura de la barra</span>
          <select
            value={metrica}
            onChange={(e) => setMetrica(e.target.value as "pedidos" | "soles")}
            className="min-h-9 appearance-none rounded-btn border border-linea-fuerte bg-sup py-1 pr-7 pl-3 text-sm font-semibold text-acento-tinta"
          >
            <option value="pedidos">Pedidos</option>
            <option value="soles">Soles</option>
          </select>
          <span aria-hidden className="pointer-events-none absolute top-1/2 right-2.5 -translate-y-1/2 text-[9px] text-acento-tinta">
            ▼
          </span>
        </label>
      </div>

      <div className="flex" style={{ height: `${ALTO + PIE + 18}px` }}>
        {/* El eje: las marcas, a la altura que les toca. */}
        <div className="relative w-8 shrink-0" aria-hidden>
          {escala.marcas.map((m) => (
            <span
              key={m}
              className="absolute right-1.5 font-mono text-[10px] text-tinta-3 tabular-nums"
              style={{ bottom: `${alturaDe(m) + PIE}px`, transform: "translateY(50%)" }}
            >
              {m}
            </span>
          ))}
        </div>

        <div className="relative min-w-0 flex-1">
          {/* La rejilla, punteada y recesiva. */}
          {escala.marcas.map((m) => (
            <span
              key={m}
              aria-hidden
              className="pointer-events-none absolute inset-x-0 border-t border-dotted border-linea-fuerte"
              style={{ bottom: `${alturaDe(m) + PIE}px` }}
            />
          ))}

          {/* El promedio: la línea, y su rótulo **arriba del todo**, sobre la rejilla,
              donde no pisa la cifra de ninguna barra. */}
          {promedio > 0 && (
            <>
              <div
                aria-hidden
                className="pointer-events-none absolute inset-x-0 border-t-2 border-dashed border-acento opacity-70"
                style={{ bottom: `${alturaDe(promedio) + PIE}px` }}
              />
              <b className="absolute top-0 right-0 rounded-chip border border-linea-fuerte bg-sup px-1.5 py-px font-mono text-[10px] font-medium whitespace-nowrap text-acento-tinta">
                <span aria-hidden className="mr-1 text-acento">
                  – –
                </span>
                Promedio: {metrica === "pedidos" ? `${promedio.toFixed(1)} ped.` : formatearSoles(Math.round(promedio * 100))}
              </b>
            </>
          )}

          <div className="relative flex h-full items-stretch gap-1">
            {dias.map((d, i) => {
              const nombre = nombreDelDia(d.fecha).slice(0, 3);
              const etiqueta = (
                <span className="absolute inset-x-0 bottom-0 text-center font-mono text-[10px] whitespace-nowrap text-tinta-2 capitalize">
                  {nombre} {Number(d.fecha.slice(8))}
                </span>
              );

              if (!d.cargado) {
                return (
                  <div key={d.fecha} className="relative flex min-w-0 flex-1 flex-col items-center justify-end" style={{ paddingBottom: `${PIE}px` }}>
                    {d.futuro ? null : d.descanso ? (
                      <Luna aria-label="Descanso" className="mb-1 size-4 text-tinta-2" />
                    ) : (
                      <span className="mb-1 font-mono text-sm text-tinta-3" aria-label="Sin carga">
                        —
                      </span>
                    )}
                    {etiqueta}
                  </div>
                );
              }

              const alto = Math.max(5, alturaDe(valorDe(d)));
              const altoExtra = d.fueraTramo1 ? Math.max(3, Math.round(alto * (d.fueraTramo1 / d.pedidos))) : 0;
              const lado = i <= 1 ? "left-0" : i >= dias.length - 2 ? "right-0" : "left-1/2 -translate-x-1/2";

              return (
                <button
                  key={d.fecha}
                  type="button"
                  aria-pressed={activo === i}
                  aria-label={`${nombre} ${Number(d.fecha.slice(8))}: ${d.pedidos} pedidos, ${formatearSoles(d.centimos)}`}
                  onClick={() => setActivo((a) => (a === i ? null : i))}
                  className="relative flex min-w-0 flex-1 flex-col items-center justify-end"
                  style={{ paddingBottom: `${PIE}px` }}
                >
                  <span className="mb-0.5 font-display text-[13px] leading-none font-bold tabular-nums">
                    {metrica === "pedidos" ? d.pedidos : Math.round(d.centimos / 100)}
                  </span>
                  <span className="flex w-[62%] max-w-[30px] flex-col justify-end gap-px" style={{ height: `${alto}px` }}>
                    {altoExtra > 0 && <span className="rounded-t bg-barra-extra" style={{ height: `${altoExtra}px` }} />}
                    <span
                      className={`bg-barra ${altoExtra > 0 ? "rounded-b-[2px]" : "rounded-t rounded-b-[2px]"} ${
                        activo === i ? "ring-2 ring-tinta" : ""
                      }`}
                      style={{ height: `${alto - altoExtra}px` }}
                    />
                  </span>
                  {etiqueta}

                  {activo === i && (
                    <span
                      role="status"
                      className={`absolute bottom-full z-10 mb-1 flex flex-col rounded-btn bg-tinta px-2.5 py-1.5 text-left text-[11px] leading-snug whitespace-nowrap text-papel shadow-alta ${lado}`}
                    >
                      <b className="capitalize">
                        {nombreDelDia(d.fecha)} {Number(d.fecha.slice(8))}
                      </b>
                      <span>
                        {d.pedidos} pedidos · {formatearSoles(d.centimos)}
                      </span>
                      <span>
                        {d.rutas} rutas · {formatearDuracion(d.minutos)}
                        {d.fueraTramo1 > 0 && ` · ${d.fueraTramo1} de +3 km`}
                      </span>
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {hayExtra && (
        <p className="flex items-center gap-1.5 text-[10.5px] text-tinta-3">
          <i className="inline-block size-2.5 rounded-[3px] bg-barra-extra" aria-hidden />
          El tramo más claro son los pedidos de más de 3 km.
        </p>
      )}
    </section>
  );
}
