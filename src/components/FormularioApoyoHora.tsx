"use client";

import { useState } from "react";

import { guardarBloqueApoyoHora } from "@/app/(app)/jornada/acciones";
import { Aviso } from "@/components/ui";
import { horaEnLima, type FechaISO } from "@/lib/fechas";
import type { BloqueExtraFila } from "@/lib/db/tipos";
import { aCentimos } from "@/lib/pagos/reglas";

/** Horas entre dos `HH:MM`, en decimal —sin el truncado de `horasDePermanencia`: aquí es tarifa, no piso. */
function horasEntre(inicio: string, fin: string): number {
  const [hi, mi] = inicio.split(":").map(Number);
  const [hf, mf] = fin.split(":").map(Number);
  const minInicio = hi * 60 + mi;
  const minFin = hf * 60 + mf;
  const minutos = minFin >= minInicio ? minFin - minInicio : minFin + 24 * 60 - minInicio;
  return Math.round((minutos / 60) * 100) / 100;
}

export function FormularioApoyoHora({
  fecha,
  inicial,
  alGuardar,
}: {
  fecha: FechaISO;
  /** Si se corrige un apoyo ya guardado: sus datos de partida. */
  inicial?: Extract<BloqueExtraFila, { tipo: "apoyo_hora" }>;
  alGuardar: () => void;
}) {
  const [tiendaNombre, setTiendaNombre] = useState(inicial?.tiendaNombre ?? "");
  const [horaInicio, setHoraInicio] = useState(inicial?.horaInicio ?? horaEnLima());
  const [horaFin, setHoraFin] = useState(inicial?.horaFin ?? "");
  const [tarifa, setTarifa] = useState(inicial ? String(inicial.tarifaHoraCentimos / 100) : "");
  const [motivo, setMotivo] = useState(inicial?.motivo ?? "");
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const horas = horaFin ? horasEntre(horaInicio, horaFin) : 0;
  const tarifaCentimos = aCentimos(Number(tarifa.replace(",", ".")) || 0);
  const puedeGuardar = tiendaNombre.trim().length > 0 && horaFin !== "" && horas > 0 && tarifaCentimos > 0 && !guardando;

  async function guardar() {
    setGuardando(true);
    setError(null);
    const r = await guardarBloqueApoyoHora({
      fecha,
      horaInicio,
      horaFin,
      tiendaNombre: tiendaNombre.trim(),
      tarifaHoraCentimos: tarifaCentimos,
      horas,
      motivo: motivo.trim() || null,
      notas: null,
    });
    setGuardando(false);
    if (!r.ok) {
      setError(r.error);
      return;
    }
    alGuardar();
  }

  return (
    <>
      <div className="flex flex-1 flex-col gap-4 overflow-y-auto px-4 pb-4">
        {error && <Aviso tono="mal" titulo="No se pudo guardar">{error}</Aviso>}

        <Campo etiqueta="Tienda a la que apoyaste">
          <input
            value={tiendaNombre}
            onChange={(e) => setTiendaNombre(e.target.value)}
            placeholder="Tienda Limatambo"
            className="min-h-11 rounded-btn border border-linea-fuerte bg-sup px-3 text-base"
          />
        </Campo>

        <div className="flex gap-3">
          <Campo etiqueta="Entrada" className="flex-1">
            <input
              type="time"
              value={horaInicio}
              onChange={(e) => setHoraInicio(e.target.value)}
              className="min-h-11 rounded-btn border border-linea-fuerte bg-sup px-3 text-base"
            />
          </Campo>
          <Campo etiqueta="Salida" className="flex-1">
            <input
              type="time"
              value={horaFin}
              onChange={(e) => setHoraFin(e.target.value)}
              className="min-h-11 rounded-btn border border-linea-fuerte bg-sup px-3 text-base"
            />
          </Campo>
        </div>
        {horas > 0 && <p className="-mt-2 text-xs text-tinta-2">{horas} horas</p>}

        <Campo etiqueta="Tarifa por hora (S/)">
          <input
            inputMode="decimal"
            value={tarifa}
            onChange={(e) => setTarifa(e.target.value)}
            placeholder="18.00"
            className="min-h-11 rounded-btn border border-linea-fuerte bg-sup px-3 text-base"
          />
        </Campo>

        <Campo etiqueta="Motivo (opcional)">
          <input
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            placeholder="Refuerzo de pedidos"
            className="min-h-11 rounded-btn border border-linea-fuerte bg-sup px-3 text-base"
          />
        </Campo>
      </div>

      <div className="flex flex-col gap-2 border-t border-linea px-4 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom,0px))]">
        <button type="button" className="boton-principal !min-h-11 !text-base" disabled={!puedeGuardar} onClick={() => void guardar()}>
          {guardando ? "Guardando…" : inicial ? "Guardar cambios" : "Guardar apoyo"}
        </button>
      </div>
    </>
  );
}

export function Campo({ etiqueta, className = "", children }: { etiqueta: string; className?: string; children: React.ReactNode }) {
  return (
    <label className={`flex flex-col gap-1.5 ${className}`}>
      <span className="text-sm font-semibold">{etiqueta}</span>
      {children}
    </label>
  );
}
