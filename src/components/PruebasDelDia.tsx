"use client";

import { useState } from "react";

import { Alerta } from "@/components/iconos";
import { useDatos } from "@/hooks/useDatos";
import {
  borrarPrueba,
  contenidoDePrueba,
  pruebasDelDia,
  type Prueba,
} from "@/lib/db/sqlite/pruebas";
import type { FechaISO } from "@/lib/fechas";

/**
 * Las capturas guardadas de un día.
 *
 * Existen para una sola cosa, y es la que las justifica: **si la tienda
 * discute un pago, el pantallazo original lo zanja**. Por eso se enseñan aquí,
 * junto al detalle del día, y no escondidas en Ajustes.
 *
 * Están en el almacenamiento privado de la aplicación: no salen en la galería
 * ni las ve ninguna otra app. Se pueden borrar una a una cuando ya no hacen
 * falta —ocupan sitio y no todo el mundo quiere guardarlas para siempre.
 */
export function PruebasDelDia({ fecha }: { fecha: FechaISO }) {
  const { datos: pruebas, recargar } = useDatos(() => pruebasDelDia(fecha), [fecha]);
  const [viendo, setViendo] = useState<Prueba | null>(null);

  if (!pruebas) return null;

  if (pruebas.length === 0) {
    return (
      <p className="text-sm text-tinta-3">
        No hay capturas guardadas de este día. Se guardan solas al cargar.
      </p>
    );
  }

  const megas = pruebas.reduce((s, p) => s + p.bytes, 0) / 1_048_576;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <span className="text-sm text-tinta-2">
          {pruebas.length} captura{pruebas.length === 1 ? "" : "s"} guardada
          {pruebas.length === 1 ? "" : "s"}
        </span>
        <span className="text-xs text-tinta-3">{megas.toFixed(1)} MB</span>
      </div>

      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
        {pruebas.map((prueba) => (
          <Miniatura key={prueba.id} prueba={prueba} onAbrir={() => setViendo(prueba)} />
        ))}
      </div>

      {viendo && (
        <VisorDePrueba
          prueba={viendo}
          onCerrar={() => setViendo(null)}
          onBorrada={() => {
            setViendo(null);
            recargar();
          }}
        />
      )}
    </div>
  );
}

function Miniatura({ prueba, onAbrir }: { prueba: Prueba; onAbrir: () => void }) {
  const { datos: fuente } = useDatos(() => contenidoDePrueba(prueba.archivo), [prueba.archivo]);

  return (
    <button
      type="button"
      onClick={onAbrir}
      className="aspect-[3/5] overflow-hidden rounded-btn border border-linea bg-sup-2"
      aria-label="Ver la captura completa"
    >
      {fuente ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={fuente}
          alt=""
          className="size-full object-cover object-top"
          loading="lazy"
        />
      ) : (
        <span className="block size-full animate-pulse bg-sup-2" />
      )}
    </button>
  );
}

function VisorDePrueba({
  prueba,
  onCerrar,
  onBorrada,
}: {
  prueba: Prueba;
  onCerrar: () => void;
  onBorrada: () => void;
}) {
  const { datos: fuente } = useDatos(() => contenidoDePrueba(prueba.archivo), [prueba.archivo]);
  const [confirmando, setConfirmando] = useState(false);

  async function borrar() {
    await borrarPrueba(prueba.id);
    onBorrada();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col bg-black/90"
      onClick={(e) => {
        if (e.target === e.currentTarget) onCerrar();
      }}
    >
      <div className="flex-1 overflow-auto p-4">
        {fuente && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={fuente} alt="Captura guardada" className="mx-auto max-w-full" />
        )}
      </div>

      <div className="flex gap-2 p-4 pb-[calc(1rem+env(safe-area-inset-bottom,0px))]">
        <button type="button" onClick={onCerrar} className="boton-secundario flex-1">
          Cerrar
        </button>
        {confirmando ? (
          <button
            type="button"
            onClick={() => void borrar()}
            className="min-h-11 flex-1 rounded-btn bg-mal px-4 text-sm font-semibold text-white"
          >
            Sí, borrar
          </button>
        ) : (
          <button
            type="button"
            onClick={() => setConfirmando(true)}
            className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-btn px-4 text-sm font-semibold text-mal"
          >
            <Alerta className="size-4" />
            Borrar
          </button>
        )}
      </div>
    </div>
  );
}
