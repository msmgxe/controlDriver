"use client";

import { createContext, useCallback, useContext, useMemo } from "react";

import { Flecha } from "@/components/iconos";
import { FIGURA_DE_SECCION, FIGURA_POR_DEFECTO, type ClaveDeIcono } from "@/components/IconoDeSeccion";
import { useCapa } from "@/hooks/useCapa";

/**
 * La cuadrícula de Ajustes: cada sección es una tarjeta de color con su estado
 * en una línea; al tocarla se abre solo su contenido, con un botón para volver.
 *
 * Las secciones siguen escribiéndose con `<Acordeon>`: si están dentro de una
 * `SeccionDeAjustes`, el acordeón se dibuja como tarjeta (cerrada) o como panel
 * (abierta). Así cada sección sigue diciendo su propio resumen sin duplicar su
 * lógica en la página.
 */
interface Valor {
  clave: string;
  abierta: string | null;
  abrir: (clave: string | null) => void;
  indice: number;
}

const Contexto = createContext<Valor | null>(null);

export function useSeccionDeAjustes(): Valor | null {
  return useContext(Contexto);
}

export function SeccionDeAjustes({
  clave,
  id,
  indice = 0,
  abierta,
  abrir,
  children,
}: {
  clave: string;
  /** Ancla (`#aj-…`) y blanco de los recorridos guiados. */
  id: string;
  indice?: number;
  abierta: string | null;
  abrir: (clave: string | null) => void;
  children: React.ReactNode;
}) {
  const valor = useMemo(() => ({ clave, abierta, abrir, indice }), [clave, abierta, abrir, indice]);
  const estado = abierta === null ? "" : abierta === clave ? "aju-celda--abierta" : "aju-celda--oculta";
  return (
    <div id={id} className={`aju-celda ${estado}`}>
      <Contexto.Provider value={valor}>{children}</Contexto.Provider>
    </div>
  );
}

export function VistaDeAjuste({
  valor,
  titulo,
  resumen,
  aviso,
  icono,
  children,
}: {
  valor: Valor;
  titulo: React.ReactNode;
  resumen?: React.ReactNode;
  aviso: boolean;
  icono?: ClaveDeIcono;
  children: React.ReactNode;
}) {
  const f = icono ? FIGURA_DE_SECCION[icono] : FIGURA_POR_DEFECTO;
  const { Icono, color } = f;
  if (valor.abierta !== valor.clave) {
    return (
      <button
        type="button"
        className="aju-tile"
        style={{ "--c": color, "--d": `${(valor.indice % 8) * 0.05}s` } as React.CSSProperties}
        onClick={() => valor.abrir(valor.clave)}
      >
        <span className="aju-tile__brillo" aria-hidden />
        <span className="aju-tile__grande" aria-hidden>
          <Icono />
        </span>
        {aviso && (
          <span className="aju-tile__aviso" aria-label="Pide atención">
            !
          </span>
        )}
        <span className="aju-tile__fig" aria-hidden>
          <Icono className="size-7" />
        </span>
        <span>
          <b className="aju-tile__tit">{titulo}</b>
          {resumen && <small className="aju-tile__est">{resumen}</small>}
        </span>
      </button>
    );
  }
  return (
    <Panel valor={valor} titulo={titulo} resumen={resumen} color={color} Icono={Icono}>
      {children}
    </Panel>
  );
}

function Panel({
  valor,
  titulo,
  resumen,
  color,
  Icono,
  children,
}: {
  valor: Valor;
  titulo: React.ReactNode;
  resumen?: React.ReactNode;
  color: string;
  Icono: (p: React.SVGProps<SVGSVGElement>) => React.JSX.Element;
  children: React.ReactNode;
}) {
  const { abrir } = valor;
  const cerrar = useCallback(() => abrir(null), [abrir]);
  // El botón «atrás» de Android vuelve a la cuadrícula en vez de salir de Ajustes.
  useCapa(cerrar);
  return (
    <section>
      <div className="aju-cab" style={{ background: color }}>
        <span className="aju-cab__fig" aria-hidden>
          <Icono className="size-7" />
        </span>
        <span className="min-w-0">
          <b>{titulo}</b>
          {resumen && <small>{resumen}</small>}
        </span>
        <button type="button" className="aju-cab__atras" onClick={cerrar}>
          <Flecha className="size-4 rotate-180" />
          Ajustes
        </button>
      </div>
      <div className="aju-pan">{children}</div>
    </section>
  );
}
