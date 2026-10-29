"use client";

import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";

import { ACCION, FiguraDeAccion, type ClaveDeAccion } from "@/components/Acciones";
import { Flecha } from "@/components/iconos";

/**
 * Las piezas de color de Pagos, Estadísticas, Historial y Buscar (v2.0):
 * pestañas grandes, chips, botones y flechas. Todo lo que se toca es un botón
 * con su color de acción —nunca un texto subrayado— y respeta los «toques».
 */

const estilo = (k: ClaveDeAccion): CSSProperties =>
  ({ "--c": ACCION[k].color, "--c-texto": ACCION[k].claro ? "var(--sol-tinta, #0a2260)" : "#fff" }) as CSSProperties;

export interface PestanaDeColor {
  id: string;
  etiqueta: string;
  k: ClaveDeAccion;
  cuenta?: number;
}

/** Pestañas grandes: la activa se rellena de su color. */
export function PestanasDeColor({
  items,
  actual,
  alCambiar,
  etiqueta,
}: {
  items: readonly PestanaDeColor[];
  actual: string;
  alCambiar: (id: string) => void;
  etiqueta: string;
}) {
  return (
    <div role="tablist" aria-label={etiqueta} className="pag-pestanas">
      {items.map((p) => (
        <button
          key={p.id}
          type="button"
          role="tab"
          aria-selected={p.id === actual}
          onClick={() => alCambiar(p.id)}
          className="pag-pestana"
          style={estilo(p.k)}
        >
          <span className="truncate">{p.etiqueta}</span>
          {p.cuenta !== undefined && <span className="pag-pestana__n">{p.cuenta}</span>}
        </button>
      ))}
    </div>
  );
}

/** Un chip de color que se enciende o se apaga (`aria-pressed`). */
export function ChipDeColor({
  k,
  activo,
  onClick,
  children,
  disabled,
}: {
  k: ClaveDeAccion;
  activo: boolean;
  onClick: () => void;
  children: ReactNode;
  disabled?: boolean;
}) {
  return (
    <button type="button" className="pag-chip" style={estilo(k)} aria-pressed={activo} onClick={onClick} disabled={disabled}>
      {children}
    </button>
  );
}

/** Un botón del color de su acción; con `href` navega, como un botón. */
export function BotonPag({
  k,
  children,
  onClick,
  href,
  type = "button",
  disabled,
  ancho,
  grande,
  contorno,
  rojo,
  className = "",
  ariaLabel,
}: {
  k: ClaveDeAccion;
  children: ReactNode;
  onClick?: () => void;
  href?: string;
  type?: "button" | "submit";
  disabled?: boolean;
  ancho?: boolean;
  grande?: boolean;
  contorno?: boolean;
  rojo?: boolean;
  className?: string;
  ariaLabel?: string;
}) {
  const clases = `pag-btn ${ancho ? "pag-btn--ancho" : ""} ${grande ? "pag-btn--grande" : ""} ${contorno ? "pag-btn--contorno" : ""} ${rojo ? "pag-btn--rojo" : ""} ${className}`;
  if (href) {
    return (
      <Link href={href} className={clases} style={estilo(k)} aria-label={ariaLabel}>
        {children}
      </Link>
    );
  }
  return (
    <button type={type} className={clases} style={estilo(k)} onClick={onClick} disabled={disabled} aria-label={ariaLabel}>
      {children}
    </button>
  );
}

/** La flecha-botón de «anterior» / «siguiente». */
export function FlechaBoton({
  atras,
  etiqueta,
  onClick,
  disabled,
  k = "stats",
}: {
  atras?: boolean;
  etiqueta: string;
  onClick: () => void;
  disabled?: boolean;
  k?: ClaveDeAccion;
}) {
  return (
    <button type="button" className="pag-flecha" style={estilo(k)} aria-label={etiqueta} onClick={onClick} disabled={disabled}>
      <Flecha className={`size-5 ${atras ? "rotate-180" : ""}`} />
    </button>
  );
}

/** El título de un acordeón con su figura de color delante. */
export function TituloConFigura({ k, children }: { k: ClaveDeAccion; children: ReactNode }) {
  return (
    <span className="pag-tit">
      <FiguraDeAccion k={k} />
      <span className="min-w-0">{children}</span>
    </span>
  );
}
