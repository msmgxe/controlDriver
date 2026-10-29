"use client";

/**
 * Un interruptor de encendido/apagado con su explicación al lado.
 *
 * Toda la fila es el botón —el tope táctil es la fila, no la píldora—, y es un
 * `role="switch"`: un lector de pantalla dice «activado» o «desactivado» sin
 * depender del color de la píldora.
 */
export function Interruptor({
  titulo,
  detalle,
  activo,
  alCambiar,
  deshabilitado = false,
}: {
  titulo: string;
  detalle?: string;
  activo: boolean;
  alCambiar: (nuevo: boolean) => void;
  deshabilitado?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={activo}
      disabled={deshabilitado}
      onClick={() => alCambiar(!activo)}
      className="flex min-h-[var(--toque)] w-full items-center justify-between gap-3 py-2 text-left disabled:opacity-50"
    >
      <span className="flex min-w-0 flex-col">
        <b className="text-sm font-semibold">{titulo}</b>
        {detalle && <span className="text-xs leading-snug text-tinta-3">{detalle}</span>}
      </span>
      <span aria-hidden className="aju-sw" data-on={activo}>
        <i />
      </span>
    </button>
  );
}
