import type { CSSProperties, ReactNode } from "react";

import {
  Barras,
  Buscar,
  Cantidad,
  Cartera,
  Copa,
  Engranaje,
  Flecha,
  Galeria,
  Historial,
  Lapiz,
  Llave,
  Reloj,
  Taxi,
  Tienda,
  Tutorial,
  Ticket,
} from "@/components/iconos";

/**
 * El lenguaje de color de la v2.0: **una acción = un color + una figura**.
 *
 * Los colores viven en `globals.css` (`--c-comanda`, `--c-adic`…) y cambian de
 * tono según la cara; aquí solo se elige cuál va con qué acción. Los
 * componentes de abajo son las tres formas de enseñarla:
 *
 *   · `TileDeAccion`  — un cuadro grande de color, para elegir entre varias;
 *   · `FilaDeColor`   — una fila con la figura a la izquierda, para listas;
 *   · `FiguraDeAccion`— solo la figurita, para cabeceras y acordeones.
 *
 * Todo lo que se toca es un botón de verdad, nunca un enlace subrayado.
 */

export type ClaveDeAccion =
  | "comanda"
  | "cantidad"
  | "mano"
  | "foto"
  | "adicional"
  | "taxi"
  | "apoyo"
  | "tienda"
  | "pagos"
  | "stats"
  | "buscar"
  | "historial"
  | "ajustes"
  | "aprender"
  | "licencia";

type Icono = (p: React.SVGProps<SVGSVGElement>) => React.JSX.Element;

export const ACCION: Record<ClaveDeAccion, { nombre: string; color: string; Icono: Icono; claro?: boolean }> = {
  comanda: { nombre: "Leer una comanda", color: "var(--c-comanda)", Icono: Ticket },
  cantidad: { nombre: "Cuántos hice", color: "var(--c-cantidad)", Icono: Cantidad },
  mano: { nombre: "A mano", color: "var(--c-mano)", Icono: Lapiz },
  foto: { nombre: "Lista de fotos", color: "var(--c-foto)", Icono: Galeria },
  adicional: { nombre: "Adicional", color: "var(--c-adic)", Icono: Copa },
  taxi: { nombre: "Taxi", color: "var(--c-taxi)", Icono: Taxi, claro: true },
  apoyo: { nombre: "Apoyo a otra tienda", color: "var(--c-apoyo)", Icono: Reloj },
  tienda: { nombre: "Pedidos de mi tienda", color: "var(--acento)", Icono: Tienda },
  pagos: { nombre: "Pagos", color: "var(--c-pagos)", Icono: Cartera },
  stats: { nombre: "Estadísticas", color: "var(--c-stats)", Icono: Barras },
  buscar: { nombre: "Buscar", color: "var(--c-buscar)", Icono: Buscar },
  historial: { nombre: "Historial", color: "var(--c-historial)", Icono: Historial },
  ajustes: { nombre: "Ajustes", color: "var(--c-ajustes)", Icono: Engranaje },
  aprender: { nombre: "Tutoriales", color: "var(--c-aprender)", Icono: Tutorial },
  licencia: { nombre: "Licencia", color: "var(--c-licencia)", Icono: Llave },
};

const estiloDe = (k: ClaveDeAccion, colorPropio?: string): CSSProperties =>
  ({ "--c": colorPropio ?? ACCION[k].color, "--c-texto": ACCION[k].claro ? "var(--sol-tinta, #0a2260)" : "#fff" }) as CSSProperties;

/** Solo la figura: el cuadrito de color con su icono. */
export function FiguraDeAccion({ k, className = "" }: { k: ClaveDeAccion; className?: string }) {
  const { Icono } = ACCION[k];
  return (
    <span className={`fig-color ${className}`} style={estiloDe(k)} aria-hidden>
      <Icono className="size-6" />
    </span>
  );
}

/** Un cuadro grande de color para elegir entre varias acciones. */
export function TileDeAccion({
  k,
  titulo,
  detalle,
  seleccionado,
  onClick,
  disabled,
  id,
}: {
  k: ClaveDeAccion;
  titulo?: string;
  detalle?: string;
  seleccionado?: boolean;
  onClick?: () => void;
  disabled?: boolean;
  id?: string;
}) {
  const { nombre, Icono } = ACCION[k];
  return (
    <button
      id={id}
      type="button"
      className="tile-accion"
      style={estiloDe(k)}
      aria-pressed={seleccionado}
      onClick={onClick}
      disabled={disabled}
    >
      <span className="tile-accion__brillo" aria-hidden />
      <span className="tile-accion__fig">
        <Icono className="size-7" />
      </span>
      <span>
        <b className="tile-accion__titulo">{titulo ?? nombre}</b>
        {detalle && <small className="tile-accion__detalle">{detalle}</small>}
      </span>
    </button>
  );
}

/** Una fila con la figura de color a la izquierda: para listas de opciones. */
export function FilaDeColor({
  k,
  titulo,
  detalle,
  derecha,
  onClick,
  disabled,
  children,
}: {
  k: ClaveDeAccion;
  titulo?: string;
  detalle?: ReactNode;
  derecha?: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  children?: ReactNode;
}) {
  return (
    <button type="button" className="fila-color" onClick={onClick} disabled={disabled}>
      <FiguraDeAccion k={k} />
      <span className="min-w-0 text-left">
        <b className="block leading-tight">{titulo ?? ACCION[k].nombre}</b>
        {detalle && <small className="block text-tinta-2">{detalle}</small>}
        {children}
      </span>
      {derecha ? <span className="fila-color__der">{derecha}</span> : <Flecha className="ml-auto size-[18px] text-tinta-3" />}
    </button>
  );
}

/** Un botón ancho del color de su acción (el botón principal de una hoja). */
export function BotonDeAccion({
  k,
  children,
  onClick,
  disabled,
  type = "button",
  className = "",
}: {
  k: ClaveDeAccion;
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  type?: "button" | "submit";
  className?: string;
}) {
  return (
    <button type={type} className={`boton-accion ${className}`} style={estiloDe(k)} onClick={onClick} disabled={disabled}>
      {children}
    </button>
  );
}
