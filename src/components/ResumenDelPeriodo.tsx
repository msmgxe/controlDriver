import { Ticket } from "@/components/iconos";
import { formatearSoles } from "@/lib/pagos/reglas";

/**
 * El resumen de un periodo en una tarjeta: cuántos pedidos y cuánto se
 * **generó**.
 *
 * «Generado» y no «ventas»: el repartidor no vende, reparte; lo que suma es lo
 * que su trabajo genera para él en el periodo, con el piso de permanencia
 * incluido cuando lo paga la tienda.
 */
export function ResumenDelPeriodo({
  titulo,
  rango,
  pedidos,
  centimos,
}: {
  titulo: string;
  /** El periodo, en corto: «21–27 sep 2026». */
  rango: string;
  pedidos: number;
  centimos: number;
}) {
  return (
    <section className="tarjeta flex flex-col gap-2.5 !p-3.5" aria-label={titulo}>
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-base leading-tight font-bold">{titulo}</h3>
        <span className="shrink-0 rounded-chip border border-linea-fuerte px-2.5 py-1 font-mono text-[11px] text-acento-tinta">
          {rango}
        </span>
      </div>

      <div className="grid grid-cols-[minmax(0,5fr)_minmax(0,7fr)] divide-x divide-linea">
        <div className="flex items-center gap-2 pr-2">
          <span className="grid size-9 shrink-0 place-items-center rounded-full bg-acento text-acento-texto">
            <Ticket className="size-[18px]" />
          </span>
          <span className="flex min-w-0 flex-col">
            <span className="text-[11px] leading-tight text-tinta-2">Pedidos</span>
            <b className="font-display text-[30px] leading-none tabular-nums">{pedidos}</b>
          </span>
        </div>

        <div className="flex items-center gap-2 pl-3">
          <span className="grid size-9 shrink-0 place-items-center rounded-full bg-acento-suave font-mono text-[13px] font-bold text-acento-tinta">
            S/
          </span>
          <span className="flex min-w-0 flex-col">
            <span className="text-[11px] leading-tight text-tinta-2">Generado</span>
            <b className="font-display text-[26px] leading-none whitespace-nowrap text-acento tabular-nums">
              {formatearSoles(centimos).replace("S/ ", "")}
            </b>
          </span>
        </div>
      </div>
    </section>
  );
}
