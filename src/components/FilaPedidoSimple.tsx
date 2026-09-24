"use client";

/**
 * Una fila de pedido, en la forma más simple que se pudo.
 *
 *     v12238726wofp-01                        S/ 10.00
 *     [Ruta 3 · 10:03]   ✓ Entregado
 *
 * Es lo que se pidió después de probar la app: ver el código, y al lado la
 * ruta con su hora y el estado. Nada más. Tres decisiones detrás:
 *
 *   · **El estado no alarma.** Entregado, parcial o no entregado, el pedido se
 *     paga igual. Pintar de rojo un "No entregado" lo hacía parecer un error
 *     cuando no lo es; ahora va en tono neutro.
 *   · **El monto, tenue.** Está para quien lo busque, pero no compite con el
 *     código, que es lo que se revisa.
 *   · **Toda la fila se toca.** Para corregir cualquier dato o borrar el pedido.
 *
 * La ruta va en una píldora turquesa, el color del teléfono en todo el diseño.
 * Si no se leyó, la píldora es ámbar y dice que se toque para asignarla.
 *
 * Un pedido añadido "solo por cantidad" (§ agregarPedidosPorCantidad) todavía
 * no tiene código de verdad: en vez de enseñar el provisional —que no le dice
 * nada a nadie—, la fila avisa que falta completarlo. Es la misma idea que la
 * píldora ámbar de "Sin ruta", aplicada al dato que más urge de un pedido así.
 */
export function FilaPedidoSimple({
  codigo,
  ruta,
  hora,
  estado,
  tramo,
  monto,
  manual = false,
  porCompletar = false,
  onClick,
}: {
  codigo: string;
  ruta: number | null;
  hora: string | null;
  estado: string;
  tramo: number;
  monto: string;
  manual?: boolean;
  /** Nació de "anotar cuántos pedidos hice": todavía no tiene su código real. */
  porCompletar?: boolean;
  onClick?: () => void;
}) {
  const entregado = estado === "Entregado";

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!onClick}
      className={`flex w-full flex-col gap-2 border-b border-linea px-4 py-3 text-left last:border-b-0 enabled:hover:bg-sup-2 enabled:active:bg-sup-2 ${
        porCompletar ? "bg-aviso-suave/40" : ""
      }`}
    >
      <span className="flex items-baseline justify-between gap-3">
        {porCompletar ? (
          <span className="text-[15px] font-semibold text-aviso">Pedido sin código · toca para completar</span>
        ) : (
          <span className="font-mono text-[15px] font-medium tracking-tight">{codigo}</span>
        )}
        <span className="shrink-0 font-mono text-xs text-tinta-3 tabular-nums">{monto}</span>
      </span>

      <span className="flex flex-wrap items-center gap-2 text-xs">
        {ruta !== null ? (
          <span className="inline-flex items-center gap-1 rounded-chip bg-acento-suave px-2.5 py-1 font-semibold text-acento-tinta">
            Ruta {ruta}
            {hora && <span className="font-mono font-medium opacity-80">· {hora}</span>}
          </span>
        ) : (
          <span className="inline-flex items-center rounded-chip bg-aviso-suave px-2.5 py-1 font-semibold text-aviso">
            Sin ruta · toca para asignar
          </span>
        )}

        <span
          className={`inline-flex items-center gap-1 font-medium ${
            entregado ? "text-bien" : "text-tinta-2"
          }`}
        >
          <span aria-hidden>{entregado ? "✓" : "·"}</span>
          {estado}
        </span>

        {tramo > 1 && (
          <span className="rounded-chip border border-linea-fuerte px-2 py-0.5 font-mono text-tinta-2">
            T{tramo}
          </span>
        )}
        {manual && <span className="text-tinta-3">· a mano</span>}
      </span>
    </button>
  );
}
