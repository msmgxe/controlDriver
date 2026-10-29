import {
  Barras,
  Camara,
  Candado,
  Copa,
  Engranaje,
  Escudo,
  Galeria,
  Info,
  Lapiz,
  Llave,
  Subir,
  Tienda,
  Ticket,
  Trofeo,
  Estrella,
} from "@/components/iconos";

/**
 * El icono de una sección de Ajustes: una figura de color con un dibujo que
 * **se mueve de la manera que dice lo que la sección hace** —la paleta cambia
 * de color, el candado se balancea, la cámara destella—, para encontrar la
 * opción por su imagen y no solo por su título. El mismo color y dibujo
 * sirven de tarjeta en la cuadrícula de Ajustes (ver `SeccionDeAjustes`).
 */
export type ClaveDeIcono =
  | "paleta"
  | "ubicacion"
  | "comanda"
  | "adicional"
  | "candado"
  | "llave"
  | "escudo"
  | "respaldo"
  | "camara"
  | "probeta"
  | "lupa"
  | "meta"
  | "sonido"
  | "version";

type Icono = (p: React.SVGProps<SVGSVGElement>) => React.JSX.Element;

export const FIGURA_DE_SECCION: Record<ClaveDeIcono, { Icono: Icono; color: string; movimiento: string }> = {
  paleta: { Icono: Galeria, color: "var(--c-foto)", movimiento: "icono-colores" },
  ubicacion: { Icono: Tienda, color: "var(--acento)", movimiento: "icono-bota" },
  comanda: { Icono: Ticket, color: "var(--c-buscar)", movimiento: "icono-menea" },
  adicional: { Icono: Copa, color: "var(--c-adic)", movimiento: "icono-menea" },
  candado: { Icono: Candado, color: "var(--c-ajustes)", movimiento: "icono-balanceo" },
  llave: { Icono: Llave, color: "var(--c-licencia)", movimiento: "icono-balanceo" },
  escudo: { Icono: Escudo, color: "var(--c-historial)", movimiento: "icono-pulso" },
  respaldo: { Icono: Subir, color: "var(--c-apoyo)", movimiento: "icono-flota" },
  camara: { Icono: Camara, color: "var(--c-taxi)", movimiento: "icono-destello" },
  probeta: { Icono: Lapiz, color: "var(--c-mano)", movimiento: "icono-menea" },
  lupa: { Icono: Barras, color: "var(--c-stats)", movimiento: "icono-barre" },
  meta: { Icono: Trofeo, color: "var(--c-cantidad)", movimiento: "icono-pulso" },
  sonido: { Icono: Estrella, color: "var(--c-aprender)", movimiento: "icono-pulso" },
  version: { Icono: Info, color: "var(--c-licencia)", movimiento: "icono-avanza" },
};

// `Engranaje` queda disponible como figura por defecto de una sección sin icono.
export const FIGURA_POR_DEFECTO = { Icono: Engranaje as Icono, color: "var(--c-ajustes)", movimiento: "" };

export function IconoDeSeccion({ clave, className = "" }: { clave: ClaveDeIcono; className?: string }) {
  const { Icono, color, movimiento } = FIGURA_DE_SECCION[clave];
  return (
    <span aria-hidden className={`aju-fig ${className}`} style={{ "--c": color } as React.CSSProperties}>
      <span className={`grid place-items-center ${movimiento}`}>
        <Icono className="size-6" />
      </span>
    </span>
  );
}
