"use client";

import { useEffect, useState } from "react";

import { Alerta, Check, Subir } from "@/components/iconos";

/**
 * Registro del service worker, aviso de instalación y aviso de versión nueva (§8).
 *
 * Los tres avisos son discretos a propósito: aparecen abajo, se pueden cerrar y
 * no tapan el botón de cargar capturas, que es lo único que el driver viene a
 * hacer.
 */

interface EventoInstalacion extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export function ServicioPWA() {
  const [hayVersionNueva, setHayVersionNueva] = useState(false);
  const [instalador, setInstalador] = useState<EventoInstalacion | null>(null);
  const [sinConexion, setSinConexion] = useState(false);
  const [instalarCerrado, setInstalarCerrado] = useState(false);

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    let registro: ServiceWorkerRegistration | null = null;

    void navigator.serviceWorker
      .register("/sw.js", { scope: "/" })
      .then((r) => {
        registro = r;

        // Ya había una versión nueva esperando cuando abrimos la app.
        if (r.waiting) setHayVersionNueva(true);

        r.addEventListener("updatefound", () => {
          const nuevo = r.installing;
          if (!nuevo) return;
          nuevo.addEventListener("statechange", () => {
            // `controller` distingue una actualización de la primera
            // instalación: en la primera no hay nada que avisar.
            if (nuevo.state === "installed" && navigator.serviceWorker.controller) {
              setHayVersionNueva(true);
            }
          });
        });
      })
      .catch(() => {
        // Sin service worker la app funciona igual, solo que sin modo offline.
      });

    // Cuando el worker nuevo toma el control, se recarga una sola vez.
    let recargando = false;
    const alCambiarControl = () => {
      if (recargando) return;
      recargando = true;
      window.location.reload();
    };
    navigator.serviceWorker.addEventListener("controllerchange", alCambiarControl);

    return () => {
      navigator.serviceWorker.removeEventListener("controllerchange", alCambiarControl);
      registro = null;
      void registro;
    };
  }, []);

  useEffect(() => {
    const alPoderInstalar = (e: Event) => {
      // Sin esto Chrome enseña su propio banner, que aparece donde quiere.
      e.preventDefault();
      setInstalador(e as EventoInstalacion);
    };
    const alInstalar = () => setInstalador(null);

    window.addEventListener("beforeinstallprompt", alPoderInstalar);
    window.addEventListener("appinstalled", alInstalar);
    return () => {
      window.removeEventListener("beforeinstallprompt", alPoderInstalar);
      window.removeEventListener("appinstalled", alInstalar);
    };
  }, []);

  useEffect(() => {
    const desconectado = () => setSinConexion(true);
    const conectado = () => setSinConexion(false);
    window.addEventListener("offline", desconectado);
    window.addEventListener("online", conectado);
    return () => {
      window.removeEventListener("offline", desconectado);
      window.removeEventListener("online", conectado);
    };
  }, []);

  async function actualizar() {
    const registro = await navigator.serviceWorker.getRegistration();
    // El worker nuevo está esperando; al activarse dispara controllerchange y
    // la app se recarga sola.
    registro?.waiting?.postMessage({ tipo: "ACTIVAR_ACTUALIZACION" });
    setHayVersionNueva(false);
  }

  async function instalar() {
    if (!instalador) return;
    await instalador.prompt();
    await instalador.userChoice;
    setInstalador(null);
  }

  const hayAlgo = sinConexion || hayVersionNueva || (instalador && !instalarCerrado);
  if (!hayAlgo) return null;

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-40 flex flex-col items-center gap-2 px-4 pb-[calc(1rem+env(safe-area-inset-bottom,0px))]">
      {sinConexion && (
        <div className="pointer-events-auto flex w-full max-w-md items-center gap-3 rounded-btn bg-aviso-suave px-4 py-3 text-sm text-aviso shadow-alta">
          <Alerta className="size-[18px] shrink-0" />
          <p>
            Sin conexión. Puedes consultar lo que ya viste; para cargar capturas necesitas red.
          </p>
        </div>
      )}

      {hayVersionNueva && (
        <div className="pointer-events-auto flex w-full max-w-md items-center gap-3 rounded-btn bg-acento-suave px-4 py-3 text-sm text-acento-tinta shadow-alta">
          <Check className="size-[18px] shrink-0" />
          <p className="flex-1">Hay una versión nueva de Rutas-A.</p>
          <button
            type="button"
            onClick={() => void actualizar()}
            className="min-h-9 rounded-chip bg-acento px-3 text-xs font-bold text-acento-texto"
          >
            Actualizar
          </button>
        </div>
      )}

      {instalador && !instalarCerrado && (
        <div className="pointer-events-auto flex w-full max-w-md items-center gap-3 rounded-btn bg-sup px-4 py-3 text-sm shadow-alta">
          <Subir className="size-[18px] shrink-0 text-acento" />
          <p className="flex-1">Instala Rutas-A para abrirla como una app.</p>
          <button
            type="button"
            onClick={() => void instalar()}
            className="min-h-9 rounded-chip bg-acento px-3 text-xs font-bold text-acento-texto"
          >
            Instalar
          </button>
          <button
            type="button"
            aria-label="Ahora no"
            onClick={() => setInstalarCerrado(true)}
            className="min-h-9 px-2 text-xs font-semibold text-tinta-3"
          >
            Ahora no
          </button>
        </div>
      )}
    </div>
  );
}
