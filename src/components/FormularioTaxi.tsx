"use client";

import { useState } from "react";

import { guardarBloqueTaxi } from "@/app/(app)/jornada/acciones";
import { Campo } from "@/components/FormularioApoyoHora";
import { Aviso } from "@/components/ui";
import { horaEnLima, type FechaISO } from "@/lib/fechas";
import type { Punto } from "@/lib/geo/distancia";
import { posicionParaBloqueExtra } from "@/lib/geo/nativo";
import { distanciaDeTaxi } from "@/lib/geo/taxi";
import { aCentimos } from "@/lib/pagos/reglas";
import type { FuenteDeKm } from "@/lib/db/tipos";

export function FormularioTaxi({
  fecha,
  factorCalles,
  alGuardar,
}: {
  fecha: FechaISO;
  factorCalles: number;
  alGuardar: () => void;
}) {
  const [origen, setOrigen] = useState<Punto | null>(null);
  const [destino, setDestino] = useState<Punto | null>(null);
  const [horaInicio, setHoraInicio] = useState<string | null>(null);
  const [horaFin, setHoraFin] = useState<string | null>(null);
  const [km, setKm] = useState("");
  const [kmFuente, setKmFuente] = useState<FuenteDeKm>("manual");
  const [monto, setMonto] = useState("");
  const [buscando, setBuscando] = useState<"inicio" | "fin" | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function marcarInicio() {
    setBuscando("inicio");
    const p = await posicionParaBloqueExtra();
    setBuscando(null);
    setOrigen(p);
    setHoraInicio(horaEnLima());
  }

  async function marcarFin() {
    setBuscando("fin");
    const p = await posicionParaBloqueExtra();
    setBuscando(null);
    setDestino(p);
    setHoraFin(horaEnLima());
    if (origen && p) {
      const d = await distanciaDeTaxi(origen, p, factorCalles);
      setKm(String(d.km));
      setKmFuente(d.fuente);
    }
  }

  const montoCentimos = aCentimos(Number(monto.replace(",", ".")) || 0);
  const kmNumero = Number(km.replace(",", "."));
  const puedeGuardar = kmNumero > 0 && montoCentimos > 0 && !guardando;

  async function guardar() {
    setGuardando(true);
    setError(null);
    const r = await guardarBloqueTaxi({
      fecha,
      horaInicio,
      horaFin,
      origen,
      destino,
      km: kmNumero,
      kmFuente,
      montoCentimos,
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

        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => void marcarInicio()}
            disabled={buscando !== null}
            className={`boton-sec flex-1 !min-h-14 flex-col !gap-0.5 ${origen ? "!border-acento !text-acento-tinta" : ""}`}
          >
            <span className="text-xs font-semibold opacity-80">{buscando === "inicio" ? "Ubicando…" : "Inicio"}</span>
            <span className="text-sm font-bold">{origen ? `${horaInicio} marcado` : "Marcar inicio"}</span>
          </button>
          <button
            type="button"
            onClick={() => void marcarFin()}
            disabled={buscando !== null || !origen}
            className={`boton-sec flex-1 !min-h-14 flex-col !gap-0.5 ${destino ? "!border-acento !text-acento-tinta" : ""}`}
          >
            <span className="text-xs font-semibold opacity-80">{buscando === "fin" ? "Ubicando…" : "Fin"}</span>
            <span className="text-sm font-bold">{destino ? `${horaFin} marcado` : "Marcar fin"}</span>
          </button>
        </div>
        {(!origen || !destino) && (
          <p className="-mt-2 text-xs text-tinta-3">
            Sin GPS no hay problema: escribe los km a mano abajo.
          </p>
        )}

        <Campo etiqueta="Kilómetros">
          <input
            inputMode="decimal"
            value={km}
            onChange={(e) => {
              setKm(e.target.value);
              setKmFuente("manual");
            }}
            placeholder="8.2"
            className="min-h-11 rounded-btn border border-linea-fuerte bg-sup px-3 text-base"
          />
        </Campo>

        <Campo etiqueta="Cuánto cobraste (S/)">
          <input
            inputMode="decimal"
            value={monto}
            onChange={(e) => setMonto(e.target.value)}
            placeholder="22.00"
            className="min-h-11 rounded-btn border border-linea-fuerte bg-sup px-3 text-base"
          />
        </Campo>
      </div>

      <div className="flex flex-col gap-2 border-t border-linea px-4 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom,0px))]">
        <button type="button" className="boton-principal !min-h-11 !text-base" disabled={!puedeGuardar} onClick={() => void guardar()}>
          {guardando ? "Guardando…" : "Guardar taxi"}
        </button>
      </div>
    </>
  );
}
