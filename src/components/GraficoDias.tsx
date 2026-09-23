"use client";

import { useRef, useState } from "react";

import { Luna } from "@/components/iconos";
import { formatearDuracion, formatearFecha, nombreDelDia, type FechaISO } from "@/lib/fechas";
import { formatearSoles } from "@/lib/pagos/reglas";

/**
 * Gráfico principal de Estadísticas (§10): pedidos y soles por día.
 *
 * Decisiones que vienen de §10 y conviene no deshacer:
 *
 *  - **Un solo eje.** Como casi todos los pedidos pagan S/ 10, pedidos y soles
 *    suben casi iguales; una segunda serie solo ensuciaría el gráfico. El monto
 *    va como etiqueta, que además se lee mejor en un celular.
 *  - **Los días sin carga son un hueco**, con marca tenue, no una barra en
 *    cero: no es lo mismo "no trabajé" que "no lo subí".
 *  - **El segmento superior** en otro tono son los pedidos fuera del tramo 1,
 *    para ver de dónde sale el extra.
 *
 * La rampa de dos pasos está validada: luminosidad monótona, salto suficiente
 * entre pasos y contraste del extremo claro contra la superficie.
 */

export interface DiaGrafico {
  fecha: FechaISO;
  cargado: boolean;
  /** No se trabajó, dicho por el repartidor: no es lo mismo que «sin subir». */
  descanso?: boolean;
  pedidos: number;
  rutas: number;
  minutos: number;
  centimos: number;
  fueraTramo1: number;
}

const ALTO = 176;

export function GraficoDias({ dias }: { dias: DiaGrafico[] }) {
  const [metrica, setMetrica] = useState<"pedidos" | "soles">("pedidos");
  const [activo, setActivo] = useState<number | null>(null);
  const contenedor = useRef<HTMLDivElement>(null);

  const conDatos = dias.filter((d) => d.cargado);
  if (conDatos.length === 0) {
    return <p className="py-10 text-center text-sm text-tinta-3">Todavía no hay días cargados.</p>;
  }

  const valorDe = (d: DiaGrafico) => (metrica === "pedidos" ? d.pedidos : d.centimos / 100);
  const max = Math.max(...conDatos.map(valorDe));
  const promedio = conDatos.reduce((s, d) => s + valorDe(d), 0) / conDatos.length;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <span className="rotulo">Pedidos y soles por día</span>
          <p className="text-sm text-tinta-2">
            La altura mide {metrica === "pedidos" ? "pedidos" : "soles"}
          </p>
        </div>
        <div
          role="group"
          aria-label="Qué mide la altura de la barra"
          className="flex gap-0.5 rounded-chip bg-sup-2 p-0.5"
        >
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

      <div ref={contenedor} className="relative overflow-x-auto pb-2">
        <div className="relative flex h-[244px] items-end gap-1.5 pt-[38px]">
          {/* rejilla y promedio, recesivos */}
          <div className="pointer-events-none absolute inset-x-0 top-[38px] bottom-[22px]">
            <span className="absolute inset-x-0 top-0 border-t border-linea" />
            <span className="absolute inset-x-0 top-1/3 border-t border-linea" />
            <span className="absolute inset-x-0 top-2/3 border-t border-linea" />
          </div>
          <div
            className="pointer-events-none absolute inset-x-0 border-t-2 border-dashed border-acento opacity-60"
            style={{ bottom: `${Math.round((promedio / max) * ALTO) + 22}px` }}
          >
            <b className="absolute -top-4 right-0 bg-papel px-1 font-mono text-[10px] font-medium text-acento">
              prom. {metrica === "pedidos" ? promedio.toFixed(1) : promedio.toFixed(2)}
            </b>
          </div>
          <span className="pointer-events-none absolute inset-x-0 bottom-[22px] border-t border-linea-fuerte" />

          {dias.map((d, i) => {
            if (!d.cargado) {
              return (
                <div
                  key={d.fecha}
                  className="relative flex h-full w-[54px] shrink-0 flex-col items-center justify-end rounded-chip pb-[22px]"
                >
                  {d.descanso ? (
                    <>
                      <Luna aria-label="Descanso" className="mb-1.5 size-4 text-tinta-2" />
                      <span className="h-3.5 w-[26px] rounded-chip bg-descanso" />
                    </>
                  ) : (
                    <>
                      <span className="mb-1.5 font-mono text-sm text-tinta-3">—</span>
                      <span className="h-3.5 w-[26px] rounded-chip border border-dashed border-linea-fuerte" />
                    </>
                  )}
                  <span className="absolute inset-x-0 bottom-0 text-center font-mono text-[9px] text-tinta-3">
                    {Number(d.fecha.slice(8, 10))}
                  </span>
                </div>
              );
            }

            const valor = valorDe(d);
            const alto = Math.max(6, Math.round((valor / max) * ALTO));
            const altoExtra = d.fueraTramo1
              ? Math.max(4, Math.round(alto * (d.fueraTramo1 / d.pedidos)))
              : 0;

            return (
              <div
                key={d.fecha}
                tabIndex={0}
                role="button"
                aria-label={`${nombreDelDia(d.fecha)} ${formatearFecha(d.fecha)}: ${d.pedidos} pedidos, ${formatearSoles(d.centimos)}`}
                onMouseEnter={() => setActivo(i)}
                onFocus={() => setActivo(i)}
                onClick={() => setActivo(i)}
                onMouseLeave={() => setActivo(null)}
                onBlur={() => setActivo(null)}
                className={`relative flex h-full w-[54px] shrink-0 flex-col items-center justify-end rounded-chip pb-[22px] ${
                  activo === i ? "bg-sup-2" : "hover:bg-sup-2"
                }`}
              >
                <span className="mb-1.5 flex flex-col items-center">
                  <span className="font-display text-[15px] leading-tight font-bold tabular-nums">
                    {metrica === "pedidos" ? d.pedidos : (d.centimos / 100).toFixed(2)}
                  </span>
                  <span className="font-mono text-[9px] text-tinta-3 tabular-nums">
                    {metrica === "pedidos" ? (d.centimos / 100).toFixed(2) : `${d.pedidos} ped.`}
                  </span>
                </span>

                <span
                  className="flex w-[26px] flex-col justify-end gap-0.5"
                  style={{ height: `${alto}px` }}
                >
                  {altoExtra > 0 && (
                    <span
                      className="rounded-t bg-barra-extra"
                      style={{ height: `${altoExtra}px` }}
                    />
                  )}
                  <span
                    className={`bg-barra ${altoExtra > 0 ? "rounded-b-[2px]" : "rounded-t rounded-b-[2px]"}`}
                    style={{ height: `${alto - altoExtra}px` }}
                  />
                </span>

                <span className="absolute inset-x-0 bottom-0 text-center font-mono text-[9px] text-tinta-3">
                  {Number(d.fecha.slice(8, 10))}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {activo !== null && dias[activo].cargado && (
        <div className="rounded-btn bg-sup-2 px-4 py-3 text-xs">
          <b className="mb-1 block text-sm capitalize">
            {nombreDelDia(dias[activo].fecha)} {formatearFecha(dias[activo].fecha)}
          </b>
          <dl className="grid grid-cols-[1fr_auto] gap-x-3 gap-y-0.5">
            <dt className="text-tinta-3">Pedidos</dt>
            <dd className="font-mono tabular-nums">{dias[activo].pedidos}</dd>
            <dt className="text-tinta-3">Rutas</dt>
            <dd className="font-mono tabular-nums">{dias[activo].rutas}</dd>
            <dt className="text-tinta-3">En ruta</dt>
            <dd className="font-mono tabular-nums">{formatearDuracion(dias[activo].minutos)}</dd>
            <dt className="text-tinta-3">Fuera de tramo 1</dt>
            <dd className="font-mono tabular-nums">{dias[activo].fueraTramo1}</dd>
            <dt className="text-tinta-3">Monto</dt>
            <dd className="font-mono tabular-nums">{formatearSoles(dias[activo].centimos)}</dd>
          </dl>
        </div>
      )}

      <div className="flex flex-wrap gap-3 text-xs text-tinta-2">
        <span className="inline-flex items-center gap-1.5">
          <i className="inline-block size-2.5 rounded-[3px] bg-barra" />
          Tramo 1
        </span>
        <span className="inline-flex items-center gap-1.5">
          <i className="inline-block size-2.5 rounded-[3px] bg-barra-extra" />
          Más de 3 km
        </span>
        <span className="inline-flex items-center gap-1.5">
          <i className="inline-block size-2.5 rounded-[3px] border border-dashed border-linea-fuerte" />
          Sin carga
        </span>
        {dias.some((d) => d.descanso) && (
          <span className="inline-flex items-center gap-1.5">
            <i className="inline-block size-2.5 rounded-[3px] bg-descanso" />
            Descanso
          </span>
        )}
        <span className="text-acento">– – promedio del rango</span>
      </div>
    </div>
  );
}
