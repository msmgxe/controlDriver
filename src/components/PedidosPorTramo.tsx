"use client";

import { useState } from "react";

import { FilaPedidoSimple } from "@/components/FilaPedidoSimple";
import { Flecha } from "@/components/iconos";
import { HojaDePedido } from "@/components/HojaDePedido";
import type { AjustesDeComandas } from "@/lib/db/sqlite/ajustes";
import { esCodigoPendiente } from "@/lib/db/sqlite/jornadas";
import type { JornadaCompleta, Tienda } from "@/lib/db/tipos";
import { nombreDelDia } from "@/lib/fechas";
import { TRAMO_MAS_DE_12_KM, formatearSoles, type ReglaPago } from "@/lib/pagos/reglas";

/**
 * Los pedidos agrupados por **tramo de distancia**, para corroborar de dónde
 * sale el pago: cuántos cayeron en cada tramo, cuánto sumó cada uno y, al
 * tocarlo, cuáles son.
 *
 * Tocar un pedido abre su hoja (la misma de Inicio): ahí se cambia el tramo,
 * se ve el cliente, la distancia y su **evidencia** —la captura o la foto de
 * la comanda—. Con una semana entera hay varios días; con un día, uno solo.
 */
export function PedidosPorTramo({
  jornadas,
  regla,
  tienda,
  ajustes,
  editable,
  alCambiar,
}: {
  jornadas: readonly JornadaCompleta[];
  regla: ReglaPago;
  tienda: Tienda | null;
  ajustes: AjustesDeComandas;
  /** Falso en una semana ya pagada. */
  editable: boolean;
  alCambiar: () => void;
}) {
  const [abierto, setAbierto] = useState<number | null>(null);
  const [editandoId, setEditandoId] = useState<string | null>(null);

  const variosDias = jornadas.length > 1;
  const todas = jornadas.flatMap((j) => j.ordenes.map((orden) => ({ orden, jornada: j })));
  // Se guarda el id y no el pedido: tras corregirlo la lista se vuelve a leer, y la hoja debe ver lo nuevo.
  const editando = todas.find((x) => x.orden.id === editandoId) ?? null;
  const ids = [...regla.tramos.map((t) => t.id), TRAMO_MAS_DE_12_KM];
  const grupos = ids
    .map((id) => {
      const tr = regla.tramos.find((t) => t.id === id);
      const items = todas.filter((x) => x.orden.tramo === id);
      return {
        id,
        rotulo: id === TRAMO_MAS_DE_12_KM ? "Más de 12 km" : `Tramo ${id}`,
        distancia: tr ? `${tr.desde} a ${tr.hasta} km` : "sin tarifa fija",
        items,
        centimos: items.reduce((s, x) => s + (x.orden.montoCentimos ?? 0), 0),
      };
    })
    .filter((g) => g.id !== TRAMO_MAS_DE_12_KM || g.items.length > 0);

  if (todas.length === 0) return <p className="text-sm text-tinta-3">Sin pedidos en este periodo.</p>;

  const mayor = Math.max(1, ...grupos.map((g) => g.items.length));

  return (
    <>
      <div className="overflow-hidden rounded-card border border-linea bg-sup">
        {grupos.map((g) => {
          const abiertoAhora = abierto === g.id;
          return (
            <div key={g.id} className="border-b border-linea last:border-b-0">
              <button
                type="button"
                aria-expanded={abiertoAhora}
                disabled={g.items.length === 0}
                onClick={() => setAbierto(abiertoAhora ? null : g.id)}
                className="grid min-h-14 w-full grid-cols-[1fr_auto] items-center gap-x-3 gap-y-1 px-3 py-2.5 text-left disabled:opacity-50"
              >
                <span className="flex items-baseline gap-2">
                  <b className="text-sm">{g.rotulo}</b>
                  <span className="text-xs text-tinta-3">{g.distancia}</span>
                </span>
                <span className="flex items-center gap-1.5 font-mono text-[13px] font-bold tabular-nums">
                  {formatearSoles(g.centimos)}
                  {g.items.length > 0 && (
                    <Flecha className={`size-4 text-tinta-3 transition-transform ${abiertoAhora ? "-rotate-90" : "rotate-90"}`} />
                  )}
                </span>
                <span className="col-span-2 flex items-center gap-2">
                  <span className="h-2 flex-1 overflow-hidden rounded-full bg-linea">
                    <span
                      className="block h-full rounded-full bg-acento"
                      style={{ width: `${(g.items.length / mayor) * 100}%` }}
                    />
                  </span>
                  <span className="w-20 text-right text-xs text-tinta-2">
                    {g.items.length} pedido{g.items.length === 1 ? "" : "s"}
                  </span>
                </span>
              </button>

              {abiertoAhora && (
                <div className="border-t border-linea bg-papel">
                  {g.items.map(({ orden: o, jornada }) => (
                    <div key={o.id}>
                      {variosDias && (
                        <p className="px-3 pt-2 text-[11px] font-bold tracking-wide text-tinta-3 uppercase">
                          {nombreDelDia(jornada.fecha).slice(0, 3)} {Number(jornada.fecha.slice(8))}
                        </p>
                      )}
                      <FilaPedidoSimple
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
                        onClick={() => setEditandoId(o.id)}
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
      <p className="text-xs text-tinta-3">
        Toca un tramo para ver sus pedidos, y un pedido para ver su captura o su comanda, o cambiarle el tramo.
      </p>

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
    </>
  );
}
