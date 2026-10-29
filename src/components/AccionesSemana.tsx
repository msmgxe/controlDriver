"use client";

import { useState, useTransition } from "react";

import { accionReabrirSemana, accionRegistrarPago } from "@/app/(app)/pagos/acciones";
import { DialogoConfirmar } from "@/components/DialogoConfirmar";
import { Check, Reloj } from "@/components/iconos";
import { BotonPag } from "@/components/PagUi";
import { formatearSoles } from "@/lib/pagos/reglas";
import type { EstadoSemana } from "@/lib/db/tipos";

/**
 * Cierre y conciliación de una semana (§13).
 *
 * La semana se bloquea para editar recién cuando se anota lo que pagaron, no
 * antes: mientras no haya cobrado, sigue "abierta" —o "cerrada" si venía de
 * antes de este cambio, que ahora se trata igual— y se puede seguir
 * corrigiendo cualquier día suyo, incluido hoy.
 *
 * Si lo recibido difiere de lo calculado, la diferencia queda a la vista: el
 * desglose por día y por ruta es el sustento para reclamarle a la tienda.
 */
export function AccionesSemana({
  semanaInicio,
  estado,
  montoCalculadoCentimos,
  montoRecibidoCentimos,
  alCambiar,
}: {
  semanaInicio: string;
  estado: EstadoSemana;
  montoCalculadoCentimos: number;
  montoRecibidoCentimos: number | null;
  alCambiar: () => void;
}) {
  const [pendiente, iniciar] = useTransition();
  const [recibido, setRecibido] = useState(
    montoRecibidoCentimos === null ? "" : String(montoRecibidoCentimos / 100),
  );
  const [error, setError] = useState<string | null>(null);
  // Pedir confirmación antes de registrar un monto distinto o de reabrir.
  const [confirmando, setConfirmando] = useState<"pago" | "reabrir" | null>(null);

  const escrito = recibido === "" ? null : Number(recibido);
  const centimosEscritos = escrito === null || Number.isNaN(escrito) ? null : Math.round(escrito * 100);
  const difEscrita = centimosEscritos === null ? null : centimosEscritos - montoCalculadoCentimos;

  const diferencia =
    montoRecibidoCentimos === null ? null : montoRecibidoCentimos - montoCalculadoCentimos;

  // Sin avisarle al padre, la pantalla se quedaba mostrando el formulario de
  // "¿cuánto te pagaron?" después de haberlo registrado: el dato ya estaba
  // guardado, pero nada volvía a pedirlo para que la pantalla se enterara.
  function ejecutar(accion: () => Promise<{ ok: true } | { ok: false; error: string }>) {
    setError(null);
    iniciar(async () => {
      const r = await accion();
      setConfirmando(null);
      if (!r.ok) setError(r.error);
      else alCambiar();
    });
  }

  const pagada = estado === "pagada";

  return (
    <div className="flex flex-col gap-3 border-t border-linea pt-4">
      {!pagada && (
        <>
          <label htmlFor={`recibido-${semanaInicio}`} className="font-display text-base font-bold">
            ¿Cuánto te pagaron?
          </label>
          <p className="-mt-1.5 text-xs text-tinta-2">
            Anótalo el día que cobres. Hasta entonces la semana sigue abierta y puedes seguir
            corrigiendo cualquier día suyo.
          </p>
          <div className="flex flex-wrap gap-2">
            <input
              id={`recibido-${semanaInicio}`}
              type="number"
              inputMode="decimal"
              step="0.5"
              min="0"
              placeholder={String(montoCalculadoCentimos / 100)}
              value={recibido}
              onChange={(e) => setRecibido(e.target.value)}
              className="min-h-14 min-w-32 flex-1 rounded-btn border-[3px] border-[var(--c-pagos)] bg-sup px-4 text-xl font-bold"
            />
          </div>
          {difEscrita !== null && (
            <p
              className={`text-sm font-bold ${difEscrita < 0 ? "text-mal" : "text-bien"}`}
              aria-live="polite"
            >
              {difEscrita === 0
                ? "Cuadra justo con lo calculado."
                : difEscrita < 0
                  ? `Te pagaron de menos: ${formatearSoles(-difEscrita)} por reclamar.`
                  : `Te pagaron de más: ${formatearSoles(difEscrita)} a tu favor.`}
            </p>
          )}
          <BotonPag
            k="pagos"
            grande
            ancho
            disabled={pendiente || centimosEscritos === null}
            onClick={() => {
              // Lo justo se guarda directo; un monto distinto pide confirmar.
              if (difEscrita === 0) ejecutar(() => accionRegistrarPago(semanaInicio, Number(recibido)));
              else setConfirmando("pago");
            }}
          >
            <Check className="size-5" />
            {pendiente ? "Guardando…" : "Registrar pago"}
          </BotonPag>
        </>
      )}

      {pagada && (
        <BotonPag k="mano" ancho disabled={pendiente} onClick={() => setConfirmando("reabrir")}>
          <Reloj className="size-5" />
          {pendiente ? "Reabriendo…" : "Reabrir para corregir algo"}
        </BotonPag>
      )}

      {diferencia !== null && diferencia !== 0 && (
        <p
          className={`text-sm font-semibold ${diferencia < 0 ? "text-mal" : "text-bien"}`}
        >
          {diferencia < 0 ? "Te pagaron de menos: " : "Te pagaron de más: "}
          {formatearSoles(Math.abs(diferencia))}. El desglose por día y por ruta sirve de sustento.
        </p>
      )}

      {error && <p className="text-sm font-semibold text-mal">{error}</p>}

      {confirmando === "pago" && centimosEscritos !== null && (
        <DialogoConfirmar
          titulo="¿Registrar este pago?"
          texto={`Anotarás ${formatearSoles(centimosEscritos)} y la semana quedará pagada y bloqueada. Lo calculado era ${formatearSoles(montoCalculadoCentimos)}${
            difEscrita !== null && difEscrita !== 0
              ? `: ${difEscrita < 0 ? "faltan" : "sobran"} ${formatearSoles(Math.abs(difEscrita))}`
              : ""
          }.`}
          confirmar="Sí, registrar"
          ocupado={pendiente}
          alConfirmar={() => ejecutar(() => accionRegistrarPago(semanaInicio, Number(recibido)))}
          alCancelar={() => setConfirmando(null)}
        />
      )}
      {confirmando === "reabrir" && (
        <DialogoConfirmar
          titulo="¿Reabrir esta semana?"
          texto={`El pago de ${formatearSoles(montoRecibidoCentimos ?? 0)} dejará de estar registrado y la semana volverá a poder editarse.`}
          confirmar="Sí, reabrir"
          ocupado={pendiente}
          alConfirmar={() => ejecutar(() => accionReabrirSemana(semanaInicio))}
          alCancelar={() => setConfirmando(null)}
        />
      )}
    </div>
  );
}
