"use client";

import { useEffect, useState } from "react";

/**
 * Recoge los errores que se escapan de todo lo demás.
 *
 * Las fronteras de error de React solo atrapan lo que falla **al pintar**. Un
 * error dentro de algo asíncrono —un botón que lee la base, una promesa que
 * nadie espera— se pierde en silencio, y lo que ve el usuario es un botón que
 * no hace nada o una pantalla que no avanza. Esto lo convierte en un aviso
 * visible, con el detalle, y no toca nada más.
 */
export function RedDeSeguridad() {
  const [mensaje, setMensaje] = useState<string | null>(null);

  useEffect(() => {
    const porPromesa = (e: PromiseRejectionEvent) => {
      const r = e.reason;
      setMensaje(r instanceof Error ? r.message : String(r));
    };
    const porError = (e: ErrorEvent) => setMensaje(e.message);

    window.addEventListener("unhandledrejection", porPromesa);
    window.addEventListener("error", porError);
    return () => {
      window.removeEventListener("unhandledrejection", porPromesa);
      window.removeEventListener("error", porError);
    };
  }, []);

  if (!mensaje) return null;

  return (
    <div
      role="alert"
      className="fixed inset-x-3 z-[60] flex items-start gap-3 rounded-card bg-tinta px-4 py-3 text-sm text-papel shadow-alta"
      style={{ bottom: "calc(16px + env(safe-area-inset-bottom, 0px))" }}
    >
      <p className="flex-1">
        <b className="block">Algo no salió bien, pero tus datos están a salvo.</b>
        <span className="font-mono text-xs opacity-80">{mensaje}</span>
      </p>
      <button
        type="button"
        onClick={() => setMensaje(null)}
        className="min-h-11 shrink-0 rounded-btn px-3 font-semibold"
      >
        Cerrar
      </button>
    </div>
  );
}
