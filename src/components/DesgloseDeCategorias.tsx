import { formatearSoles } from "@/lib/pagos/reglas";

/**
 * Cuánto de un monto vino de cada fuente —tienda, apoyo, taxi—, en barras a
 * escala común.
 *
 * A diferencia de `DueloDePago` (pedidos vs. permanencia, donde gana uno y el
 * otro se atenúa), aquí las tres categorías **se suman**: ninguna "pierde",
 * así que no hay barra atenuada ni "cobras tal cosa" al final, solo el reparto.
 */
export function DesgloseDeCategorias({
  tienda,
  apoyo,
  taxi,
}: {
  tienda: number;
  apoyo: number;
  taxi: number;
}) {
  const filas = [
    { etiqueta: "Tienda", centimos: tienda, color: "bg-acento" },
    { etiqueta: "Apoyo", centimos: apoyo, color: "bg-[#c99700] dark:bg-[#e6b400]" },
    { etiqueta: "Taxi", centimos: taxi, color: "bg-[#5b2bd6] dark:bg-[#8f6bf0]" },
  ].filter((f) => f.centimos > 0);

  if (filas.length < 2) return null; // un solo origen no necesita desglose

  const tope = Math.max(tienda, apoyo, taxi, 1);

  return (
    <div className="flex flex-col gap-2.5 rounded-card bg-sup-2 p-4">
      {filas.map((f) => (
        <div key={f.etiqueta} className="grid grid-cols-[64px_1fr_76px] items-center gap-2.5">
          <span className="truncate text-xs font-medium text-tinta-2">{f.etiqueta}</span>
          <div className="h-[18px] overflow-hidden rounded-chip bg-papel">
            <div
              className={`h-full rounded-chip ${f.color} transition-[width]`}
              style={{ width: `${Math.max((f.centimos / tope) * 100, 3)}%` }}
            />
          </div>
          <span className="text-right font-mono text-[13px] tabular-nums">{formatearSoles(f.centimos)}</span>
        </div>
      ))}
    </div>
  );
}
