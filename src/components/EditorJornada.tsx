"use client";

import { DueloDePago } from "@/components/DueloDePago";
import { FilaPedidoSimple } from "@/components/FilaPedidoSimple";

import { useState, useTransition } from "react";
import { useCapa } from "@/hooks/useCapa";
import { useRouter } from "next/navigation";

import {
  cambiarHorarioDeJornada,
  cambiarTramoDePedido,
  corregirPedido,
  eliminarJornada,
  eliminarPedido,
} from "@/app/(app)/jornada/acciones";
import { Alerta, Check } from "@/components/iconos";
import { Aviso } from "@/components/ui";
import { formatearDuracion } from "@/lib/fechas";
import type { OrdenFila, RutaFila } from "@/lib/db/tipos";
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
  alCambiar,
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
  /**
   * Vuelve a leer el día después de un cambio.
   *
   * Dentro del APK no hay servidor que devuelva la página actualizada: la
   * pantalla lee la base del teléfono una vez y ya. `router.refresh()`, que era
   * lo que se usaba, no vuelve a leerla, así que un tramo cambiado se guardaba
   * pero no se veía hasta salir y volver.
   */
  alCambiar?: () => void;
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
        alCambiar?.();
        router.refresh();
      }
    });
  }

  const totalPedidos = jornada.ordenes.reduce((s, o) => s + (o.montoCentimos ?? 0), 0);
  const horaDeRuta = new Map(jornada.rutas.map((r) => [r.numero, r.horaInicio]));
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

          {/* Pedidos y permanencia como barras que compiten: la más larga es
              lo que se cobra. De la infografía —"compiten, no se suman"—. */}
          {horas > 0 && (
            <DueloDePago
              pedidosCentimos={totalPedidos}
              permanenciaCentimos={montoPermanencia}
              horas={horas}
            />
          )}
        </section>
      )}

      {/* Una lista plana, un pedido por fila, en el orden en que se hicieron.
          Antes eran tarjetas por ruta, y un pedido sin ruta no salía en
          ninguna: existía, se pagaba, y no se veía en ningún sitio. */}
      <div className="overflow-hidden rounded-card border border-linea bg-sup">
        {jornada.ordenes.length === 0 ? (
          <p className="px-4 py-6 text-sm text-tinta-3">Este día no tiene pedidos.</p>
        ) : (
          jornada.ordenes.map((o) => (
            <FilaPedidoSimple
              key={o.id}
              codigo={o.codigo}
              ruta={o.ruta}
              hora={o.ruta !== null ? (horaDeRuta.get(o.ruta) ?? null) : null}
              estado={o.estado}
              tramo={o.tramo}
              monto={formatearSoles(o.montoCentimos ?? 0)}
              manual={o.manual}
              onClick={editable && !pendiente ? () => setEditando(o) : undefined}
            />
          ))
        )}
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
          rutas={jornada.rutas.map((r) => ({ numero: r.numero, inicio: r.horaInicio }))}
          pendiente={pendiente}
          onCorregir={(cambios) =>
            ejecutar(() => corregirPedido(fecha, editando.id, cambios))
          }
          onCerrar={() => setEditando(null)}
          onBorrar={() =>
            ejecutar(
              () => eliminarPedido(fecha, editando.id),
              () => setEditando(null),
            )
          }
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


function HojaTramo({
  orden,
  regla,
  rutas,
  pendiente,
  onCerrar,
  onGuardar,
  onBorrar,
  onCorregir,
}: {
  orden: OrdenFila;
  regla: ReglaPago;
  rutas: Array<{ numero: number; inicio: string | null }>;
  pendiente: boolean;
  onCerrar: () => void;
  onGuardar: (tramo: number, km: number | null, montoManualCentimos: number | null) => void;
  onBorrar: () => void;
  onCorregir: (cambios: { codigo?: string; ruta?: number | null; estado?: string }) => void;
}) {
  const [manual, setManual] = useState("");
  const [confirmandoBorrado, setConfirmandoBorrado] = useState(false);
  const [codigo, setCodigo] = useState(orden.codigo);

  useCapa(onCerrar);

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
        aria-label="Corregir el pedido"
        className="flex max-h-[92dvh] w-full max-w-md flex-col gap-4 overflow-y-auto rounded-t-hoja bg-sup px-4 pt-4 pb-[calc(1.25rem+env(safe-area-inset-bottom,0px))] shadow-alta sm:rounded-hoja sm:pb-5"
      >
        <span className="mx-auto h-1 w-9 rounded-full bg-linea-fuerte sm:hidden" />
        <div>
          <h3 className="text-[22px]">Corregir el pedido</h3>
          <p className="text-sm text-tinta-2">Compara con tu captura y cambia lo que haga falta.</p>
        </div>

        {/* Código, ruta y estado también en un día guardado. Antes solo se
            podía cambiar el tramo, y si el lector le ponía la ruta de al lado
            había que borrar el día entero y volver a cargarlo. */}
        <div className="flex flex-col gap-1.5">
          <label htmlFor="codigo-guardado" className="text-sm font-semibold">
            Código del pedido
          </label>
          <div className="flex gap-2">
            <input
              id="codigo-guardado"
              value={codigo}
              onChange={(e) => setCodigo(e.target.value)}
              autoCapitalize="off"
              autoCorrect="off"
              spellCheck={false}
              className="min-h-11 flex-1 rounded-btn border border-linea-fuerte bg-sup px-3 font-mono text-base"
            />
            <button
              type="button"
              className="boton-sec"
              disabled={pendiente || codigo.trim().toLowerCase() === orden.codigo}
              onClick={() => onCorregir({ codigo })}
            >
              Cambiar
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-semibold">Ruta</span>
            <select
              value={orden.ruta ?? ""}
              disabled={pendiente}
              onChange={(e) =>
                onCorregir({ ruta: e.target.value === "" ? null : Number(e.target.value) })
              }
              className="min-h-11 rounded-btn border border-linea-fuerte bg-sup px-2 text-base"
            >
              <option value="">Sin ruta</option>
              {rutas.map((r) => (
                <option key={r.numero} value={r.numero}>
                  Ruta {r.numero}
                  {r.inicio ? ` · ${r.inicio}` : ""}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-semibold">Estado</span>
            <select
              value={orden.estado}
              disabled={pendiente}
              onChange={(e) => onCorregir({ estado: e.target.value })}
              className="min-h-11 rounded-btn border border-linea-fuerte bg-sup px-2 text-base"
            >
              {["Entregado", "Entrega parcial", "No entregado"].map((e) => (
                <option key={e} value={e}>
                  {e}
                </option>
              ))}
            </select>
          </label>
        </div>

        <h4 className="border-t border-linea pt-4 text-sm font-semibold">Tramo de distancia</h4>

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

        {/* Borrar pide confirmación: no se puede deshacer, y en un día guardado
            el pedido ya cuenta para el pago de la semana. */}
        <div className="border-t border-linea pt-4">
          {confirmandoBorrado ? (
            <div className="flex flex-col gap-3 rounded-btn bg-mal-suave p-3">
              <p className="text-sm text-mal">
                ¿Borrar el pedido <b className="font-mono">{orden.codigo}</b>? Dejará de contar para
                el pago de esta semana.
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={onBorrar}
                  disabled={pendiente}
                  className="min-h-11 flex-1 rounded-btn bg-mal px-4 text-sm font-semibold text-white"
                >
                  Sí, borrarlo
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmandoBorrado(false)}
                  className="boton-sec flex-1"
                >
                  No
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setConfirmandoBorrado(true)}
              className="min-h-11 w-full rounded-btn px-4 text-sm font-semibold text-mal"
            >
              Borrar este pedido
            </button>
          )}
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
