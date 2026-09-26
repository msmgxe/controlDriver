"use client";

import { useId, useState } from "react";

import { Flecha } from "@/components/iconos";

/**
 * Sección plegable.
 *
 * Nace **cerrada**, siempre: la pantalla enseña lo esencial, y el detalle se
 * abre cuando se busca. Cada acordeón dice su dato clave en el `resumen`, así
 * que muchas veces no hace falta abrirlo.
 *
 * Es un `<button>` de verdad y no un `div` con un manejador: así responde al
 * teclado, lo anuncia un lector de pantalla, y `aria-expanded` dice si está
 * abierto sin tener que verlo.
 *
 * Se puede **controlar desde fuera** (`abierto` + `alCambiar`) para los casos en
 * que otra parte de la pantalla tiene que abrirlo —«Faltan 6 días» abre el
 * detalle de los días—.
 */
export function Acordeon({
  titulo,
  resumen,
  aviso = false,
  abierto: controlado,
  alCambiar,
  children,
}: {
  titulo: React.ReactNode;
  /** Lo esencial, visible incluso plegado: evita tener que abrir para mirar. */
  resumen?: React.ReactNode;
  /** El resumen pide atención (falta algo): sale en el color de aviso. */
  aviso?: boolean;
  abierto?: boolean;
  alCambiar?: (abierto: boolean) => void;
  children: React.ReactNode;
}) {
  const [interno, setInterno] = useState(false);
  const abierto = controlado ?? interno;
  const id = useId();

  function alternar() {
    const siguiente = !abierto;
    setInterno(siguiente);
    alCambiar?.(siguiente);
  }

  return (
    <section className="acordeon">
      <button
        type="button"
        onClick={alternar}
        aria-expanded={abierto}
        aria-controls={id}
        className="flex min-h-[62px] w-full items-center justify-between gap-3 px-[var(--pad-card)] py-3 text-left"
      >
        <span className="flex min-w-0 flex-col">
          <b className="font-display text-[17px] leading-tight font-bold [zoom:var(--zoom-titulo,1)]">
            {titulo}
          </b>
          {resumen && (
            <span className={`text-[13px] leading-snug ${aviso ? "font-semibold text-aviso" : "text-tinta-3"}`}>
              {resumen}
            </span>
          )}
        </span>
        <Flecha
          className={`size-4 shrink-0 text-tinta-3 transition-transform duration-300 ${
            abierto ? "-rotate-90" : "rotate-90"
          }`}
        />
      </button>

      {/* `grid-template-rows` de 0fr a 1fr, no `hidden`: así la sección crece
          de verdad en vez de aparecer de golpe. `inert` saca el contenido
          plegado del tabulador y de lectores de pantalla sin quitarlo del DOM
          —quitarlo es lo que impedía animarlo—. */}
      <div
        className="grid transition-[grid-template-rows] duration-300 ease-in-out"
        style={{ gridTemplateRows: abierto ? "1fr" : "0fr" }}
      >
        <div id={id} className="overflow-hidden" inert={!abierto}>
          <div className="flex flex-col gap-4 border-t border-linea px-[var(--pad-card)] py-4">
            {children}
          </div>
        </div>
      </div>
    </section>
  );
}
