"use client";

import { useState, type CSSProperties, type ReactNode } from "react";

import { ACCION, FiguraDeAccion, type ClaveDeAccion } from "@/components/Acciones";
import { Flecha } from "@/components/iconos";

/**
 * Piezas comunes de los formularios de anotar (2.0): el marco del color de la
 * acción, el stepper grande, los chips, el estado en tres botones y la
 * confirmación en línea de dos pasos. Todo respeta `--toque` y los tokens.
 */

const colorDe = (k: ClaveDeAccion) =>
  ({ "--c": ACCION[k].color, "--c-texto": ACCION[k].claro ? "var(--sol-tinta, #0a2260)" : "#fff" }) as CSSProperties;

/** El formulario abierto: borde del color de su acción y su figura arriba. */
export function FormularioDeAccion({
  k,
  titulo,
  detalle,
  children,
}: {
  k: ClaveDeAccion;
  titulo: string;
  detalle?: string;
  children: ReactNode;
}) {
  return (
    <div className="reg-form" style={colorDe(k)}>
      <div className="reg-form__cab">
        <FiguraDeAccion k={k} />
        <div className="min-w-0">
          <h4>{titulo}</h4>
          {detalle && <small>{detalle}</small>}
        </div>
      </div>
      {children}
    </div>
  );
}

/** «‹ Otras formas de anotar»: el camino de vuelta, como botón. */
export function BotonOtrasFormas({ texto, alVolver }: { texto: string; alVolver: () => void }) {
  return (
    <button type="button" onClick={alVolver} className="reg-atras">
      <Flecha className="size-5 rotate-180" />
      {texto}
    </button>
  );
}

/** Número grande con − y +. */
export function Stepper({
  k,
  valor,
  min = 0,
  max = 99,
  alCambiar,
  etiqueta,
}: {
  k: ClaveDeAccion;
  valor: number;
  min?: number;
  max?: number;
  alCambiar: (n: number) => void;
  etiqueta: string;
}) {
  return (
    <div className="reg-step" style={colorDe(k)} role="group" aria-label={etiqueta}>
      <button type="button" aria-label="Uno menos" disabled={valor <= min} onClick={() => alCambiar(Math.max(min, valor - 1))}>
        −
      </button>
      <output key={valor} aria-live="polite">
        {valor}
      </output>
      <button type="button" aria-label="Uno más" disabled={valor >= max} onClick={() => alCambiar(Math.min(max, valor + 1))}>
        +
      </button>
    </div>
  );
}

/** Chip de elección (ruta, día, tramo). */
export function Chip({
  k,
  activo,
  onClick,
  children,
}: {
  k: ClaveDeAccion;
  activo: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button type="button" className="reg-chip" style={colorDe(k)} aria-pressed={activo} onClick={onClick}>
      {children}
    </button>
  );
}

/** Las rutas del día como chips; «Sin ruta» siempre primero. */
export function ChipsDeRuta({
  k,
  rutas,
  valor,
  alCambiar,
}: {
  k: ClaveDeAccion;
  rutas: number[];
  valor: string;
  alCambiar: (v: string) => void;
}) {
  return (
    <div className="reg-chips">
      <Chip k={k} activo={valor === ""} onClick={() => alCambiar("")}>
        Sin ruta
      </Chip>
      {rutas.map((n) => (
        <Chip key={n} k={k} activo={valor === String(n)} onClick={() => alCambiar(String(n))}>
          Ruta {n}
        </Chip>
      ))}
    </div>
  );
}

/** Entregado verde, parcial naranja, no entregado gris. */
export function EstadoEnTres({
  valor,
  alCambiar,
  estados = ["Entregado", "Entrega parcial", "No entregado"],
}: {
  valor: string;
  alCambiar: (v: string) => void;
  estados?: readonly string[];
}) {
  return (
    <div className="reg-estado" role="group" aria-label="Estado del pedido">
      {estados.map((e) => (
        <button key={e} type="button" data-e={e} aria-pressed={valor === e} onClick={() => alCambiar(e)}>
          {e}
        </button>
      ))}
    </div>
  );
}

/** Confirmación en línea de dos pasos: nombra lo que se borra y su consecuencia. */
export function ConfirmacionEnLinea({
  texto,
  confirmar,
  cancelar = "Cancelar",
  ocupado = false,
  alConfirmar,
  alCancelar,
}: {
  texto: string;
  confirmar: string;
  cancelar?: string;
  ocupado?: boolean;
  alConfirmar: () => void;
  alCancelar: () => void;
}) {
  return (
    <div className="reg-confirma" role="alertdialog" aria-label={texto}>
      <p>{texto}</p>
      <div className="reg-confirma__bot">
        <button type="button" className="boton-sec" disabled={ocupado} onClick={alCancelar}>
          {cancelar}
        </button>
        <button type="button" className="reg-rojo" disabled={ocupado} onClick={alConfirmar}>
          {confirmar}
        </button>
      </div>
    </div>
  );
}

/** Acordeón con la cabecera del color de su acción (Revisión). Nace cerrado. */
export function AcordeonDeColor({
  k,
  titulo,
  resumen,
  aviso = false,
  children,
}: {
  k: ClaveDeAccion;
  titulo: string;
  resumen?: ReactNode;
  aviso?: boolean;
  children: ReactNode;
}) {
  const [abierto, setAbierto] = useState(false);
  const { Icono } = ACCION[k];
  return (
    <section className="reg-acc" style={colorDe(k)}>
      <button type="button" className="reg-acc__cab w-full text-left" aria-expanded={abierto} onClick={() => setAbierto((v) => !v)}>
        <span className="tile-accion__fig !size-10" aria-hidden>
          <Icono className="size-6" />
        </span>
        <span className="flex min-w-0 flex-1 flex-col">
          <b className="font-display text-base leading-tight">{titulo}</b>
          {resumen && <small className={`text-[13px] leading-snug ${aviso ? "font-bold underline decoration-2" : "opacity-90"}`}>{resumen}</small>}
        </span>
        <Flecha className={`size-5 shrink-0 transition-transform duration-300 ${abierto ? "-rotate-90" : "rotate-90"}`} />
      </button>
      {abierto && <div className="reg-acc__cuerpo rise-v2">{children}</div>}
    </section>
  );
}
