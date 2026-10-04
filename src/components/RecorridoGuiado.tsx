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
    let intentos = 0;
    let reloj: ReturnType<typeof setTimeout>;

    /* Se busca el elemento con paciencia: la pantalla puede estar todavía leyendo
       sus datos o desplegando un acordeón. Si tras unos segundos no aparece —un
       día sin apoyo no tiene fila de apoyo—, el paso se salta en vez de quedarse
       colgado. */
    const buscar = () => {
      if (!vigente) return;
      const el = document.querySelector(paso.selector);
      if (!el) {
        if (++intentos < 25) reloj = setTimeout(buscar, 150);
        else if (i < pasos.length - 1) setI(i + 1);
        else alTerminar();
        return;
      }
      el.scrollIntoView({ block: "center", behavior: "smooth" });
      // Se mide dos veces: el desplazamiento suave y un acordeón que se despliega siguen moviendo el elemento un rato.
      reloj = setTimeout(() => {
        if (!vigente) return;
        setRect(el.getBoundingClientRect());
        reloj = setTimeout(() => {
          if (vigente) setRect(el.getBoundingClientRect());
        }, 500);
      }, 450);
    };
    reloj = setTimeout(buscar, 80);

    return () => {
      vigente = false;
      clearTimeout(reloj);
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
  const globo = ubicarGlobo(rect, paso.texto.length);

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

/**
 * Al lado del elemento resaltado, sin salirse de la pantalla ni quedar bajo la
 * barra de abajo. La altura de la burbuja se estima por el largo del texto.
 */
function ubicarGlobo(rect: DOMRect, largoDelTexto: number): React.CSSProperties {
  const alto = window.innerHeight;
  const ancho = window.innerWidth;
  const anchoGlobo = Math.min(280, ancho - 24);
  const altoGlobo = 128 + Math.ceil(largoDelTexto / 34) * 20;
  const barraDeAbajo = 84; // la navegación fija de la app
  const libre = alto - barraDeAbajo;
  const left = Math.min(Math.max(12, rect.left), ancho - anchoGlobo - 12);

  // Debajo del elemento, si cabe.
  if (rect.bottom + 12 + altoGlobo <= libre) return { top: rect.bottom + 12, left };
  // Encima, si cabe.
  if (rect.top - 12 - altoGlobo >= 12) return { top: rect.top - 12 - altoGlobo, left };
  // Un elemento casi tan alto como la pantalla (un acordeón abierto): abajo, sobre él.
  return { top: Math.max(12, libre - altoGlobo), left: Math.max(12, (ancho - anchoGlobo) / 2) };
}
