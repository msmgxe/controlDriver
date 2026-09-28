"use client";

import { useEffect, useState } from "react";

export interface PasoDeRecorrido {
  /** El `id` del elemento real que se resalta —no una maqueta, la pantalla de verdad. */
  selector: string;
  titulo: string;
  texto: string;
  /** Por ejemplo, abrir un acordeón antes de medir dónde quedó el botón de dentro. */
  antes?: () => void;
}

/**
 * Recorrido guiado: oscurece la pantalla real y deja a la vista, un paso a la
 * vez, el botón que toca tocar —la opción «A» que se probó como prototipo
 * (`prototipo/propuestas-tutoriales.html`), aquí ya sobre la pantalla de
 * verdad en vez de una maqueta—.
 *
 * Mide con `getBoundingClientRect()` el elemento real: si el texto cambia de
 * tamaño o el botón se mueve un día, el recorrido lo sigue solo, sin
 * coordenadas a mano que se puedan desactualizar.
 *
 * Se dispara desde Tutoriales (`/tutoriales`), que navega a `/?tour=registrar`;
 * `DelDia` en la página de Inicio lo recoge y monta esto.
 */
export function RecorridoGuiado({ pasos, alTerminar }: { pasos: PasoDeRecorrido[]; alTerminar: () => void }) {
  const [i, setI] = useState(0);
  const [rect, setRect] = useState<DOMRect | null>(null);

  useEffect(() => {
    const paso = pasos[i];
    paso.antes?.();
    let vigente = true;

    // Un instante para que `antes()` —p. ej. abrir un acordeón— ya se haya
    // pintado, y para que el `scrollIntoView` suave termine antes de medir.
    const primero = setTimeout(() => {
      const el = document.querySelector(paso.selector);
      if (!el) return;
      el.scrollIntoView({ block: "center", behavior: "smooth" });
      const segundo = setTimeout(() => {
        if (vigente) setRect(el.getBoundingClientRect());
      }, 260);
      return () => clearTimeout(segundo);
    }, 60);

    return () => {
      vigente = false;
      clearTimeout(primero);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `pasos` es estable, solo importa el paso `i`.
  }, [i]);

  // Si la ventana cambia de tamaño (girar el teléfono, teclado), se recalcula.
  useEffect(() => {
    function recalcular() {
      const el = document.querySelector(pasos[i].selector);
      if (el) setRect(el.getBoundingClientRect());
    }
    window.addEventListener("resize", recalcular);
    return () => window.removeEventListener("resize", recalcular);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [i]);

  if (!rect) return null;

  const paso = pasos[i];
  const esUltimo = i === pasos.length - 1;
  const globo = ubicarGlobo(rect);

  return (
    <div className="fixed inset-0 z-[70]" role="dialog" aria-modal="true" aria-label="Recorrido guiado">
      <div
        aria-hidden
        className="fixed rounded-2xl transition-[top,left,width,height] duration-300 ease-out"
        style={{
          top: rect.top - 6,
          left: rect.left - 6,
          width: rect.width + 12,
          height: rect.height + 12,
          boxShadow: "0 0 0 9999px rgb(10 15 25 / 0.72)",
        }}
      />
      <div
        className="fixed z-10 w-[min(280px,calc(100vw-24px))] rounded-card bg-sup p-4 shadow-alta transition-[top,left] duration-300 ease-out"
        style={globo}
      >
        <button
          type="button"
          onClick={alTerminar}
          className="absolute top-3 right-3 text-xs font-semibold text-tinta-3 underline"
        >
          Saltar
        </button>
        <span className="mb-1.5 inline-flex size-6 items-center justify-center rounded-full bg-acento font-mono text-xs font-bold text-acento-texto">
          {i + 1}
        </span>
        <b className="block text-[15px]">{paso.titulo}</b>
        <p className="mt-1 text-sm text-tinta-2">{paso.texto}</p>
        <div className="mt-3 flex gap-2">
          {i > 0 && (
            <button type="button" onClick={() => setI(i - 1)} className="boton-sec !min-h-9 flex-1 !text-sm">
              Atrás
            </button>
          )}
          <button
            type="button"
            onClick={() => (esUltimo ? alTerminar() : setI(i + 1))}
            className="boton-principal !min-h-9 flex-1 !text-sm"
          >
            {esUltimo ? "Listo" : "Siguiente"}
          </button>
        </div>
      </div>
    </div>
  );
}

/** Al lado del botón resaltado, sin salirse de la pantalla. */
function ubicarGlobo(rect: DOMRect): React.CSSProperties {
  const alto = window.innerHeight;
  const ancho = window.innerWidth;
  const anchoGlobo = Math.min(280, ancho - 24);

  let top = rect.bottom + 12;
  if (top + 170 > alto) top = Math.max(12, rect.top - 178);

  const left = Math.min(Math.max(12, rect.left), ancho - anchoGlobo - 12);
  return { top, left };
}
