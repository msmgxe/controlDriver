"use client";

import { useState } from "react";

import { useCapa } from "@/hooks/useCapa";
import { Reloj, Suma, Taxi, Tienda } from "@/components/iconos";

/**
 * El botón flotante "+" de Inicio: abre un menú con las tres formas de
 * agregar algo al día (§ plan de apoyo/taxi). "Pedidos de una tienda" no
 * abre nada propio: reusa el "Subir más" que ya existe.
 */
export function MenuAgregarBloque({
  disabled,
  onElegirTienda,
  onElegirApoyo,
  onElegirTaxi,
}: {
  disabled: boolean;
  onElegirTienda: () => void;
  onElegirApoyo: () => void;
  onElegirTaxi: () => void;
}) {
  const [abierto, setAbierto] = useState(false);

  return (
    <>
      <button
        type="button"
        aria-label="Agregar al día"
        disabled={disabled}
        onClick={() => setAbierto(true)}
        className="fixed right-5 bottom-[calc(84px+env(safe-area-inset-bottom,0px))] z-40 grid size-14 place-items-center rounded-full bg-acento text-acento-texto shadow-alta disabled:opacity-50 sm:bottom-6"
      >
        <Suma className="size-7" />
      </button>

      {abierto && (
        <SheetDeOpciones
          alCerrar={() => setAbierto(false)}
          onElegirTienda={() => {
            setAbierto(false);
            onElegirTienda();
          }}
          onElegirApoyo={() => {
            setAbierto(false);
            onElegirApoyo();
          }}
          onElegirTaxi={() => {
            setAbierto(false);
            onElegirTaxi();
          }}
        />
      )}
    </>
  );
}

/** Aparte de `MenuAgregarBloque`: `useCapa` debe montarse solo mientras la hoja está abierta. */
function SheetDeOpciones({
  alCerrar,
  onElegirTienda,
  onElegirApoyo,
  onElegirTaxi,
}: {
  alCerrar: () => void;
  onElegirTienda: () => void;
  onElegirApoyo: () => void;
  onElegirTaxi: () => void;
}) {
  useCapa(alCerrar);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center sm:p-5"
      onClick={(e) => {
        if (e.target === e.currentTarget) alCerrar();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Agregar al día"
        className="w-full max-w-md rounded-t-hoja bg-sup px-4 pt-3 pb-[calc(1rem+env(safe-area-inset-bottom,0px))] shadow-alta sm:rounded-hoja sm:pb-4"
      >
        <span className="mx-auto mb-3 block h-1 w-9 rounded-full bg-linea-fuerte sm:hidden" />
        <p className="mb-1 px-1 text-xs font-bold tracking-wide text-tinta-2 uppercase">Agregar al día</p>

        <OpcionDelMenu
          Icono={Tienda}
          titulo="Pedidos de una tienda"
          detalle="Como ya funciona hoy"
          fondo="bg-acento-suave text-acento-tinta"
          onClick={onElegirTienda}
        />
        <OpcionDelMenu
          Icono={Reloj}
          titulo="Apoyo a otra tienda"
          detalle="Por hora, o por tramos"
          fondo="bg-[#fff4d6] text-[#8a6200]"
          onClick={onElegirApoyo}
        />
        <OpcionDelMenu
          Icono={Taxi}
          titulo="Taxi libre"
          detalle="Carrera suelta: inicio, fin y km"
          fondo="bg-[#ece7ff] text-[#5b2bd6]"
          onClick={onElegirTaxi}
        />
      </div>
    </div>
  );
}

function OpcionDelMenu({
  Icono,
  titulo,
  detalle,
  fondo,
  onClick,
}: {
  Icono: typeof Tienda;
  titulo: string;
  detalle: string;
  fondo: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-3 border-t border-linea py-3 text-left first:border-t-0"
    >
      <span className={`grid size-10 shrink-0 place-items-center rounded-full ${fondo}`}>
        <Icono className="size-[19px]" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-bold text-tinta">{titulo}</span>
        <span className="block text-xs text-tinta-2">{detalle}</span>
      </span>
      <span className="text-tinta-3">›</span>
    </button>
  );
}
