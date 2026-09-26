"use client";

/**
 * Pestañas: cambiar de vista dentro de una misma pantalla sin cargarla.
 *
 * Es la forma de meter varias cosas en poco espacio: en vez de una columna
 * larga, una sola vista a la vez y un toque para cambiar. Se usa dentro de los
 * acordeones («Pedidos | Rutas») y en las hojas («Pedido | Cliente |
 * Distancia | Evidencia»).
 *
 * Son botones de verdad con `role="tab"`: responden al teclado y un lector de
 * pantalla dice cuál está activa. Un punto junto a la etiqueta avisa que hay
 * algo guardado ahí sin tener que abrirla; un número, cuántos hay.
 */
export interface Pestana {
  id: string;
  etiqueta: string;
  /** Cuántos elementos tiene, si tiene sentido contarlos. */
  cuenta?: number;
  /** Hay algo guardado en esta pestaña. */
  punto?: boolean;
}

export function Pestanas({
  items,
  actual,
  alCambiar,
  etiqueta,
}: {
  items: readonly Pestana[];
  actual: string;
  alCambiar: (id: string) => void;
  /** Para el lector de pantalla: qué se está cambiando. */
  etiqueta: string;
}) {
  return (
    <div
      role="tablist"
      aria-label={etiqueta}
      className="grid grid-flow-col auto-cols-fr gap-1 rounded-btn bg-sup-2 p-1"
    >
      {items.map((p) => {
        const activa = p.id === actual;
        return (
          <button
            key={p.id}
            type="button"
            role="tab"
            aria-selected={activa}
            onClick={() => alCambiar(p.id)}
            className={`flex min-h-10 min-w-0 items-center justify-center gap-1.5 rounded-[calc(var(--r-btn)-3px)] px-1 text-[13.5px] ${
              activa
                ? "bg-sup font-bold text-tinta shadow-[var(--sombra-tab)]"
                : "font-semibold text-tinta-2"
            }`}
          >
            <span className="truncate">{p.etiqueta}</span>
            {p.cuenta !== undefined && (
              <span className="rounded-chip bg-acento-suave px-1.5 font-mono text-[11px] leading-5 text-acento-tinta">
                {p.cuenta}
              </span>
            )}
            {p.punto && <i aria-hidden className="size-1.5 shrink-0 rounded-full bg-acento" />}
          </button>
        );
      })}
    </div>
  );
}
