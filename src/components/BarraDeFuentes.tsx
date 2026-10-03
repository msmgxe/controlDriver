"use client";

import type { CategoriaIngreso } from "@/lib/pagos/bloques-extra";
import type { FilaDeDesglose } from "@/lib/pagos/desglose";
import { formatearSoles } from "@/lib/pagos/reglas";

const COLOR: Record<CategoriaIngreso, string> = {
  tienda: "var(--acento)",
  apoyo: "#c99700",
  taxi: "#5b2bd6",
};
const NOMBRE: Record<CategoriaIngreso, string> = { tienda: "Tienda", apoyo: "Apoyo", taxi: "Taxi" };

/**
 * El dinero del día en una sola barra apilada: tienda, apoyo y taxi, con los
 * mismos colores en toda la app. Se llena sola al aparecer. Cada tramo y cada
 * etiqueta se pueden tocar: `alElegir` lleva al detalle de esa fuente.
 */
export function BarraDeFuentes({
  filas,
  alElegir,
}: {
  filas: readonly FilaDeDesglose[];
  alElegir?: (categoria: CategoriaIngreso) => void;
}) {
  // Varias tiendas de apoyo se juntan en un solo tramo de color.
  const porCategoria = (["tienda", "apoyo", "taxi"] as const)
    .map((c) => ({ c, centimos: filas.filter((f) => f.categoria === c).reduce((s, f) => s + f.centimos, 0) }))
    .filter((x) => x.centimos > 0);
  const total = porCategoria.reduce((s, x) => s + x.centimos, 0);
  // Con una sola fuente no hay nada que repartir: menos ruido en pantalla.
  if (total === 0 || porCategoria.length < 2) return null;

  return (
    <div className="entra flex flex-col gap-2" style={{ "--i": 1 } as React.CSSProperties}>
      <div className="flex h-[26px] gap-[3px] overflow-hidden rounded-chip bg-sup">
        {porCategoria.map((x, i) => (
          <button
            key={x.c}
            type="button"
            aria-label={`${NOMBRE[x.c]}: ${formatearSoles(x.centimos)}. Ver detalle`}
            onClick={() => alElegir?.(x.c)}
            className="barra-crece h-full min-w-[10px] rounded-chip active:brightness-90"
            style={{ width: `${(x.centimos / total) * 100}%`, background: COLOR[x.c], "--i": i } as React.CSSProperties}
          />
        ))}
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1">
        {porCategoria.map((x) => (
          <button
            key={x.c}
            type="button"
            onClick={() => alElegir?.(x.c)}
            className="flex min-h-8 items-center gap-1.5 text-[12.5px] text-tinta-2"
          >
            <span className="size-2.5 rounded-full" style={{ background: COLOR[x.c] }} />
            {NOMBRE[x.c]} <b className="font-mono text-tinta tabular-nums">{formatearSoles(x.centimos)}</b>
            <span className="text-tinta-3">{Math.round((x.centimos / total) * 100)} %</span>
          </button>
        ))}
      </div>
    </div>
  );
}
