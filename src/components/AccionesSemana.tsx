"use client";

import { useState, useTransition } from "react";

import { accionReabrirSemana, accionRegistrarPago } from "@/app/(app)/pagos/acciones";
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

  const diferencia =
    montoRecibidoCentimos === null ? null : montoRecibidoCentimos - montoCalculadoCentimos;

  // Sin avisarle al padre, la pantalla se quedaba mostrando el formulario de
  // "¿cuánto te pagaron?" después de haberlo registrado: el dato ya estaba
  // guardado, pero nada volvía a pedirlo para que la pantalla se enterara.
  function ejecutar(accion: () => Promise<{ ok: true } | { ok: false; error: string }>) {
    setError(null);
    iniciar(async () => {
      const r = await accion();
      if (!r.ok) setError(r.error);
      else alCambiar();
    });
  }

  const pagada = estado === "pagada";

  return (
    <div className="flex flex-col gap-3 border-t border-linea pt-4">
      {!pagada && (
        <>
          <label htmlFor={`recibido-${semanaInicio}`} className="text-sm font-semibold">
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
              className="min-h-11 min-w-32 flex-1 rounded-btn border border-linea-fuerte bg-sup px-4 text-base"
            />
            <button
              type="button"
              className="boton-principal"
              disabled={pendiente || recibido === ""}
              onClick={() =>
                ejecutar(() => accionRegistrarPago(semanaInicio, Number(recibido)))
              }
            >
              {pendiente ? "Guardando…" : "Registrar pago"}
            </button>
          </div>
        </>
      )}

      {pagada && (
        <button
          type="button"
          className="boton-sec self-start"
          disabled={pendiente}
          onClick={() => ejecutar(() => accionReabrirSemana(semanaInicio))}
        >
          {pendiente ? "Reabriendo…" : "Reabrir para corregir algo"}
        </button>
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
    </div>
  );
}
