"use client";

import { Camara, Usuario } from "@/components/iconos";

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
  km = null,
  cliente = null,
  conFoto = false,
  contado,
  alContar,
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
  /** La distancia a la tienda, si se conoce. */
  km?: number | null;
  /** El nombre del cliente, si se guardó. */
  cliente?: string | null;
  /** Tiene la foto de su comanda como evidencia. */
  conFoto?: boolean;
  /** Si se pasa `alContar`, la fila lleva una casilla: ¿la empresa lo contó en su reporte? */
  contado?: boolean;
  alContar?: (contado: boolean) => void;
  onClick?: () => void;
}) {
  const entregado = estado === "Entregado";

  const fila = (
    <button
      type="button"
      onClick={onClick}
      disabled={!onClick}
      className={`flex w-full min-w-0 flex-1 flex-col gap-2 py-3 text-left enabled:hover:bg-sup-2 enabled:active:bg-sup-2 ${
        alContar ? "pr-4 pl-1" : "px-4"
      } ${alContar ? "" : "border-b border-linea last:border-b-0"} ${porCompletar ? "bg-aviso-suave/40" : ""}`}
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
            {tramo === 6 ? "+12 km" : `T${tramo}`}
          </span>
        )}
        {km !== null && <span className="font-mono text-tinta-2">{km.toFixed(1)} km</span>}
        {manual && <span className="text-tinta-3">· a mano</span>}

        {/* Lo que tiene guardado, sin abrir: el cliente y la foto de su comanda. */}
        {(cliente || conFoto) && (
          <span className="ml-auto flex min-w-0 items-center gap-2 text-tinta-3">
            {cliente && (
              <span className="flex min-w-0 items-center gap-1">
                <Usuario className="size-3.5 shrink-0" aria-label="Con cliente" />
                <span className="max-w-[9rem] truncate">{cliente}</span>
              </span>
            )}
            {conFoto && <Camara className="size-3.5 shrink-0" aria-label="Con foto de la comanda" />}
          </span>
        )}
      </span>
    </button>
  );

  if (!alContar) return fila;

  /* Con casilla, la fila es un contenedor: una casilla dentro de un botón no es
     HTML válido y el toque se lo quedaría el botón. La casilla va fuera, con su
     propia zona de toque de 44 px, y el resto de la fila sigue abriendo el pedido. */
  return (
    <div
      className={`flex items-stretch border-b border-linea last:border-b-0 ${
        contado ? "bg-bien-suave/50" : ""
      }`}
    >
      <label className="flex w-12 shrink-0 cursor-pointer items-center justify-center">
        <input
          type="checkbox"
          checked={!!contado}
          onChange={(e) => alContar(e.target.checked)}
          aria-label={`La empresa contó ${porCompletar ? "este pedido" : codigo}`}
          className="size-6 accent-[var(--bien)]"
        />
      </label>
      {fila}
    </div>
  );
}
