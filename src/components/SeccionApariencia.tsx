"use client";

import { useApariencia } from "@/components/Apariencia";
import { Check } from "@/components/iconos";
import type { Preferencia } from "@/lib/apariencia";

/**
 * Elegir la cara de la app: **Mapa**, **Asfalto**, **Turbo** o **Menta** —las
 * cuatro propuestas de diseño—, o dejar que el teléfono decida entre las dos
 * primeras.
 *
 * Cada opción enseña **cómo se ve**, con los colores reales de esa cara y no
 * con los de la que esté activa: por eso las vistas previas llevan sus colores
 * a fuego y no usan los tokens.
 */

interface Opcion {
  valor: Preferencia;
  nombre: string;
  detalle: string;
  vista: React.ReactNode;
}

interface Paleta {
  fondo: string;
  tarjeta: string;
  acento: string;
  senal: string;
  tinta: string;
}

const CLARO: Paleta = { fondo: "#e6eef8", tarjeta: "#ffffff", acento: "#1f5cff", senal: "#ffc800", tinta: "#0a2260" };
const OSCURO: Paleta = { fondo: "#0e1116", tarjeta: "#161b22", acento: "#ff9f1c", senal: "#5cc8ff", tinta: "#eef1f5" };
const TURBO: Paleta = { fondo: "#f3efff", tarjeta: "#ffffff", acento: "#6a4cf5", senal: "#ffd23f", tinta: "#1d1246" };
const MENTA: Paleta = { fondo: "#eef4f2", tarjeta: "#ffffff", acento: "#0b857b", senal: "#ff7a5c", tinta: "#0c1a18" };

/**
 * `duro`: Turbo lleva bordes gruesos y sombra dura en toda la app —incluida
 * esta vista previa—, para que la elección no sorprenda a nadie.
 */
function Vista({ c, duro = false }: { c: Paleta; duro?: boolean }) {
  return (
    <span
      aria-hidden
      className="relative block h-14 w-full overflow-hidden rounded-[10px]"
      style={{ background: c.fondo }}
    >
      <span className="absolute inset-x-2 top-2 h-2 rounded-full" style={{ background: c.tinta, opacity: 0.85, width: "38%" }} />
      <span
        className="absolute inset-x-2 top-6 h-6 rounded-md"
        style={{
          background: c.tarjeta,
          boxShadow: duro ? `2px 2px 0 ${c.tinta}` : undefined,
          border: duro ? `1.5px solid ${c.tinta}` : undefined,
        }}
      />
      <span className="absolute bottom-2 left-3 h-2 rounded-full" style={{ background: c.acento, width: "34%" }} />
      <span className="absolute right-3 bottom-2 size-2 rounded-full" style={{ background: c.senal }} />
    </span>
  );
}

const TEMAS: Opcion[] = [
  { valor: "claro", nombre: "Mapa", detalle: "Claro", vista: <Vista c={CLARO} /> },
  { valor: "oscuro", nombre: "Asfalto", detalle: "Oscuro", vista: <Vista c={OSCURO} /> },
  { valor: "turbo", nombre: "Turbo", detalle: "Violeta y bordes gruesos", vista: <Vista c={TURBO} duro /> },
  { valor: "menta", nombre: "Menta", detalle: "El verde de siempre", vista: <Vista c={MENTA} /> },
];

export function SeccionApariencia() {
  const { preferencia, cambiar } = useApariencia();

  return (
    <section className="tarjeta flex flex-col gap-4" aria-labelledby="titulo-apariencia">
      <div>
        <h3 id="titulo-apariencia" className="text-lg">
          Apariencia
        </h3>
        <p className="text-sm text-tinta-2">
          Cuatro caras para elegir la que más te guste. Mapa y Asfalto son pareja de día y de
          noche; Turbo y Menta se quedan fijas hasta que elijas otra.
        </p>
      </div>

      <div role="radiogroup" aria-labelledby="titulo-apariencia" className="flex flex-col gap-2">
        {/* Automático, aparte y ancho: no es una quinta cara, es "que decida el
            teléfono entre Mapa y Asfalto", y merece leerse distinto. */}
        <button
          type="button"
          role="radio"
          aria-checked={preferencia === "auto"}
          onClick={() => cambiar("auto")}
          className={`flex items-center gap-3 rounded-btn border-2 p-2.5 text-left ${
            preferencia === "auto" ? "border-acento bg-acento-suave" : "border-linea bg-sup hover:bg-sup-2"
          }`}
        >
          <span aria-hidden className="relative block h-10 w-14 shrink-0 overflow-hidden rounded-[8px]">
            <span className="absolute inset-0" style={{ background: CLARO.fondo, clipPath: "polygon(0 0, 100% 0, 0 100%)" }} />
            <span className="absolute inset-0" style={{ background: OSCURO.fondo, clipPath: "polygon(100% 0, 100% 100%, 0 100%)" }} />
            <span className="absolute top-1.5 left-1.5 h-1.5 w-[26%] rounded-full" style={{ background: CLARO.acento }} />
            <span className="absolute right-1.5 bottom-1.5 h-1.5 w-[26%] rounded-full" style={{ background: OSCURO.acento }} />
          </span>
          <span className="flex min-w-0 flex-1 items-center justify-between gap-2">
            <span className="flex min-w-0 flex-col">
              <b className="text-sm font-semibold">Automático</b>
              <span className="text-xs text-tinta-2">Sigue al teléfono: Mapa de día, Asfalto de noche</span>
            </span>
            {preferencia === "auto" && <Check className="size-4 shrink-0 text-acento-tinta" />}
          </span>
        </button>

        <div className="grid grid-cols-2 gap-2">
          {TEMAS.map((o) => {
            const elegida = preferencia === o.valor;
            return (
              <button
                key={o.valor}
                type="button"
                role="radio"
                aria-checked={elegida}
                onClick={() => cambiar(o.valor)}
                className={`flex min-w-0 flex-col gap-2 rounded-btn border-2 p-2 text-left ${
                  elegida ? "border-acento bg-acento-suave" : "border-linea bg-sup hover:bg-sup-2"
                }`}
              >
                {o.vista}
                <span className="flex items-start justify-between gap-1 px-0.5">
                  <span className="flex min-w-0 flex-col">
                    <b className="truncate text-[13px] font-semibold">{o.nombre}</b>
                    <span className="truncate text-[11px] text-tinta-2">{o.detalle}</span>
                  </span>
                  {elegida && <Check className="mt-0.5 size-4 shrink-0 text-acento-tinta" />}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}
