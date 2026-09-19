"use client";

import { useEffect, useRef, useState } from "react";

import { Flecha } from "@/components/iconos";
import { useCapa } from "@/hooks/useCapa";
import { useDatos } from "@/hooks/useDatos";
import {
  borrarPrueba,
  borrarPruebasDelDia,
  contenidoDePrueba,
  pruebasDelDia,
  quitarRepetidas,
  type Prueba,
} from "@/lib/db/sqlite/pruebas";
import type { FechaISO } from "@/lib/fechas";

/**
 * Las capturas guardadas de un día.
 *
 * Existen para una sola cosa, y es la que las justifica: **si la tienda
 * discute un pago, el pantallazo original lo zanja**. Por eso se enseñan junto
 * al detalle del día y no escondidas en Ajustes.
 *
 * Al abrirlas se limpian las repetidas que quedaran de versiones anteriores
 * —la misma captura subida varias veces—. Solo se quitan las idénticas byte a
 * byte a otra que se queda, así que no se pierde nada.
 */
export function PruebasDelDia({ fecha }: { fecha: FechaISO }) {
  const [intento, setIntento] = useState(0);
  const { datos } = useDatos(async () => {
    const quitadas = await quitarRepetidas(fecha);
    return { pruebas: await pruebasDelDia(fecha), quitadas };
  }, [fecha, intento]);
  const [abierta, setAbierta] = useState<number | null>(null);
  const [confirmandoTodas, setConfirmandoTodas] = useState(false);

  if (!datos) return null;
  const { pruebas, quitadas } = datos;

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
          {pruebas.length} captura{pruebas.length === 1 ? "" : "s"}
        </span>
        <span className="text-xs text-tinta-3">{megas.toFixed(1)} MB</span>
      </div>

      {quitadas > 0 && (
        <p className="rounded-btn bg-acento-suave px-3 py-2 text-xs text-acento-tinta">
          Se quitaron {quitadas} captura{quitadas === 1 ? "" : "s"} repetida
          {quitadas === 1 ? "" : "s"}: eran copias exactas de otras que se conservan.
        </p>
      )}

      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
        {pruebas.map((prueba, i) => (
          <Miniatura key={prueba.id} prueba={prueba} onAbrir={() => setAbierta(i)} />
        ))}
      </div>

      {confirmandoTodas ? (
        <div className="flex flex-col gap-2 rounded-btn bg-mal-suave p-3">
          <p className="text-sm text-mal">
            ¿Borrar las {pruebas.length} capturas de este día? Los pedidos y rutas guardados no se
            tocan; solo las imágenes.
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={async () => {
                await borrarPruebasDelDia(fecha);
                setConfirmandoTodas(false);
                setIntento((n) => n + 1);
              }}
              className="min-h-11 flex-1 rounded-btn bg-mal px-4 text-sm font-semibold text-white"
            >
              Sí, borrarlas
            </button>
            <button
              type="button"
              onClick={() => setConfirmandoTodas(false)}
              className="boton-secundario flex-1"
            >
              No
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setConfirmandoTodas(true)}
          className="self-start text-sm font-semibold text-mal"
        >
          Borrar todas las capturas de este día
        </button>
      )}

      {abierta !== null && (
        <Carrusel
          pruebas={pruebas}
          inicial={abierta}
          onCerrar={() => setAbierta(null)}
          onBorrada={() => {
            setAbierta(null);
            setIntento((n) => n + 1);
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
      aria-label="Ver la captura"
    >
      {fuente ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={fuente} alt="" className="size-full object-cover object-top" loading="lazy" />
      ) : (
        <span className="block size-full animate-pulse bg-sup-2" />
      )}
    </button>
  );
}

/**
 * Pasar las capturas de una en una, deslizando con el dedo.
 *
 * Antes, al abrir una captura no había forma de ir a la siguiente: había que
 * cerrar y tocar otra miniatura, doce veces para revisar un día. Ahora se
 * desliza como un carrusel, con botones para quien prefiera tocar y un
 * contador para saber dónde se está.
 *
 * El deslizamiento es el desplazamiento nativo del navegador con «encaje»
 * (`scroll-snap`): responde al dedo con la misma física que el resto del
 * teléfono, sin reimplementar gestos a mano.
 */
function Carrusel({
  pruebas,
  inicial,
  onCerrar,
  onBorrada,
}: {
  pruebas: Prueba[];
  inicial: number;
  onCerrar: () => void;
  onBorrada: () => void;
}) {
  const pista = useRef<HTMLDivElement>(null);
  const [actual, setActual] = useState(inicial);
  const [confirmando, setConfirmando] = useState(false);

  useCapa(onCerrar);

  // Abre en la captura que se tocó, sin animación: aparecer ya en su sitio.
  useEffect(() => {
    const el = pista.current;
    if (el) el.scrollLeft = inicial * el.clientWidth;
  }, [inicial]);

  function ir(indice: number) {
    const el = pista.current;
    if (!el) return;
    const destino = Math.max(0, Math.min(pruebas.length - 1, indice));
    el.scrollTo({ left: destino * el.clientWidth, behavior: "smooth" });
  }

  async function borrar() {
    await borrarPrueba(pruebas[actual].id);
    onBorrada();
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black">
      <div className="flex items-center justify-between gap-3 px-4 pt-[calc(0.75rem+env(safe-area-inset-top,0px))] pb-2 text-white">
        <span className="font-mono text-sm" aria-live="polite">
          {actual + 1} de {pruebas.length}
        </span>
        <button
          type="button"
          onClick={onCerrar}
          className="min-h-11 rounded-btn px-4 text-sm font-semibold"
        >
          Cerrar
        </button>
      </div>

      <div
        ref={pista}
        onScroll={(e) => {
          const el = e.currentTarget;
          setActual(Math.round(el.scrollLeft / el.clientWidth));
          setConfirmando(false);
        }}
        className="flex flex-1 snap-x snap-mandatory overflow-x-auto overflow-y-hidden [scrollbar-width:none]"
      >
        {pruebas.map((prueba) => (
          <Diapositiva key={prueba.id} prueba={prueba} />
        ))}
      </div>

      <div className="flex items-center gap-2 px-4 pt-2 pb-[calc(1rem+env(safe-area-inset-bottom,0px))]">
        <button
          type="button"
          onClick={() => ir(actual - 1)}
          disabled={actual === 0}
          aria-label="Captura anterior"
          className="grid size-12 place-items-center rounded-full bg-white/15 text-white disabled:opacity-30"
        >
          <Flecha className="size-5 rotate-180" />
        </button>

        <div className="flex flex-1 justify-center">
          {confirmando ? (
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => void borrar()}
                className="min-h-11 rounded-btn bg-mal px-4 text-sm font-semibold text-white"
              >
                Sí, borrar esta
              </button>
              <button
                type="button"
                onClick={() => setConfirmando(false)}
                className="min-h-11 rounded-btn bg-white/15 px-4 text-sm font-semibold text-white"
              >
                No
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setConfirmando(true)}
              className="min-h-11 rounded-btn px-4 text-sm font-semibold text-red-300"
            >
              Borrar esta captura
            </button>
          )}
        </div>

        <button
          type="button"
          onClick={() => ir(actual + 1)}
          disabled={actual === pruebas.length - 1}
          aria-label="Captura siguiente"
          className="grid size-12 place-items-center rounded-full bg-white/15 text-white disabled:opacity-30"
        >
          <Flecha className="size-5" />
        </button>
      </div>
    </div>
  );
}

function Diapositiva({ prueba }: { prueba: Prueba }) {
  const { datos: fuente } = useDatos(() => contenidoDePrueba(prueba.archivo), [prueba.archivo]);

  return (
    <div className="flex w-full shrink-0 snap-center items-start justify-center overflow-y-auto px-2">
      {fuente ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={fuente} alt="Captura guardada" className="max-w-full" />
      ) : (
        <span className="mt-20 text-sm text-white/50">Cargando…</span>
      )}
    </div>
  );
}
