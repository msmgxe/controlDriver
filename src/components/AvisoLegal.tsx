"use client";

import { useState, useSyncExternalStore } from "react";

import { Acordeon } from "@/components/Acordeon";
import { DialogoConfirmar } from "@/components/DialogoConfirmar";
import { IconoApp } from "@/components/IconoApp";
import { Check } from "@/components/iconos";
import { cerrarAplicacion } from "@/components/salirDeLaApp";
import { LineaCopyright, TextoLegal } from "@/components/TextoLegal";
import { hoyEnLima } from "@/lib/fechas";
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
  const [preguntando, setPreguntando] = useState(false);

  async function salir() {
    setPreguntando(false);
    setMensaje(null);
    if ((await cerrarAplicacion()) === "no-nativo") {
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

        <div className="aju-cent">
          <svg viewBox="0 0 120 120" width="110" height="110" aria-hidden="true">
            <circle cx="60" cy="60" r="54" style={{ fill: "var(--acento-suave)" }} />
            <g className="aju-escudo">
              <path d="M60 22l30 11v22c0 20-13 32-30 38-17-6-30-18-30-38V33z" style={{ fill: "var(--acento)" }} />
              <path d="M45 58l11 11 20-22" fill="none" stroke="#fff" strokeWidth="7" strokeLinecap="round" strokeLinejoin="round" />
            </g>
          </svg>
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

        <button type="button" className="aju-check" aria-pressed={marcado} onClick={() => setMarcado((v) => !v)}>
          <span className="aju-check__caja" aria-hidden>
            <Check className="size-5" />
          </span>
          <span className="text-sm">He leído y acepto el aviso legal, incluida la protección de los datos de mis clientes.</span>
        </button>

        <div className="mt-auto flex flex-col gap-2 pt-2">
          <button
            type="button"
            className="boton-principal"
            disabled={!marcado}
            onClick={() => aceptarTerminos(hoyEnLima())}
          >
            Aceptar y continuar
          </button>
          <button type="button" onClick={() => setPreguntando(true)} className="boton-sec">
            No acepto
          </button>
          {mensaje && <p className="text-center text-xs text-tinta-3">{mensaje}</p>}
        </div>
        {preguntando && (
          <DialogoConfirmar
            titulo="¿Salir de Control Driver?"
            texto="Sin aceptar el aviso no puedes usar la app."
            confirmar="Sí, salir"
            alCancelar={() => setPreguntando(false)}
            alConfirmar={() => void salir()}
          />
        )}
      </div>
    </div>
  );
}
