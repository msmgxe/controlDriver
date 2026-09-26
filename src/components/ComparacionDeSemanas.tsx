"use client";

import { useState } from "react";

import { Acordeon } from "@/components/Acordeon";
import { Cifras } from "@/components/ui";
import { comparar, type DiaGrafico, type FilaDeComparacion, type Totales } from "@/lib/estadisticas";
import { formatearDuracion, type FechaISO } from "@/lib/fechas";
import { formatearSoles } from "@/lib/pagos/reglas";

/**
 * Una semana frente a otra: las cifras con cuánto cambiaron, y un gráfico con
 * las dos, día por día.
 *
 * En el gráfico, cada día de la semana lleva dos barras: la de la semana que se
 * mira, **llena**, y la de con la que se compara, **solo contorno**. Así se
 * distinguen sin depender del color, que en un celular al sol no siempre alcanza.
 */

export interface SemanaAComparar {
  lunes: FechaISO;
  /** Etiqueta corta: «21–27». */
  rotulo: string;
  dias: DiaGrafico[];
  totales: Totales;
}

const LETRAS = ["L", "M", "X", "J", "V", "S", "D"];
const ALTO = 132;

export function ComparacionDeSemanas({ a, b }: { a: SemanaAComparar; b: SemanaAComparar }) {
  const filas = comparar(a.totales, b.totales);
  const de = (clave: FilaDeComparacion["clave"]) => filas.find((f) => f.clave === clave)!;

  return (
    <div className="flex flex-col gap-4">
      <Cifras
        datos={[
          { etiqueta: "Pedidos", valor: String(a.totales.pedidos), pie: cambio(de("pedidos"), b.rotulo) },
          { etiqueta: "Soles", valor: (a.totales.centimos / 100).toFixed(2), pie: cambio(de("soles"), b.rotulo) },
          { etiqueta: "Días trabajados", valor: String(a.totales.diasTrabajados), pie: cambio(de("dias"), b.rotulo) },
          {
            etiqueta: "Promedio por día",
            valor: a.totales.promedioPorDia.toFixed(1),
            pie: cambio(de("promedio"), b.rotulo),
          },
        ]}
      />

      <div className="tarjeta">
        <GraficoComparacion a={a} b={b} />
      </div>

      <Acordeon
        titulo="Cifra por cifra"
        resumen={`${a.totales.pedidos} pedidos frente a ${b.totales.pedidos} · ${formatearSoles(a.totales.centimos)} frente a ${formatearSoles(b.totales.centimos)}`}
      >
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-tinta-3">
                <th className="py-1.5 font-medium" />
                <th className="py-1.5 pr-2 text-right font-mono font-medium">{a.rotulo}</th>
                <th className="py-1.5 pr-2 text-right font-mono font-medium">{b.rotulo}</th>
                <th className="py-1.5 text-right font-medium">Cambio</th>
              </tr>
            </thead>
            <tbody>
              {filas.map((f) => (
                <tr key={f.clave} className="border-t border-linea">
                  <th scope="row" className="py-2 pr-2 text-left font-normal text-tinta-2">
                    {f.etiqueta}
                  </th>
                  <td className="py-2 pr-2 text-right font-mono font-medium tabular-nums">{formatear(f.a, f.unidad)}</td>
                  <td className="py-2 pr-2 text-right font-mono tabular-nums text-tinta-2">{formatear(f.b, f.unidad)}</td>
                  <td className="py-2 text-right font-mono whitespace-nowrap tabular-nums">{diferencia(f)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-tinta-3">
          El cambio es la semana {a.rotulo} menos la {b.rotulo}. Una semana con menos días trabajados suma menos aunque
          rinda más por día: por eso está también el promedio.
        </p>
      </Acordeon>
    </div>
  );
}

function formatear(valor: number, unidad: FilaDeComparacion["unidad"]): string {
  switch (unidad) {
    case "soles":
      return formatearSoles(Math.round(valor));
    case "decimal":
      return valor.toFixed(1);
    case "minutos":
      return formatearDuracion(Math.round(valor));
    default:
      return String(Math.round(valor));
  }
}

/** «+S/ 40.00», «−3»: con signo, y con flecha para que no dependa del color. */
function diferencia(f: FilaDeComparacion): string {
  if (Math.abs(f.diferencia) < 1e-9) return "= igual";
  const signo = f.diferencia > 0 ? "▲ +" : "▼ −";
  return `${signo}${formatear(Math.abs(f.diferencia), f.unidad)}`;
}

/** El pie de una cifra: cuánto cambió respecto de la otra semana. */
function cambio(f: FilaDeComparacion, otra: string): string {
  if (Math.abs(f.diferencia) < 1e-9) return `igual que la sem. ${otra}`;
  return `${f.diferencia > 0 ? "▲ +" : "▼ −"}${formatear(Math.abs(f.diferencia), f.unidad)} vs sem. ${otra}`;
}

function GraficoComparacion({ a, b }: { a: SemanaAComparar; b: SemanaAComparar }) {
  const [metrica, setMetrica] = useState<"pedidos" | "soles">("pedidos");
  const valorDe = (d: DiaGrafico | undefined) => (d ? (metrica === "pedidos" ? d.pedidos : d.centimos / 100) : 0);
  const max = Math.max(1, ...a.dias.map(valorDe), ...b.dias.map(valorDe));
  const mostrar = (v: number) => (metrica === "pedidos" ? String(v) : String(Math.round(v)));

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <span className="rotulo">Día por día</span>
          <p className="text-sm text-tinta-2">Las dos semanas, un día frente al otro</p>
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

      <div className="flex items-end gap-1 pt-4">
        {LETRAS.map((letra, i) => {
          const da = a.dias[i];
          const db = b.dias[i];
          return (
            <div
              key={letra}
              role="img"
              aria-label={`${letra}: ${da?.pedidos ?? 0} pedidos frente a ${db?.pedidos ?? 0}`}
              className="flex min-w-0 flex-1 flex-col items-center gap-1"
            >
              <div className="flex items-end justify-center gap-[3px]" style={{ height: `${ALTO + 18}px` }}>
                <Barra valor={valorDe(db)} max={max} texto={mostrar(valorDe(db))} lleno={false} disponible={Boolean(db?.cargado)} />
                <Barra valor={valorDe(da)} max={max} texto={mostrar(valorDe(da))} lleno disponible={Boolean(da?.cargado)} />
              </div>
              <span className="font-mono text-[10px] font-semibold text-tinta-2">{letra}</span>
            </div>
          );
        })}
      </div>

      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-tinta-2">
        <span className="inline-flex items-center gap-1.5">
          <i className="inline-block size-3 rounded-[3px] bg-barra" />
          Sem. {a.rotulo}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <i className="inline-block size-3 rounded-[3px] border-2 border-barra" />
          Sem. {b.rotulo}
        </span>
      </div>
    </div>
  );
}

function Barra({
  valor,
  max,
  texto,
  lleno,
  disponible,
}: {
  valor: number;
  max: number;
  texto: string;
  lleno: boolean;
  /** Ese día tuvo carga; si no, en vez de una barra en cero se deja un guion. */
  disponible: boolean;
}) {
  const alto = disponible ? Math.max(4, Math.round((valor / max) * ALTO)) : 0;
  return (
    <span className="flex w-[42%] max-w-[16px] flex-col items-center justify-end gap-0.5" style={{ height: "100%" }}>
      <span className="font-mono text-[9px] leading-none text-tinta-2 tabular-nums">{disponible ? texto : "–"}</span>
      {alto > 0 && (
        <span
          className={`w-full rounded-t ${lleno ? "bg-barra" : "border-2 border-b-0 border-barra bg-transparent"}`}
          style={{ height: `${alto}px` }}
        />
      )}
    </span>
  );
}
