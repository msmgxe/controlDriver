import type { FilaDeDesglose } from "@/lib/pagos/desglose";
import { formatearSoles } from "@/lib/pagos/reglas";

const COLOR = {
  tienda: "bg-acento",
  apoyo: "bg-[var(--f-apoyo)]",
  taxi: "bg-[var(--f-taxi)]",
} as const;

/**
 * De dónde viene el dinero, fuente por fuente: la tienda de siempre, cada
 * tienda a la que se apoyó y el taxi. Cada fila dice qué fue (horas, pedidos,
 * carreras), cuánto dio y qué parte del total es; abajo, el total.
 *
 * Sustituye a `DesgloseDeCategorias`, que juntaba todo el apoyo en una barra
 * sin decir de qué tienda venía.
 *
 * Con una sola fuente no hay nada que repartir: no se dibuja, salvo que se
 * pida con `siempre`.
 */
export function DesgloseDeIngresos({
  filas,
  siempre = false,
  titulo,
}: {
  filas: readonly FilaDeDesglose[];
  siempre?: boolean;
  titulo?: string;
}) {
  if (filas.length === 0 || (filas.length < 2 && !siempre)) return null;

  const total = filas.reduce((s, f) => s + f.centimos, 0);

  return (
    <div className="entra flex flex-col gap-3 rounded-card bg-sup-2 p-4" aria-label={titulo ?? "De dónde viene"}>
      {titulo && <span className="rotulo">{titulo}</span>}
      {filas.map((f, i) => {
        const parte = total > 0 ? f.centimos / total : 0;
        return (
          <div key={f.clave} className="flex flex-col gap-1">
            <div className="flex items-baseline justify-between gap-3">
              <span className="min-w-0 truncate text-[13px] font-semibold">{f.etiqueta}</span>
              <b className="shrink-0 font-mono text-[13px] tabular-nums">{formatearSoles(f.centimos)}</b>
            </div>
            <div className="h-2 overflow-hidden rounded-chip bg-papel">
              <div className={`barra-crece h-full rounded-chip ${COLOR[f.categoria]}`} style={{ width: `${Math.max(parte * 100, f.centimos > 0 ? 3 : 0)}%`, "--i": i } as React.CSSProperties} />
            </div>
            <span className="text-[11.5px] text-tinta-2">
              {f.detalle}
              {total > 0 && ` · ${Math.round(parte * 100)} %`}
            </span>
          </div>
        );
      })}
      <div className="flex items-baseline justify-between gap-3 border-t border-linea pt-2.5">
        <span className="text-[13px] font-bold">Total</span>
        <b className="font-mono text-[15px] tabular-nums">{formatearSoles(total)}</b>
      </div>
    </div>
  );
}
