"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Candado, Huella } from "@/components/iconos";
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
  const campo = useRef<HTMLInputElement>(null);
  const conHuella = huellaConfigurada();

  useEffect(() => {
    campo.current?.focus();
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
      campo.current?.focus();
    }
  }

  function alEscribir(valor: string) {
    const limpio = valor.replace(/\D/g, "").slice(0, 4);
    setPin(limpio);
    setError(false);
    if (limpio.length === 4) void comprobar(limpio);
  }

  return (
    <div className="grid min-h-dvh place-items-center bg-papel px-4">
      <div className="flex w-full max-w-xs flex-col items-center gap-6">
        <span className="grid size-14 place-items-center rounded-full bg-acento-suave text-acento-tinta">
          <Candado className="size-7" />
        </span>

        <div className="text-center">
          <h1 className="text-2xl">RutaLog está bloqueado</h1>
          <p className="mt-1 text-sm text-tinta-2">Escribe tu PIN para continuar.</p>
        </div>

        {/* Un solo campo real; los cuatro recuadros son su reflejo visual. */}
        <div className="relative w-full">
          <input
            ref={campo}
            id="pin-desbloqueo"
            type="password"
            inputMode="numeric"
            autoComplete="off"
            aria-label="PIN de 4 dígitos"
            value={pin}
            disabled={comprobando}
            onChange={(e) => alEscribir(e.target.value)}
            className="absolute inset-0 size-full opacity-0"
          />
          <div className="pointer-events-none flex justify-center gap-3">
            {[0, 1, 2, 3].map((i) => (
              <span
                key={i}
                className={`grid h-14 w-12 place-items-center rounded-btn border bg-sup text-2xl ${
                  error ? "border-mal" : pin.length > i ? "border-acento" : "border-linea-fuerte"
                }`}
              >
                {pin.length > i ? "•" : ""}
              </span>
            ))}
          </div>
        </div>

        {error && (
          <p role="alert" className="text-sm font-semibold text-mal">
            Ese PIN no es correcto.
          </p>
        )}

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

        <p className="text-center text-xs text-tinta-3">
          ¿Olvidaste el PIN? Cierra sesión y vuelve a entrar con tu correo; podrás poner uno nuevo.
        </p>
      </div>
    </div>
  );
}
