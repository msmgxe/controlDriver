"use client";

import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import { Candado, Huella } from "@/components/iconos";
import { PuntosDePin, TecladoPin } from "@/components/TecladoPin";
import {
  huellaConfigurada,
  instantaneaBloqueo,
  instantaneaBloqueoServidor,
  marcarAbierto,
  pedirHuella,
  suscribirBloqueo,
  verificarPin,
} from "@/lib/bloqueo";

/**
 * Pantalla de desbloqueo.
 *
 * Se muestra encima de todo cuando el dispositivo tiene PIN puesto y la app se
 * acaba de abrir. No es un factor de sesión: ver la explicación en
 * `src/lib/bloqueo.ts`.
 *
 * El estado se lee con `useSyncExternalStore` porque vive fuera de React, en el
 * almacenamiento del navegador. En servidor la instantánea es "desconocido" y
 * se pinta un hueco: así no se ve la app un instante por debajo del candado.
 */
export function BloqueoApp({ children }: { children: React.ReactNode }) {
  const estado = useSyncExternalStore(
    suscribirBloqueo,
    instantaneaBloqueo,
    instantaneaBloqueoServidor,
  );

  if (estado === "desconocido") {
    return <div aria-hidden className="min-h-dvh bg-papel" />;
  }
  if (estado === "abierto") return <>{children}</>;
  return <Candadazo />;
}

function Candadazo() {
  const [pin, setPin] = useState("");
  const [error, setError] = useState(false);
  const [comprobando, setComprobando] = useState(false);
  const [olvido, setOlvido] = useState(false);
  const conHuella = huellaConfigurada();

  useEffect(() => {
    // Si hay huella registrada se ofrece sola: es el camino de un toque.
    // `marcarAbierto` avisa al almacén y el componente de arriba se desmonta.
    if (conHuella) {
      void pedirHuella().then((ok) => {
        if (ok) marcarAbierto();
      });
    }
  }, [conHuella]);

  async function comprobar(valor: string) {
    setComprobando(true);
    const ok = await verificarPin(valor);
    setComprobando(false);
    if (ok) {
      marcarAbierto();
    } else {
      setError(true);
      setPin("");
    }
  }

  const tocar = useCallback(
    (d: string) => {
      if (comprobando || pin.length >= 4) return;
      setError(false);
      const nuevo = pin + d;
      setPin(nuevo);
      if (nuevo.length === 4) void comprobar(nuevo);
    },
    [comprobando, pin],
  );
  const borrar = useCallback(() => {
    if (comprobando) return;
    setError(false);
    setPin((p) => p.slice(0, -1));
  }, [comprobando]);

  // También responde al teclado físico.
  useEffect(() => {
    const alTeclear = (e: KeyboardEvent) => {
      if (/^\d$/.test(e.key)) tocar(e.key);
      else if (e.key === "Backspace") borrar();
    };
    window.addEventListener("keydown", alTeclear);
    return () => window.removeEventListener("keydown", alTeclear);
  }, [tocar, borrar]);

  return (
    <div className="grid min-h-dvh place-items-center bg-papel px-4 py-6">
      <div className="aju-cent w-full max-w-xs rise-v2">
        <span
          className="grid size-[72px] place-items-center rounded-3xl text-white"
          style={{ background: "var(--c-licencia)" }}
        >
          <Candado className="size-9 icono-balanceo" />
        </span>

        <div>
          <h1 className="text-2xl">Control Driver está bloqueado</h1>
          <p className="mt-1 text-sm text-tinta-2">Escribe tu PIN de 4 números</p>
        </div>

        <div key={error ? "e" : "n"} className={`w-full ${error ? "aju-sacude" : ""}`}>
          <PuntosDePin largo={pin.length} error={error} />
        </div>

        <p role="alert" className="min-h-[22px] text-sm font-bold text-mal">
          {error ? "Ese PIN no es correcto." : ""}
        </p>

        <TecladoPin
          alTocar={tocar}
          alBorrar={borrar}
          deshabilitado={comprobando}
          extra={
            conHuella ? (
              <button
                type="button"
                aria-label="Usar huella"
                className="!bg-acento !text-acento-texto"
                onClick={() => void pedirHuella().then((ok) => ok && marcarAbierto())}
              >
                <Huella className="size-7" />
              </button>
            ) : undefined
          }
        />

        <div className="flex w-full flex-col gap-2">
          {conHuella && (
            <button
              type="button"
              className="boton-sec"
              onClick={() => void pedirHuella().then((ok) => ok && marcarAbierto())}
            >
              <Huella className="size-4" />
              Usar huella
            </button>
          )}
          <button type="button" className="boton-sec" onClick={() => setOlvido((v) => !v)} aria-expanded={olvido}>
            ¿Olvidaste el PIN?
          </button>
        </div>
        {olvido && (
          <p className="rise-v2 rounded-2xl bg-aviso-suave p-3 text-left text-sm font-semibold text-aviso">
            Sin el PIN no se puede entrar. Si tienes un respaldo, puedes borrar la app, instalarla otra vez y
            restaurarlo.
          </p>
        )}
      </div>
    </div>
  );
}
