"use client";

import { useState } from "react";

import { FilaPedidoSimple } from "@/components/FilaPedidoSimple";
import { HojaDePedido } from "@/components/HojaDePedido";
import { Flecha } from "@/components/iconos";
import { TarjetaBloqueExtra } from "@/components/TarjetaBloqueExtra";
import type { AjustesDeComandas } from "@/lib/db/sqlite/ajustes";
import { esCodigoPendiente } from "@/lib/db/sqlite/jornadas";
import type { BloqueExtraFila, JornadaCompleta, Tienda } from "@/lib/db/tipos";
import { nombreDelDia, type FechaISO } from "@/lib/fechas";
import type { DetalleDia } from "@/lib/pagos/calcular-liquidacion";
import type { FilaDeDesglose } from "@/lib/pagos/desglose";
import { formatearSoles, type ReglaPago } from "@/lib/pagos/reglas";

const COLOR = {
  tienda: "bg-acento",
  apoyo: "bg-[var(--f-apoyo)]",
  taxi: "bg-[var(--f-taxi)]",
} as const;

interface DiaDeFuente {
  fecha: FechaISO;
  detalle: string;
  centimos: number;
}

const etiquetaDelDia = (f: FechaISO) => `${nombreDelDia(f).slice(0, 3)} ${Number(f.slice(8))}`;

/**
 * «De dónde viene», con cada fuente **desplegable**: tocas el monto de tu tienda,
 * de un apoyo o del taxi y ves en qué días se produjo; tocas un día y ves sus
 * pedidos (o sus carreras, o su apoyo) y de ahí abres cada uno —con su foto de
 * evidencia, para corregirlo o quitarlo— sin salir de Pagos.
 */
export function DesgloseDeFuentes({
  titulo,
  filas,
  jornadas,
  porDia,
  bloques,
  regla,
  tienda,
  ajustes,
  editable,
  alCambiar,
}: {
  titulo?: string;
  filas: readonly FilaDeDesglose[];
  jornadas: readonly JornadaCompleta[];
  porDia: readonly DetalleDia[];
  bloques: ReadonlyMap<FechaISO, BloqueExtraFila[]>;
  regla: ReglaPago;
  tienda: Tienda | null;
  ajustes: AjustesDeComandas;
  editable: boolean;
  alCambiar: () => void;
}) {
  const [fuenteAbierta, setFuenteAbierta] = useState<string | null>(null);
  const [diaAbierto, setDiaAbierto] = useState<string | null>(null);
  const [editandoId, setEditandoId] = useState<string | null>(null);

  const total = filas.reduce((s, f) => s + f.centimos, 0);
  const todas = jornadas.flatMap((j) => j.ordenes.map((orden) => ({ orden, jornada: j })));
  const editando = todas.find((x) => x.orden.id === editandoId) ?? null;

  /** Los bloques de una fuente, por día. */
  function bloquesDe(fila: FilaDeDesglose): Array<{ fecha: FechaISO; lista: BloqueExtraFila[] }> {
    const salida: Array<{ fecha: FechaISO; lista: BloqueExtraFila[] }> = [];
    for (const [fecha, lista] of [...bloques].sort(([a], [b]) => (a < b ? -1 : 1))) {
      const propios = lista.filter((b) =>
        fila.categoria === "taxi"
          ? b.tipo === "taxi"
          : b.tipo !== "taxi" && `apoyo:${(b.tiendaNombre || "otra tienda").trim()}` === fila.clave,
      );
      if (propios.length > 0) salida.push({ fecha, lista: propios });
    }
    return salida;
  }

  function diasDe(fila: FilaDeDesglose): DiaDeFuente[] {
    if (fila.categoria === "tienda") {
      return porDia
        .filter((d) => d.pedidos > 0)
        .map((d) => ({
          fecha: d.fecha,
          detalle: `${d.pedidos} pedido${d.pedidos === 1 ? "" : "s"}${d.pagaPor === "permanencia" ? " · cubre la permanencia" : ""}`,
          centimos: d.montoCentimos,
        }));
    }
    return bloquesDe(fila).map(({ fecha, lista }) => {
      const horas = lista.reduce((s, b) => s + (b.tipo === "apoyo_hora" ? b.horas : 0), 0);
      const km = lista.reduce((s, b) => s + (b.tipo === "taxi" ? (b.km ?? 0) : 0), 0);
      const detalle =
        fila.categoria === "taxi"
          ? `${lista.length} carrera${lista.length === 1 ? "" : "s"}${km > 0 ? ` · ${Math.round(km * 10) / 10} km` : ""}`
          : horas > 0
            ? `${Math.round(horas * 100) / 100} h`
            : `${lista.length} apoyo${lista.length === 1 ? "" : "s"}`;
      return { fecha, detalle, centimos: lista.reduce((s, b) => s + b.montoCentimos, 0) };
    });
  }

  if (filas.length === 0) return null;

  return (
    <div className="entra flex flex-col gap-1 rounded-card bg-sup-2 p-3" aria-label={titulo ?? "De dónde viene"}>
      {titulo && <span className="rotulo px-1 pb-1">{titulo}</span>}

      {filas.map((f) => {
        const abierta = fuenteAbierta === f.clave;
        const parte = total > 0 ? f.centimos / total : 0;
        const dias = abierta ? diasDe(f) : [];
        return (
          <div key={f.clave} className="rounded-btn bg-sup/60">
            <button
              type="button"
              aria-expanded={abierta}
              onClick={() => {
                setFuenteAbierta(abierta ? null : f.clave);
                setDiaAbierto(null);
              }}
              className="flex w-full flex-col gap-1 px-3 py-2.5 text-left"
            >
              <span className="flex items-baseline justify-between gap-3">
                <span className="min-w-0 truncate text-[13px] font-semibold">{f.etiqueta}</span>
                <span className="flex shrink-0 items-center gap-1.5">
                  <b className="font-mono text-[13px] tabular-nums">{formatearSoles(f.centimos)}</b>
                  <Flecha className={`size-3.5 text-tinta-3 transition-transform duration-300 ${abierta ? "-rotate-90" : "rotate-90"}`} />
                </span>
              </span>
              <span className="h-2 overflow-hidden rounded-chip bg-papel">
                <span
                  className={`barra-crece block h-full rounded-chip ${COLOR[f.categoria]}`}
                  style={{ width: `${Math.max(parte * 100, f.centimos > 0 ? 3 : 0)}%` }}
                />
              </span>
              <span className="text-[11.5px] text-tinta-2">
                {f.detalle}
                {total > 0 && ` · ${Math.round(parte * 100)} %`}
                {!abierta && " · toca para ver los días"}
              </span>
            </button>

            <div
              className="grid transition-[grid-template-rows] duration-300 ease-in-out"
              style={{ gridTemplateRows: abierta ? "1fr" : "0fr" }}
            >
              <div className="overflow-hidden" inert={!abierta}>
                <div className="flex flex-col gap-1 border-t border-linea px-2 py-2">
                  {dias.length === 0 && <p className="px-2 py-1 text-xs text-tinta-3">Sin días en esta semana.</p>}
                  {dias.map((d) => {
                    const clave = `${f.clave}|${d.fecha}`;
                    const diaOn = diaAbierto === clave;
                    return (
                      <div key={clave} className="overflow-hidden rounded-btn border border-linea bg-sup">
                        <button
                          type="button"
                          aria-expanded={diaOn}
                          onClick={() => setDiaAbierto(diaOn ? null : clave)}
                          className="grid min-h-12 w-full grid-cols-[52px_1fr_auto] items-center gap-2 px-3 py-2 text-left"
                        >
                          <b className="text-sm capitalize">{etiquetaDelDia(d.fecha)}</b>
                          <span className="text-xs text-tinta-2">{d.detalle}</span>
                          <span className="flex items-center gap-1.5 font-mono text-[13px] font-bold tabular-nums">
                            {formatearSoles(d.centimos)}
                            <Flecha className={`size-3.5 text-tinta-3 transition-transform duration-300 ${diaOn ? "-rotate-90" : "rotate-90"}`} />
                          </span>
                        </button>
                        <div
                          className="grid transition-[grid-template-rows] duration-300 ease-in-out"
                          style={{ gridTemplateRows: diaOn ? "1fr" : "0fr" }}
                        >
                          <div className="overflow-hidden" inert={!diaOn}>
                            <div className="flex flex-col gap-2 border-t border-linea bg-papel p-2">
                              {f.categoria === "tienda" ? (
                                <PedidosDelDia
                                  jornada={jornadas.find((j) => j.fecha === d.fecha)}
                                  alAbrir={setEditandoId}
                                />
                              ) : (
                                bloquesDe(f)
                                  .find((x) => x.fecha === d.fecha)
                                  ?.lista.map((b) => (
                                    <TarjetaBloqueExtra
                                      key={b.id}
                                      bloque={b}
                                      fecha={d.fecha}
                                      editable={editable}
                                      alCambiar={alCambiar}
                                    />
                                  ))
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        );
      })}

      <div className="mt-1 flex items-baseline justify-between gap-3 border-t border-linea px-3 pt-2.5">
        <span className="text-[13px] font-bold">Total</span>
        <b className="font-mono text-[15px] tabular-nums">{formatearSoles(total)}</b>
      </div>

      {editando && (
        <HojaDePedido
          key={editando.orden.id}
          fecha={editando.jornada.fecha}
          orden={editando.orden}
          regla={regla}
          rutas={editando.jornada.rutas.map((r) => ({ numero: r.numero, inicio: r.horaInicio }))}
          tienda={tienda}
          ajustes={ajustes}
          editable={editable}
          alCerrar={() => setEditandoId(null)}
          alCambiar={alCambiar}
        />
      )}
    </div>
  );
}

function PedidosDelDia({ jornada, alAbrir }: { jornada: JornadaCompleta | undefined; alAbrir: (id: string) => void }) {
  if (!jornada || jornada.ordenes.length === 0) return <p className="px-1 text-xs text-tinta-3">Sin pedidos ese día.</p>;
  return (
    <div className="overflow-hidden rounded-card border border-linea bg-sup">
      {jornada.ordenes.map((o) => (
        <FilaPedidoSimple
          key={o.id}
          codigo={o.codigo}
          ruta={o.ruta}
          hora={jornada.rutas.find((r) => r.numero === o.ruta)?.horaInicio ?? null}
          estado={o.estado}
          tramo={o.tramo}
          monto={formatearSoles(o.montoCentimos ?? 0)}
          manual={o.manual}
          porCompletar={esCodigoPendiente(o.codigo)}
          km={o.km}
          cliente={o.cliente?.nombre ?? null}
          conFoto={o.fotos > 0}
          onClick={() => alAbrir(o.id)}
        />
      ))}
    </div>
  );
}
