import { formatearSoles, type ResumenTablero } from "@/lib/licencia/panel";

function Cifra({ n, t, tono }: { n: string; t: string; tono?: "bien" | "aviso" | "mal" | "acento" }) {
  return (
    <div className="lic-kpi" data-tono={tono}>
      <span className="lic-kpi-n">{n}</span>
      <span className="lic-kpi-t">{t}</span>
    </div>
  );
}

/** Las seis cifras de arriba del panel. */
export function Tablero({ r }: { r: ResumenTablero }) {
  return (
    <div className="lic-kpis">
      <Cifra n={String(r.activos)} t="Usuarios activos" tono="bien" />
      <Cifra n={String(r.porVencer)} t="Vencen en 7 días" tono="aviso" />
      <Cifra n={String(r.vencidos)} t="Vencidos" tono="mal" />
      <Cifra n={formatearSoles(r.ingresosMesCentimos)} t="Ingresos del mes" tono="acento" />
      <Cifra n={formatearSoles(r.ingresosTotalesCentimos)} t="Ingresos acumulados" />
      <Cifra n={formatearSoles(r.ticketMedioCentimos)} t="Ticket medio" />
    </div>
  );
}
