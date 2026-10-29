"use client";

/** Vuelve a pedir la página: si ya hay señal, la app sigue como estaba. */
export function Reintentar() {
  return (
    <button type="button" className="boton-principal w-full" onClick={() => window.location.reload()}>
      Reintentar
    </button>
  );
}
