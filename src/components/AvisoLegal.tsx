"use client";

import { useState, useSyncExternalStore } from "react";

import { Acordeon } from "@/components/Acordeon";
import { IconoApp } from "@/components/IconoApp";
import { Check } from "@/components/iconos";
import { LineaCopyright, TextoLegal } from "@/components/TextoLegal";
import { hoyEnLima } from "@/lib/fechas";
import { intentarSalir } from "@/lib/salir";
import {
  aceptarTerminos,
  instantaneaTerminos,
  instantaneaTerminosServidor,
  suscribirTerminos,
} from "@/lib/terminos";

/**
 * La puerta de entrada: sin aceptar el aviso legal, no se ve el resto de la
 * app. Se monta en el layout raíz, después de `SplashDeMarca` y antes de
 * `BloqueoApp` —primero la marca, luego el aviso, y recién ahí el PIN—.
 *
 * Igual que `BloqueoApp`, mientras el estado es "desconocido" (antes de
 * hidratar) no pinta nada: ni la puerta ni la app, para no arriesgar un
 * fogonazo de una sobre la otra.
 */
export function AvisoLegal({ children }: { children: React.ReactNode }) {
  const estado = useSyncExternalStore(suscribirTerminos, instantaneaTerminos, instantaneaTerminosServidor);

  if (estado === "desconocido") return null;
  if (estado === "aceptados") return <>{children}</>;
  return <Puerta />;
}

function Puerta() {
  const [marcado, setMarcado] = useState(false);
  const [mensaje, setMensaje] = useState<string | null>(null);

  async function noAcepto() {
    setMensaje(null);
    const r = await intentarSalir("Sin aceptar no puedes usar Control Driver. ¿Seguro que quieres salir?");
    if (!r.ok && r.motivo === "no-nativo") {
      setMensaje("Sin aceptar no puedes usar la app. Esto solo cierra la aplicación instalada, no esta pestaña.");
    }
  }

  return (
    <div className="fixed inset-0 z-[90] flex flex-col overflow-y-auto bg-papel px-5 pt-[calc(20px+env(safe-area-inset-top,0px))] pb-[calc(20px+env(safe-area-inset-bottom,0px))]">
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col gap-4">
        <div className="flex items-center gap-2.5">
          <IconoApp className="size-9 shrink-0" />
          <b className="font-display text-lg font-bold">Control Driver</b>
        </div>

        <div className="flex flex-col gap-2">
          <h1 className="font-display text-[26px] leading-tight font-bold [zoom:var(--zoom-titulo,1)]">
            Antes de empezar
          </h1>
          <p className="text-sm text-tinta-2">
            Un momento antes de usarla: quién la hizo, y qué se compromete a hacer y a no hacer con los datos de
            tus clientes.
          </p>
          <LineaCopyright className="text-xs text-tinta-3" />
        </div>

        <Acordeon titulo="Aviso legal y protección de datos de tus clientes">
          <TextoLegal />
        </Acordeon>

        <label className="flex items-start gap-3 rounded-card bg-sup-2 p-3">
          <input
            type="checkbox"
            checked={marcado}
            onChange={(e) => setMarcado(e.target.checked)}
            className="sr-only"
          />
          <span
            aria-hidden
            className={`mt-0.5 grid size-[22px] shrink-0 place-items-center rounded-[6px] border-2 transition-colors ${
              marcado ? "border-acento bg-acento" : "border-linea-fuerte bg-sup"
            }`}
          >
            {marcado && <Check className="size-3.5 text-acento-texto" />}
          </span>
          <span className="text-sm text-tinta-2">
            He leído y acepto las condiciones de uso, incluida la protección de los datos de mis clientes.
          </span>
        </label>

        <div className="mt-auto flex flex-col gap-2 pt-2">
          <button
            type="button"
            className="boton-principal"
            disabled={!marcado}
            onClick={() => aceptarTerminos(hoyEnLima())}
          >
            Aceptar y continuar
          </button>
          <button
            type="button"
            onClick={() => void noAcepto()}
            className="min-h-11 text-sm font-semibold text-tinta-2 underline"
          >
            No acepto
          </button>
          {mensaje && <p className="text-center text-xs text-tinta-3">{mensaje}</p>}
        </div>
      </div>
    </div>
  );
}
