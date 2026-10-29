import { formatearSoles } from "@/lib/pagos/reglas";
import { nombreDelDia, type FechaISO } from "@/lib/fechas";

/**
 * Tres datos de un vistazo bajo el gráfico: el promedio por día, el mejor día y
 * lo que rinde cada pedido.
 */
export function DatosRapidos({
  promedioPorDia,
  diasTrabajados,
  mejorDia,
  centimosPorPedido,
}: {
  promedioPorDia: number;
  diasTrabajados: number;
  mejorDia: { fecha: FechaISO; pedidos: number } | null;
  centimosPorPedido: number;
}) {
  return (
    <section className="grid grid-cols-3 gap-2" aria-label="Datos rápidos">
      <Dato
        etiqueta="Promedio diario"
        valor={promedioPorDia.toFixed(1)}
        unidad="ped."
        pie={`en ${diasTrabajados} día${diasTrabajados === 1 ? "" : "s"}`}
        color="var(--c-stats)"
      />
      <Dato
        etiqueta="Mejor día"
        valor={mejorDia ? `${nombreDelDia(mejorDia.fecha).slice(0, 3)} ${Number(mejorDia.fecha.slice(8))}` : "—"}
        pie={mejorDia ? `${mejorDia.pedidos} pedidos` : "sin datos"}
        clases="capitalize"
        color="var(--c-taxi)"
        texto="var(--sol-tinta, #0a2260)"
      />
      <Dato
        etiqueta="Por pedido"
        valor={centimosPorPedido ? formatearSoles(centimosPorPedido).replace("S/ ", "S/ ") : "—"}
        pie="promedio"
        color="var(--c-apoyo)"
      />
    </section>
  );
}

function Dato({
  etiqueta,
  valor,
  unidad,
  pie,
  clases = "",
  color,
  texto = "#fff",
}: {
  etiqueta: string;
  valor: string;
  unidad?: string;
  pie: string;
  clases?: string;
  color: string;
  texto?: string;
}) {
  return (
    <div
      className="flex min-w-0 flex-col items-center gap-0.5 rounded-[18px] px-1 py-2.5 text-center"
      style={{ background: color, color: texto }}
    >
      <span className="text-[11px] leading-tight font-bold whitespace-nowrap">{etiqueta}</span>
      <b className={`font-display text-[20px] leading-tight whitespace-nowrap tabular-nums ${clases}`}>
        {valor}
        {unidad && <small className="ml-0.5 font-sans text-[11px] font-medium opacity-90">{unidad}</small>}
      </b>
      <span className="text-[11px] leading-tight opacity-90">{pie}</span>
    </div>
  );
}
