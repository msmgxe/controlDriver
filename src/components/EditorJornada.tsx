"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import {
  cambiarHorarioDeJornada,
  cambiarTramoDePedido,
  eliminarJornada,
} from "@/app/(app)/jornada/[fecha]/acciones";
import { Alerta, Check } from "@/components/iconos";
import { Aviso, ChipTramo, EstadoPedido } from "@/components/ui";
import { formatearDuracion } from "@/lib/fechas";
import type { OrdenFila, RutaFila } from "@/lib/db/jornadas";
import {
  TRAMO_MAS_DE_12_KM,
  formatearSoles,
  horasDePermanencia,
  montoPorPermanencia,
  type ReglaPago,
} from "@/lib/pagos/reglas";

/**
 * Cuerpo editable del detalle de jornada (§9).
 *
 * Mismo lenguaje visual que Revisión para que no haya que aprender dos
 * pantallas: rutas como bloques, pedidos debajo, y el tramo se cambia tocando
 * el pedido.
 */
export function EditorJornada({
  fecha,
  jornada,
  regla,
  editable,
  esHoy,
}: {
  fecha: string;
  jornada: {
    rutas: RutaFila[];
    ordenes: OrdenFila[];
    horaEntrada: string | null;
    horaSalida: string | null;
  };
  regla: ReglaPago;
  editable: boolean;
  esHoy: boolean;
}) {
  const router = useRouter();
  const [pendiente, iniciar] = useTransition();
  const [aviso, setAviso] = useState<{ tono: "bien" | "mal"; texto: string } | null>(null);
  const [editando, setEditando] = useState<OrdenFila | null>(null);
  const [entrada, setEntrada] = useState(jornada.horaEntrada ?? "");
  const [salida, setSalida] = useState(jornada.horaSalida ?? "");
  const [confirmandoBorrado, setConfirmandoBorrado] = useState(false);

  function ejecutar(
    accion: () => Promise<{ ok: true; mensaje: string } | { ok: false; error: string }>,
    alTerminar?: () => void,
  ) {
    setAviso(null);
    iniciar(async () => {
      const r = await accion();
      setAviso(r.ok ? { tono: "bien", texto: r.mensaje } : { tono: "mal", texto: r.error });
      if (r.ok) {
        alTerminar?.();
        router.refresh();
      }
    });
  }

  const totalPedidos = jornada.ordenes.reduce((s, o) => s + (o.montoCentimos ?? 0), 0);
  const minutos = jornada.rutas.reduce((s, r) => s + (r.duracionMin ?? 0), 0);
  const pagaPermanencia = Boolean(regla.garantiaPermanencia?.activa);
  const horas = horasDePermanencia(entrada || null, salida || null);
  const montoPermanencia = montoPorPermanencia(regla, entrada || null, salida || null) ?? 0;
  const ganaPermanencia = montoPermanencia > totalPedidos;
  const total = Math.max(totalPedidos, montoPermanencia);

  const pedidosPorRuta = new Map<number | null, OrdenFila[]>();
  for (const o of jornada.ordenes) {
    const lista = pedidosPorRuta.get(o.ruta) ?? [];
    lista.push(o);
    pedidosPorRuta.set(o.ruta, lista);
  }

  return (
    <div className="flex flex-col gap-4">
      {aviso && (
        <Aviso tono={aviso.tono === "bien" ? "bien" : "mal"} titulo={aviso.texto} />
      )}

      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-col gap-0.5">
          <span className="font-display text-[44px] leading-none font-bold tracking-tight text-acento tabular-nums">
            {formatearSoles(total)}
          </span>
          <span className="text-sm text-tinta-2">
            {jornada.ordenes.length} pedidos · {jornada.rutas.length} rutas ·{" "}
            {formatearDuracion(minutos)} en ruta
          </span>
        </div>
        {ganaPermanencia && (
          <span className="inline-flex items-center rounded-chip bg-bien-suave px-2 py-0.5 text-[10px] font-bold tracking-wide text-bien uppercase">
            cubierto por permanencia
          </span>
        )}
      </div>

      {pagaPermanencia && (
        <section className="flex flex-col gap-3 rounded-card bg-sup-2 p-4">
          <span className="rotulo">Permanencia en tienda</span>
          <div className="flex flex-wrap items-end gap-3">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="det-entrada" className="text-sm font-semibold">
                Entrada
              </label>
              <input
                id="det-entrada"
                type="time"
                value={entrada}
                disabled={!editable || pendiente}
                onChange={(e) => setEntrada(e.target.value)}
                className="min-h-11 rounded-btn border border-linea-fuerte bg-sup px-3 font-mono text-base disabled:opacity-60"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="det-salida" className="text-sm font-semibold">
                Salida
              </label>
              <input
                id="det-salida"
                type="time"
                value={salida}
                disabled={!editable || pendiente}
                onChange={(e) => setSalida(e.target.value)}
                className="min-h-11 rounded-btn border border-linea-fuerte bg-sup px-3 font-mono text-base disabled:opacity-60"
              />
            </div>
            {editable && (
              <button
                type="button"
                className="boton-sec"
                disabled={pendiente}
                onClick={() =>
                  ejecutar(() =>
                    cambiarHorarioDeJornada({
                      fecha,
                      horaEntrada: entrada || null,
                      horaSalida: salida || null,
                    }),
                  )
                }
              >
                Guardar horario
              </button>
            )}
          </div>

          <dl className="flex flex-col border-t border-linea pt-3">
            <Fila
              etiqueta="Por pedidos"
              valor={formatearSoles(totalPedidos)}
              tachado={ganaPermanencia}
            />
            <Fila
              etiqueta={`Por permanencia${horas > 0 ? ` (${horas} h)` : ""}`}
              valor={horas > 0 ? formatearSoles(montoPermanencia) : "—"}
              tachado={!ganaPermanencia && horas > 0}
            />
          </dl>
        </section>
      )}

      <div className="flex flex-col gap-3">
        {jornada.rutas.map((r) => {
          const suyos = pedidosPorRuta.get(r.numero) ?? [];
          return (
            <div key={r.id} className="overflow-hidden rounded-card bg-sup">
              <div className="flex items-center gap-3 border-b border-linea bg-sup-2 px-4 py-3">
                <span className="grid size-8 shrink-0 place-items-center rounded-full bg-acento font-display text-lg font-bold text-acento-texto">
                  {r.numero}
                </span>
                <span className="flex min-w-0 flex-col">
                  <b className="font-mono text-sm font-medium">
                    {r.horaInicio ?? "--:--"} → {r.horaFin ?? "--:--"}
                  </b>
                  <span className="text-xs text-tinta-3">{suyos.length} pedidos</span>
                </span>
                {r.duracionMin !== null && (
                  <span className="ml-auto font-mono text-sm whitespace-nowrap text-tinta-2">
                    {r.duracionMin} min
                  </span>
                )}
              </div>

              {suyos.map((o) => (
                <button
                  key={o.id}
                  type="button"
                  disabled={!editable || pendiente}
                  onClick={() => setEditando(o)}
                  className="flex w-full items-center gap-3 border-b border-linea px-4 py-3 text-left last:border-b-0 enabled:hover:bg-sup-2 disabled:cursor-default"
                >
                  <span className="flex min-w-0 flex-1 flex-col gap-1">
                    <span className={`codigo ${o.tramo > 1 ? "text-acento-tinta" : ""}`}>
                      {o.codigo}
                    </span>
                    <span className="flex flex-wrap items-center gap-2">
                      <EstadoPedido estado={o.estado} />
                      <ChipTramo tramo={o.tramo} />
                      {o.km !== null && (
                        <span className="font-mono text-xs text-tinta-3">{o.km} km</span>
                      )}
                    </span>
                  </span>
                  <span className="monto text-sm whitespace-nowrap">
                    {formatearSoles(o.montoCentimos ?? 0)}
                  </span>
                </button>
              ))}
            </div>
          );
        })}
      </div>

      {editable && (
        <section className="flex flex-col gap-3 rounded-card border border-mal/30 p-4">
          <span className="rotulo">Borrar esta jornada</span>
          <p className="text-sm text-tinta-2">
            Se van el día entero con sus {jornada.rutas.length} rutas y {jornada.ordenes.length}{" "}
            pedidos. No se puede deshacer{esHoy ? "" : ", y este día ya cuenta para tu semana"}.
          </p>
          {confirmandoBorrado ? (
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className="boton-sec border-mal/40 text-mal"
                disabled={pendiente}
                onClick={() =>
                  ejecutar(
                    () => eliminarJornada(fecha, jornada.ordenes.length),
                    () => router.push("/historial"),
                  )
                }
              >
                <Alerta className="size-4" />
                {pendiente ? "Borrando…" : "Sí, borrar el día completo"}
              </button>
              <button
                type="button"
                className="boton-sec"
                disabled={pendiente}
                onClick={() => setConfirmandoBorrado(false)}
              >
                Cancelar
              </button>
            </div>
          ) : (
            <button
              type="button"
              className="boton-sec self-start border-mal/40 text-mal"
              onClick={() => setConfirmandoBorrado(true)}
            >
              Borrar jornada
            </button>
          )}
        </section>
      )}

      {editando && (
        <HojaTramo
          orden={editando}
          regla={regla}
          pendiente={pendiente}
          onCerrar={() => setEditando(null)}
          onGuardar={(tramo, km, montoManualCentimos) =>
            ejecutar(
              () =>
                cambiarTramoDePedido({
                  fecha,
                  ordenId: editando.id,
                  tramo,
                  km,
                  montoManualCentimos,
                }),
              () => setEditando(null),
            )
          }
        />
      )}
    </div>
  );
}

function Fila({
  etiqueta,
  valor,
  tachado,
}: {
  etiqueta: string;
  valor: string;
  tachado: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-1 text-sm">
      <dt className={tachado ? "text-tinta-3" : "font-semibold"}>{etiqueta}</dt>
      <dd
        className={`font-mono tabular-nums ${tachado ? "text-tinta-3 line-through" : "font-semibold"}`}
      >
        {valor}
      </dd>
    </div>
  );
}

function HojaTramo({
  orden,
  regla,
  pendiente,
  onCerrar,
  onGuardar,
}: {
  orden: OrdenFila;
  regla: ReglaPago;
  pendiente: boolean;
  onCerrar: () => void;
  onGuardar: (tramo: number, km: number | null, montoManualCentimos: number | null) => void;
}) {
  const [manual, setManual] = useState("");

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center sm:p-5"
      onClick={(e) => {
        if (e.target === e.currentTarget) onCerrar();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Tramo del pedido"
        className="flex w-full max-w-md flex-col gap-4 rounded-t-hoja bg-sup px-4 pt-4 pb-[calc(1.25rem+env(safe-area-inset-bottom,0px))] shadow-alta sm:rounded-hoja sm:pb-5"
      >
        <span className="mx-auto h-1 w-9 rounded-full bg-linea-fuerte sm:hidden" />
        <div>
          <h3 className="text-[22px]">Tramo del pedido</h3>
          <p className="text-sm text-tinta-2">
            <span className="codigo">{orden.codigo}</span>
            {orden.ruta !== null && ` · ruta ${orden.ruta}`}
          </p>
        </div>

        <div role="radiogroup" aria-label="Tramo de distancia" className="flex flex-col gap-2">
          {regla.tramos.map((t) => (
            <button
              key={t.id}
              type="button"
              role="radio"
              aria-checked={orden.tramo === t.id}
              disabled={pendiente}
              onClick={() => onGuardar(t.id, null, null)}
              className={`flex min-h-[54px] items-center gap-3 rounded-btn border px-3 py-2 text-left ${
                orden.tramo === t.id
                  ? "border-acento bg-acento-suave"
                  : "border-linea-fuerte hover:bg-sup-2"
              }`}
            >
              <span
                className={`grid size-7 shrink-0 place-items-center rounded-chip font-mono text-xs font-medium ${
                  orden.tramo === t.id ? "bg-acento text-acento-texto" : "bg-sup-2"
                }`}
              >
                {t.id}
              </span>
              <span className="flex flex-1 flex-col">
                <b className="text-sm font-bold">
                  {t.desde} a {t.hasta} km
                </b>
              </span>
              <span className="monto">{formatearSoles(Math.round(t.monto * 100))}</span>
            </button>
          ))}
        </div>

        <div className="flex flex-col gap-2 border-t border-linea pt-4">
          <label htmlFor="det-manual" className="text-sm font-semibold">
            Más de 12 km
          </label>
          <div className="flex gap-2">
            <input
              id="det-manual"
              type="number"
              inputMode="decimal"
              step="0.5"
              min="0"
              placeholder="18.00"
              value={manual}
              onChange={(e) => setManual(e.target.value)}
              className="min-h-11 flex-1 rounded-btn border border-linea-fuerte bg-sup px-4 text-base"
            />
            <button
              type="button"
              className="boton-sec"
              disabled={pendiente || manual === ""}
              onClick={() => {
                const valor = Number(manual);
                if (Number.isNaN(valor)) return;
                onGuardar(TRAMO_MAS_DE_12_KM, null, Math.round(valor * 100));
              }}
            >
              Aplicar
            </button>
          </div>
        </div>

        <button type="button" className="boton-sec" onClick={onCerrar} disabled={pendiente}>
          {pendiente ? (
            "Guardando…"
          ) : (
            <>
              <Check className="size-4" />
              Cerrar
            </>
          )}
        </button>
      </div>
    </div>
  );
}
