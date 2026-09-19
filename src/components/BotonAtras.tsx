"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";

/**
 * El botón físico de retroceso de Android.
 *
 * Sin esto, Android hace lo suyo por defecto: si no hay historial que
 * deshacer, **cierra la aplicación**. Y como cada pantalla se abre con
 * navegación propia, era fácil acabar fuera de la app sin querer —basta con
 * abrir una hoja emergente y pulsar atrás—. Que una app se cierre sola es de
 * las cosas que peor sientan y que más desconfianza generan.
 *
 * El comportamiento correcto, y el que espera cualquiera en Android:
 *
 *   1. si hay algo abierto encima —una hoja, un menú—, se cierra eso;
 *   2. si no, se vuelve a la pantalla anterior;
 *   3. solo desde Hoy, y pulsando dos veces, se sale de verdad.
 *
 * Lo de las dos veces no es capricho: salir por accidente de una pantalla en
 * la que acabas de escribir catorce pedidos es una pérdida real.
 */
export function BotonAtras() {
  const router = useRouter();
  const ruta = usePathname();

  useEffect(() => {
    let quitar: (() => void) | undefined;
    let ultimoIntento = 0;

    (async () => {
      const { Capacitor } = await import("@capacitor/core");
      if (!Capacitor.isNativePlatform()) return;

      const { App } = await import("@capacitor/app");
      const escucha = await App.addListener("backButton", () => {
        /* Cualquier cosa abierta encima se cierra primero. Se avisa por evento
           para no tener que conocer aquí todas las hojas de la aplicación:
           cada una se encarga de la suya. */
        const abierto = document.querySelector("[data-capa-abierta]");
        if (abierto) {
          window.dispatchEvent(new CustomEvent("rutas-a:cerrar-capa"));
          return;
        }

        if (ruta !== "/") {
          router.back();
          return;
        }

        // En Hoy: dos pulsaciones seguidas para salir.
        const ahora = Date.now();
        if (ahora - ultimoIntento < 2000) {
          void App.exitApp();
          return;
        }
        ultimoIntento = ahora;
        avisar("Pulsa atrás otra vez para salir");
      });
      quitar = () => void escucha.remove();
    })();

    return () => quitar?.();
  }, [router, ruta]);

  return null;
}

/**
 * Un aviso breve, al estilo de los de Android.
 *
 * Se monta a mano y no con un estado de React porque tiene que poder salir
 * desde dentro de un manejador nativo, sin depender del árbol de componentes.
 */
function avisar(texto: string): void {
  const previo = document.getElementById("aviso-atras");
  if (previo) previo.remove();

  const caja = document.createElement("div");
  caja.id = "aviso-atras";
  caja.textContent = texto;
  caja.setAttribute("role", "status");
  caja.style.cssText = [
    "position:fixed",
    "left:50%",
    "transform:translateX(-50%)",
    "bottom:calc(24px + env(safe-area-inset-bottom, 0px))",
    "z-index:9999",
    "padding:10px 18px",
    "border-radius:999px",
    "background:rgba(20,22,26,.92)",
    "color:#fff",
    "font-size:14px",
    "pointer-events:none",
  ].join(";");
  document.body.appendChild(caja);
  setTimeout(() => caja.remove(), 2000);
}
