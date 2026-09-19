"use client";

import { useId, useState } from "react";

import { Flecha } from "@/components/iconos";

/**
 * Sección plegable.
 *
 * La pantalla de Hoy lo enseñaba todo a la vez —el día, la semana, los enlaces,
 * los avisos— y quien la abría por primera vez no sabía dónde mirar. Plegado,
 * cada cosa se ve cuando se busca.
 *
 * Es un `<button>` de verdad y no un `div` con un manejador: así responde al
 * teclado, lo anuncia un lector de pantalla, y `aria-expanded` dice si está
 * abierto sin tener que verlo.
 */
export function Acordeon({
  titulo,
  resumen,
  abiertoPorDefecto = false,
  children,
}: {
  titulo: string;
  /** Lo esencial, visible incluso plegado: evita tener que abrir para mirar. */
  resumen?: React.ReactNode;
  abiertoPorDefecto?: boolean;
  children: React.ReactNode;
}) {
  const [abierto, setAbierto] = useState(abiertoPorDefecto);
  const id = useId();

  return (
    <section className="overflow-hidden rounded-card bg-sup-2">
      <button
        type="button"
        onClick={() => setAbierto((a) => !a)}
        aria-expanded={abierto}
        aria-controls={id}
        className="flex min-h-[56px] w-full items-center justify-between gap-3 px-4 py-3 text-left"
      >
        <span className="flex min-w-0 flex-col">
          <b className="text-[15px] font-semibold">{titulo}</b>
          {resumen && <span className="truncate text-sm text-tinta-2">{resumen}</span>}
        </span>
        <Flecha
          className={`size-4 shrink-0 text-tinta-3 transition-transform ${
            abierto ? "-rotate-90" : "rotate-90"
          }`}
        />
      </button>

      <div id={id} hidden={!abierto} className="border-t border-linea px-4 py-4">
        {children}
      </div>
    </section>
  );
}
