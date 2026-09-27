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
    <section className="tarjeta grid grid-cols-3 divide-x divide-linea !p-3" aria-label="Datos rápidos">
      <Dato
        etiqueta="Promedio diario"
        valor={promedioPorDia.toFixed(1)}
        unidad="ped."
        pie={`en ${diasTrabajados} día${diasTrabajados === 1 ? "" : "s"}`}
      />
      <Dato
        etiqueta="Mejor día"
        valor={mejorDia ? `${nombreDelDia(mejorDia.fecha).slice(0, 3)} ${Number(mejorDia.fecha.slice(8))}` : "—"}
        pie={mejorDia ? `${mejorDia.pedidos} pedidos` : "sin datos"}
        clases="capitalize"
      />
      <Dato
        etiqueta="Por pedido"
        valor={centimosPorPedido ? formatearSoles(centimosPorPedido).replace("S/ ", "S/ ") : "—"}
        pie="promedio"
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
}: {
  etiqueta: string;
  valor: string;
  unidad?: string;
  pie: string;
  clases?: string;
}) {
  return (
    <div className="flex min-w-0 flex-col items-center gap-0.5 px-1 text-center">
      <span className="text-[11px] leading-tight whitespace-nowrap text-tinta-2">{etiqueta}</span>
      <b className={`font-display text-[20px] leading-tight whitespace-nowrap text-acento tabular-nums ${clases}`}>
        {valor}
        {unidad && <small className="ml-0.5 font-sans text-[11px] font-medium text-tinta-2">{unidad}</small>}
      </b>
      <span className="text-[11px] leading-tight text-tinta-3">{pie}</span>
    </div>
  );
}
