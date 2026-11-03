"use client";

import { useState, useTransition } from "react";

import { aplicarBonoAPedidos } from "@/app/(app)/jornada/acciones";
import { BotonDeAccion } from "@/components/Acciones";
import { DialogoConfirmar } from "@/components/DialogoConfirmar";
import { Check, Equis, Estrella } from "@/components/iconos";
import { Aviso } from "@/components/ui";
import { useCapa } from "@/hooks/useCapa";
import { esCodigoPendiente } from "@/lib/db/sqlite/jornadas";
import type { OrdenFila } from "@/lib/db/tipos";
import { nombreDelDia, type FechaISO } from "@/lib/fechas";
import { formatearSoles } from "@/lib/pagos/reglas";

/**
 * Bono de campaña: a veces la tienda sube la tarifa una semana (CyberNow, +S/ 2
 * por pedido). Aquí se eligen uno o varios pedidos del día y se les suma ese
 * bono; se puede cambiar o quitar después.
 *
 * El bono queda **dentro del monto del pedido** (la tarifa más el bono), así que
 * Inicio, Pagos, el detalle y las exportaciones lo cuentan sin más. Pide
 * confirmación porque es dinero y toca varios pedidos a la vez.
 */

const CAMPANAS = ["CyberNow", "Campaña", "Bono"] as const;
const MONTOS = [100, 200, 300, 500] as const;

export function BonoDePedidos({
  fecha,
  ordenes,
  alCerrar,
  alCambiar,
}: {
  fecha: FechaISO;
  ordenes: OrdenFila[];
  alCerrar: () => void;
  alCambiar: () => void;
}) {
  useCapa(alCerrar);
  const [elegidos, setElegidos] = useState<Set<string>>(new Set());
  const [campana, setCampana] = useState<string>("CyberNow");
  const [centimos, setCentimos] = useState(200);
  const [otro, setOtro] = useState("");
  const [preguntando, setPreguntando] = useState<"aplicar" | "quitar" | null>(null);
  const [pendiente, iniciar] = useTransition();
  const [aviso, setAviso] = useState<{ tono: "bien" | "mal"; texto: string } | null>(null);

  const aplicables = ordenes;
  const marcados = aplicables.filter((o) => elegidos.has(o.id));
  const conBono = marcados.filter((o) => o.bonoCentimos > 0);
  const total = marcados.length * centimos;

  const alternar = (id: string) =>
    setElegidos((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  function ejecutar(bonoCentimos: number) {
    setAviso(null);
    iniciar(async () => {
      const r = await aplicarBonoAPedidos({ fecha, ordenIds: marcados.map((o) => o.id), bonoCentimos, nombre: campana });
      setAviso(r.ok ? { tono: "bien", texto: r.mensaje } : { tono: "mal", texto: r.error });
      if (r.ok) {
        setElegidos(new Set());
        alCambiar();
      }
    });
  }

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end justify-center bg-black/50 sm:items-center sm:p-5"
      onClick={(e) => {
        if (e.target === e.currentTarget) alCerrar();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Bono de campaña"
        className="flex max-h-[92dvh] w-full max-w-md flex-col overflow-hidden rounded-t-hoja bg-sup shadow-alta sm:rounded-hoja"
      >
        <div className="flex items-center gap-3 px-4 py-3 text-white" style={{ background: "var(--c-adic)" }}>
          <span className="grid size-11 place-items-center rounded-[14px] bg-white/25">
            <Estrella className="size-6" />
          </span>
          <div className="min-w-0">
            <h3 className="text-[20px] leading-tight">Bono de campaña</h3>
            <small className="block opacity-90">
              <span className="capitalize">{nombreDelDia(fecha)}</span> {Number(fecha.slice(8))} · elige los pedidos
            </small>
          </div>
          <button type="button" onClick={alCerrar} aria-label="Cerrar" className="ml-auto grid size-11 place-items-center rounded-full bg-white/25">
            <Equis className="size-5" />
          </button>
        </div>

        <div className="flex flex-1 flex-col gap-4 overflow-y-auto px-4 pt-4 pb-4">
          {aviso && <Aviso tono={aviso.tono} titulo={aviso.texto} />}

          <div className="flex flex-col gap-2">
            <span className="text-sm font-semibold">¿Qué campaña es?</span>
            <div className="flex flex-wrap gap-2">
              {CAMPANAS.map((c) => (
                <button
                  key={c}
                  type="button"
                  aria-pressed={campana === c}
                  onClick={() => setCampana(c)}
                  className={`min-h-11 rounded-chip border-2 px-4 text-sm font-bold ${campana === c ? "border-tinta bg-sup-2" : "border-linea-fuerte"}`}
                >
                  {c}
                </button>
              ))}
            </div>
            <input
              value={CAMPANAS.includes(campana as (typeof CAMPANAS)[number]) ? "" : campana}
              onChange={(e) => setCampana(e.target.value.slice(0, 40) || "CyberNow")}
              placeholder="Otro nombre…"
              maxLength={40}
              aria-label="Nombre de la campaña"
              className="min-h-11 rounded-btn border border-linea-fuerte bg-sup px-3 text-base"
            />
          </div>

          <div className="flex flex-col gap-2">
            <span className="text-sm font-semibold">¿Cuánto suma por pedido?</span>
            <div className="flex flex-wrap gap-2">
              {MONTOS.map((m) => (
                <button
                  key={m}
                  type="button"
                  aria-pressed={centimos === m && otro === ""}
                  onClick={() => {
                    setCentimos(m);
                    setOtro("");
                  }}
                  className={`min-h-11 rounded-chip border-2 px-4 text-sm font-bold ${centimos === m && otro === "" ? "border-tinta bg-sup-2" : "border-linea-fuerte"}`}
                >
                  + {formatearSoles(m)}
                </button>
              ))}
              <div className="flex min-h-11 items-center gap-1 rounded-chip border-2 border-linea-fuerte px-3">
                <span className="text-sm text-tinta-3">S/</span>
                <input
                  value={otro}
                  inputMode="decimal"
                  placeholder="otro"
                  aria-label="Otro monto de bono"
                  onChange={(e) => {
                    setOtro(e.target.value);
                    const n = Number(e.target.value.replace(",", "."));
                    if (Number.isFinite(n) && n > 0 && n <= 1000) setCentimos(Math.round(n * 100));
                  }}
                  className="w-16 bg-transparent text-right font-mono text-sm outline-none"
                />
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-semibold">Pedidos</span>
              <span className="flex gap-2">
                <button type="button" className="boton-sec !min-h-9 !px-3" onClick={() => setElegidos(new Set(aplicables.map((o) => o.id)))}>
                  Todos
                </button>
                <button
                  type="button"
                  className="boton-sec !min-h-9 !px-3"
                  onClick={() => setElegidos(new Set(aplicables.filter((o) => o.bonoCentimos === 0).map((o) => o.id)))}
                >
                  Sin bono
                </button>
                <button type="button" className="boton-sec !min-h-9 !px-3" onClick={() => setElegidos(new Set())}>
                  Ninguno
                </button>
              </span>
            </div>
            <ul className="overflow-hidden rounded-card border border-linea">
              {aplicables.map((o) => {
                const on = elegidos.has(o.id);
                return (
                  <li key={o.id} className="border-b border-linea last:border-b-0">
                    <button
                      type="button"
                      role="checkbox"
                      aria-checked={on}
                      onClick={() => alternar(o.id)}
                      className={`flex min-h-14 w-full items-center gap-3 px-3 text-left ${on ? "bg-bien-suave" : ""}`}
                    >
                      <span
                        className={`grid size-7 shrink-0 place-items-center rounded-[8px] border-2 ${on ? "border-bien bg-bien text-white" : "border-linea-fuerte"}`}
                        aria-hidden
                      >
                        {on && <Check className="size-4" />}
                      </span>
                      <span className="min-w-0 flex-1">
                        <b className="block truncate font-mono text-[14px]">{esCodigoPendiente(o.codigo) ? "Pedido sin código" : o.codigo}</b>
                        <small className="text-tinta-3">
                          {o.ruta !== null ? `Ruta ${o.ruta}` : "Sin ruta"}
                          {o.bonoCentimos > 0 && ` · ya tiene +${formatearSoles(o.bonoCentimos)} ${o.bonoNombre ?? ""}`}
                        </small>
                      </span>
                      <span className="font-mono text-xs text-tinta-2 tabular-nums">{formatearSoles(o.montoCentimos ?? 0)}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>

        <div className="flex flex-col gap-2 border-t border-linea px-4 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom,0px))]">
          <p className="text-center text-sm font-semibold text-tinta-2">
            {marcados.length === 0
              ? "Toca los pedidos que entran en la campaña"
              : `${marcados.length} pedido${marcados.length === 1 ? "" : "s"} × ${formatearSoles(centimos)} = ${formatearSoles(total)}`}
          </p>
          <BotonDeAccion k="adicional" disabled={marcados.length === 0 || pendiente} onClick={() => setPreguntando("aplicar")}>
            {pendiente ? "Guardando…" : "Aplicar el bono"}
          </BotonDeAccion>
          {conBono.length > 0 && (
            <button type="button" className="min-h-11 rounded-btn text-sm font-bold text-mal disabled:opacity-50" disabled={pendiente} onClick={() => setPreguntando("quitar")}>
              Quitar el bono de {conBono.length} pedido{conBono.length === 1 ? "" : "s"}
            </button>
          )}
        </div>
      </div>

      {preguntando === "aplicar" && (
        <DialogoConfirmar
          titulo={`¿Sumar ${formatearSoles(centimos)} a ${marcados.length} pedido${marcados.length === 1 ? "" : "s"}?`}
          texto={`Campaña «${campana}». Se agregan ${formatearSoles(total)} al pago de este día. Los pedidos que ya tenían bono pasan a este monto, no se acumulan. Puedes quitarlo después.`}
          confirmar="Sí, aplicar el bono"
          alCancelar={() => setPreguntando(null)}
          alConfirmar={() => {
            setPreguntando(null);
            ejecutar(centimos);
          }}
        />
      )}
      {preguntando === "quitar" && (
        <DialogoConfirmar
          titulo={`¿Quitar el bono de ${conBono.length} pedido${conBono.length === 1 ? "" : "s"}?`}
          texto="Vuelven a su tarifa normal y el pago de este día baja en lo que tenían de bono."
          confirmar="Sí, quitar el bono"
          alCancelar={() => setPreguntando(null)}
          alConfirmar={() => {
            setPreguntando(null);
            setAviso(null);
            iniciar(async () => {
              const r = await aplicarBonoAPedidos({ fecha, ordenIds: conBono.map((o) => o.id), bonoCentimos: 0, nombre: "" });
              setAviso(r.ok ? { tono: "bien", texto: r.mensaje } : { tono: "mal", texto: r.error });
              if (r.ok) {
                setElegidos(new Set());
                alCambiar();
              }
            });
          }}
        />
      )}
    </div>
  );
}
