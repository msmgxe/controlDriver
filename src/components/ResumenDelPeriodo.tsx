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
    <section className="tarjeta entra flex flex-col gap-2.5 !p-3.5" aria-label={titulo}>
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-base leading-tight font-bold">{titulo}</h3>
        <span className="shrink-0 rounded-chip border border-linea-fuerte px-2.5 py-1 font-mono text-[11px] text-acento-tinta">
          {rango}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div className="pag-kpi" style={{ "--c": "var(--c-comanda)" } as React.CSSProperties}>
          <span className="flex items-center gap-1.5">
            <Ticket className="size-[18px]" />
            <small>Pedidos</small>
          </span>
          <b className="tabular-nums">{pedidos}</b>
        </div>
        <div className="pag-kpi" style={{ "--c": "var(--c-pagos)", animationDelay: "0.07s" } as React.CSSProperties}>
          <span className="flex items-center gap-1.5">
            <small className="font-mono text-[13px] font-extrabold">S/</small>
            <small>Generado</small>
          </span>
          <b className="whitespace-nowrap tabular-nums">{formatearSoles(centimos).replace("S/ ", "")}</b>
        </div>
      </div>
    </section>
  );
}
