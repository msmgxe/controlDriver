"use client";

import { useState } from "react";

import { Check, Flecha } from "@/components/iconos";

/**
 * Añadir o corregir una ruta a mano.
 *
 * Hace falta por dos caminos que se cruzan. Uno: la captura de Rutas puede
 * salir cortada, o el lector puede perderse una, y entonces sus pedidos no
 * tienen a qué ruta apuntar —el selector de ruta de un pedido sale vacío, sin
 * nada que elegir—. Dos: un día escrito enteramente a mano no tiene ninguna
 * ruta todavía.
 *
 * Solo pide el número y el horario: es lo mínimo para que el pedido tenga
 * dónde apuntar y las estadísticas cuenten el tiempo en ruta.
 */
export function RutaManual({
  siguienteNumero,
  onGuardar,
}: {
  /** El número que se propone por defecto: el que sigue a la última ruta. */
  siguienteNumero: number;
  onGuardar: (datos: { numero: number; horaInicio: string | null; horaFin: string | null }) => void;
}) {
  const [abierto, setAbierto] = useState(false);
  const [numero, setNumero] = useState(String(siguienteNumero));
  const [horaInicio, setHoraInicio] = useState("");
  const [horaFin, setHoraFin] = useState("");

  const numeroValido = /^\d{1,2}$/.test(numero) && Number(numero) >= 1 && Number(numero) <= 99;

  function guardar() {
    if (!numeroValido) return;
    onGuardar({
      numero: Number(numero),
      horaInicio: horaInicio || null,
      horaFin: horaFin || null,
    });
    setAbierto(false);
    setNumero(String(siguienteNumero + 1));
    setHoraInicio("");
    setHoraFin("");
  }

  if (!abierto) {
    return (
      <button
        type="button"
        onClick={() => {
          setNumero(String(siguienteNumero));
          setAbierto(true);
        }}
        className="boton-secundario self-start"
      >
        Añadir una ruta
      </button>
    );
  }

  return (
    <div className="flex flex-col gap-3 rounded-card border border-linea-fuerte bg-sup p-4">
      <h4 className="font-semibold">Ruta a mano</h4>

      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-semibold">Número de ruta</span>
        <input
          value={numero}
          onChange={(e) => setNumero(e.target.value.replace(/\D/g, "").slice(0, 2))}
          inputMode="numeric"
          className="min-h-[52px] w-24 rounded-btn border border-linea-fuerte bg-sup px-3 text-base"
        />
        {numero !== "" && !numeroValido && (
          <span className="text-xs text-mal">Un número entre 1 y 99.</span>
        )}
      </label>

      <div className="grid grid-cols-2 gap-3">
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-semibold">Salida</span>
          <input
            type="time"
            value={horaInicio}
            onChange={(e) => setHoraInicio(e.target.value)}
            className="min-h-[52px] rounded-btn border border-linea-fuerte bg-sup px-3 text-base"
          />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-semibold">Regreso</span>
          <input
            type="time"
            value={horaFin}
            onChange={(e) => setHoraFin(e.target.value)}
            className="min-h-[52px] rounded-btn border border-linea-fuerte bg-sup px-3 text-base"
          />
        </label>
      </div>

      <div className="flex gap-2">
        <button
          type="button"
          onClick={guardar}
          disabled={!numeroValido}
          className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-btn bg-acento px-4 text-sm font-semibold text-acento-texto disabled:opacity-50"
        >
          <Check className="size-4" />
          Guardar
        </button>
        <button type="button" onClick={() => setAbierto(false)} className="boton-secundario">
          Cancelar
        </button>
      </div>
    </div>
  );
}

/**
 * Las rutas del día, en una lista compacta con su horario y un botón para
 * borrarlas. Va junto a `RutaManual`: una construye rutas, esta las enseña.
 */
export function ListaDeRutas({
  rutas,
  onBorrar,
}: {
  rutas: Array<{ numero: number; horaInicio: string | null; horaFin: string | null }>;
  onBorrar?: (numero: number) => void;
}) {
  if (rutas.length === 0) {
    return <p className="text-sm text-tinta-3">Todavía no hay ninguna ruta este día.</p>;
  }

  return (
    <div className="flex flex-col gap-1.5">
      {rutas
        .slice()
        .sort((a, b) => a.numero - b.numero)
        .map((r) => (
          <div
            key={r.numero}
            className="flex items-center gap-3 rounded-btn bg-sup-2 px-3 py-2 text-sm"
          >
            <span className="grid size-7 shrink-0 place-items-center rounded-full bg-acento font-mono text-xs font-bold text-acento-texto">
              {r.numero}
            </span>
            <span className="flex-1 font-mono text-tinta-2">
              {r.horaInicio ?? "--:--"} <Flecha className="inline size-3 -translate-y-px" />{" "}
              {r.horaFin ?? "--:--"}
            </span>
            {onBorrar && (
              <button
                type="button"
                onClick={() => onBorrar(r.numero)}
                className="min-h-8 rounded-btn px-2 text-xs font-semibold text-mal"
              >
                Borrar
              </button>
            )}
          </div>
        ))}
    </div>
  );
}
