"use client";

import { useState } from "react";

import { eliminarBloque } from "@/app/(app)/jornada/acciones";
import { FormularioApoyoHora } from "@/components/FormularioApoyoHora";
import { FormularioApoyoTramos } from "@/components/FormularioApoyoTramos";
import { FormularioTaxi } from "@/components/FormularioTaxi";
import { Calendario, Equis } from "@/components/iconos";
import { useCapa } from "@/hooks/useCapa";
import { useDatos } from "@/hooks/useDatos";
import { listarTiendas, perfilActual } from "@/lib/db/sqlite/perfil";
import type { BloqueExtraFila, Tienda } from "@/lib/db/tipos";
import { formatearFechaLarga, hoyEnLima, type FechaISO } from "@/lib/fechas";

type TipoFlujo = "apoyo" | "taxi";

/**
 * La hoja que abre "Apoyo a otra tienda" o "Taxi libre" (§ plan de
 * apoyo/taxi), desde el "+" de Inicio, desde «Cargar» o desde «Subir más».
 *
 * Arriba va **el día**, que se puede cambiar: el apoyo o el taxi de ayer se
 * anota igual que el de hoy. El apoyo tiene dos formas de tarifarse —por hora
 * o por tramos—, elegidas aquí mismo, porque es una decisión del momento.
 *
 * Con `corregir`, la misma hoja sirve para arreglar un bloque ya guardado: se
 * abre con sus datos, y al guardar el nuevo reemplaza al viejo (primero se
 * guarda el nuevo y después se borra el viejo: si algo falla, no se pierde nada).
 */
export function HojaDeBloqueExtra({
  tipo,
  fecha,
  tiendas,
  factorCalles,
  corregir,
  alCerrar,
  alGuardar,
}: {
  tipo: TipoFlujo;
  fecha: FechaISO;
  tiendas: Tienda[];
  factorCalles: number;
  /** Un bloque ya guardado que se está corrigiendo: manda sobre `tipo`. */
  corregir?: BloqueExtraFila;
  alCerrar: () => void;
  alGuardar: () => void;
}) {
  useCapa(alCerrar);
  const hoy = hoyEnLima();
  const [dia, setDia] = useState<FechaISO>(fecha);
  const flujo: TipoFlujo = corregir ? (corregir.tipo === "taxi" ? "taxi" : "apoyo") : tipo;
  const [modoApoyo, setModoApoyo] = useState<"hora" | "tramos">(corregir?.tipo === "apoyo_tramos" ? "tramos" : "hora");

  const titulo = `${corregir ? "Corregir: " : ""}${flujo === "taxi" ? "Adicional" : "Apoyo a otra tienda"}`;

  async function alTerminar() {
    if (corregir) await eliminarBloque(fecha, corregir.id);
    alGuardar();
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
        aria-label={titulo}
        className="flex h-[94dvh] w-full max-w-md flex-col overflow-hidden rounded-t-hoja bg-sup shadow-alta sm:h-[88dvh] sm:rounded-hoja"
      >
        <div className="flex items-start justify-between gap-3 px-4 pt-4 pb-2">
          <div className="min-w-0">
            <span className="mx-auto mb-2 block h-1 w-9 rounded-full bg-linea-fuerte sm:hidden" />
            <h3 className="text-[21px] leading-tight">{titulo}</h3>
          </div>
          <button
            type="button"
            onClick={alCerrar}
            aria-label="Cerrar"
            className="grid size-11 shrink-0 place-items-center rounded-full bg-sup-2"
          >
            <Equis className="size-5" />
          </button>
        </div>

        {/* El día: lo primero que se ve, y se cambia sin salir. */}
        <div className="px-4 pb-3">
          <label className="relative flex min-h-12 items-center gap-3 rounded-btn border border-linea-fuerte bg-sup px-3">
            <Calendario className="size-5 shrink-0 text-tinta-2" />
            <span className="min-w-0 flex-1 text-[15px] font-semibold first-letter:uppercase">
              {formatearFechaLarga(dia).replace(/ de \d{4}$/, "")}
              {dia === hoy && <span className="ml-2 text-xs font-medium text-acento-tinta">hoy</span>}
            </span>
            <span className="text-sm font-semibold text-acento-tinta">Cambiar día</span>
            <input
              type="date"
              value={dia}
              max={hoy}
              aria-label="Día del apoyo o del taxi"
              onChange={(e) => e.target.value && setDia(e.target.value as FechaISO)}
              onClick={(e) => {
                try {
                  e.currentTarget.showPicker();
                } catch {
                  /* Algunos navegadores solo lo abren con un toque directo en el campo. */
                }
              }}
              className="absolute inset-0 cursor-pointer opacity-0"
            />
          </label>
        </div>

        {flujo === "apoyo" && !corregir && (
          <div className="flex gap-2 px-4 pb-3">
            {(["hora", "tramos"] as const).map((m) => (
              <button
                key={m}
                type="button"
                aria-pressed={modoApoyo === m}
                onClick={() => setModoApoyo(m)}
                className={`min-h-9 flex-1 rounded-btn border-2 text-sm font-semibold ${
                  modoApoyo === m ? "border-acento bg-acento-suave text-acento-tinta" : "border-linea text-tinta-2"
                }`}
              >
                {m === "hora" ? "Por hora" : "Por tramos"}
              </button>
            ))}
          </div>
        )}

        {flujo === "taxi" ? (
          <FormularioTaxi
            fecha={dia}
            factorCalles={factorCalles}
            inicial={corregir?.tipo === "taxi" ? corregir : undefined}
            alGuardar={() => void alTerminar()}
          />
        ) : modoApoyo === "hora" ? (
          <FormularioApoyoHora
            fecha={dia}
            inicial={corregir?.tipo === "apoyo_hora" ? corregir : undefined}
            alGuardar={() => void alTerminar()}
          />
        ) : (
          <FormularioApoyoTramos
            fecha={dia}
            tiendas={tiendas}
            inicial={corregir?.tipo === "apoyo_tramos" ? corregir : undefined}
            alGuardar={() => void alTerminar()}
          />
        )}
      </div>
    </div>
  );
}

/**
 * Lo mismo, pero que se las arregla sola para traer las tiendas y el factor de
 * calles: para abrirla desde sitios que no tienen esos datos a mano, como la
 * hoja «Cargar» de la barra de abajo.
 */
export function HojaDeBloqueExtraAutonoma({
  tipo,
  fecha,
  corregir,
  alCerrar,
  alGuardar,
}: {
  tipo: TipoFlujo;
  fecha: FechaISO;
  corregir?: BloqueExtraFila;
  alCerrar: () => void;
  alGuardar: () => void;
}) {
  const { datos } = useDatos(async () => {
    const [tiendas, perfil] = await Promise.all([listarTiendas(), perfilActual()]);
    const principal = tiendas.find((t) => t.id === perfil?.tiendaId) ?? null;
    return { otras: tiendas.filter((t) => t.id !== principal?.id), factorCalles: principal?.factorCalles ?? 1.3 };
  }, []);

  if (!datos) return null;
  return (
    <HojaDeBloqueExtra
      tipo={tipo}
      fecha={fecha}
      tiendas={datos.otras}
      factorCalles={datos.factorCalles}
      corregir={corregir}
      alCerrar={alCerrar}
      alGuardar={alGuardar}
    />
  );
}
