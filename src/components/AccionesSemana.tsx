"use client";

import { useState, useTransition } from "react";

import { accionCerrarSemana, accionReabrirSemana, accionRegistrarPago } from "@/app/(app)/pagos/acciones";
import { formatearSoles } from "@/lib/pagos/reglas";
import type { EstadoSemana } from "@/lib/db/liquidaciones";

/**
 * Cierre y conciliación de una semana (§13).
 *
 * Si lo recibido difiere de lo calculado, la diferencia queda a la vista: el
 * desglose por día y por ruta es el sustento para reclamarle a la tienda.
 */
export function AccionesSemana({
  semanaInicio,
  estado,
  montoCalculadoCentimos,
  montoRecibidoCentimos,
}: {
  semanaInicio: string;
  estado: EstadoSemana;
  montoCalculadoCentimos: number;
  montoRecibidoCentimos: number | null;
}) {
  const [pendiente, iniciar] = useTransition();
  const [recibido, setRecibido] = useState(
    montoRecibidoCentimos === null ? "" : String(montoRecibidoCentimos / 100),
  );
  const [error, setError] = useState<string | null>(null);

  const diferencia =
    montoRecibidoCentimos === null ? null : montoRecibidoCentimos - montoCalculadoCentimos;

  function ejecutar(accion: () => Promise<{ ok: true } | { ok: false; error: string }>) {
    setError(null);
    iniciar(async () => {
      const r = await accion();
      if (!r.ok) setError(r.error);
    });
  }

  return (
    <div className="flex flex-col gap-3 border-t border-linea pt-4">
      {estado === "abierta" && (
        <button
          type="button"
          className="boton-sec self-start"
          disabled={pendiente}
          onClick={() => ejecutar(() => accionCerrarSemana(semanaInicio))}
        >
          {pendiente ? "Cerrando…" : "Cerrar la semana"}
        </button>
      )}

      {estado !== "abierta" && (
        <>
          <label htmlFor={`recibido-${semanaInicio}`} className="text-sm font-semibold">
            ¿Cuánto te pagaron?
          </label>
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
              className="boton-sec"
              disabled={pendiente || recibido === ""}
              onClick={() =>
                ejecutar(() => accionRegistrarPago(semanaInicio, Number(recibido)))
              }
            >
              {pendiente ? "Guardando…" : "Registrar"}
            </button>
            <button
              type="button"
              className="boton-sec"
              disabled={pendiente}
              onClick={() => ejecutar(() => accionReabrirSemana(semanaInicio))}
            >
              Reabrir
            </button>
          </div>
        </>
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
