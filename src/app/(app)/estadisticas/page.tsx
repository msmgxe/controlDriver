import Link from "next/link";

import { GraficoDias, type DiaGrafico } from "@/components/GraficoDias";
import { Reloj, Subir, Trofeo } from "@/components/iconos";
import { Aviso, Cifras, Vacio } from "@/components/ui";
import { jornadasPorRango } from "@/lib/db/jornadas";
import {
  formatearDuracion,
  formatearFecha,
  hoyEnLima,
  nombreDelDia,
  rangoDeFechas,
  sumarDias,
  type FechaISO,
} from "@/lib/fechas";
import { formatearSoles } from "@/lib/pagos/reglas";

export const metadata = { title: "Estadísticas" };
export const dynamic = "force-dynamic";

const RANGOS = [
  { id: "7", etiqueta: "7 días" },
  { id: "30", etiqueta: "30 días" },
  { id: "mes", etiqueta: "Este mes" },
] as const;

type IdRango = (typeof RANGOS)[number]["id"];

function limites(id: IdRango, hoy: FechaISO): [FechaISO, FechaISO] {
  if (id === "7") return [sumarDias(hoy, -6), hoy];
  if (id === "mes") return [`${hoy.slice(0, 8)}01`, hoy];
  return [sumarDias(hoy, -29), hoy];
}

export default async function PaginaEstadisticas({
  searchParams,
}: {
  searchParams: Promise<{ rango?: string }>;
}) {
  const params = await searchParams;
  const rango = (RANGOS.find((r) => r.id === params.rango)?.id ?? "30") as IdRango;

  const hoy = hoyEnLima();
  const [desde, hasta] = limites(rango, hoy);
  const jornadas = await jornadasPorRango(desde, hasta);

  if (jornadas.length === 0) {
    return (
      <div className="mx-auto flex max-w-[1180px] flex-col gap-4">
        <h2 className="text-[30px] leading-tight">Estadísticas</h2>
        <Vacio>No hay jornadas cargadas en este rango.</Vacio>
      </div>
    );
  }

  const porFecha = new Map(jornadas.map((j) => [j.fecha, j]));
  const dias: DiaGrafico[] = rangoDeFechas(desde, hasta).map((fecha) => {
    const j = porFecha.get(fecha);
    if (!j) {
      return { fecha, cargado: false, pedidos: 0, rutas: 0, minutos: 0, centimos: 0, fueraTramo1: 0 };
    }
    return {
      fecha,
      cargado: true,
      pedidos: j.ordenes.length,
      rutas: j.rutas.length,
      minutos: j.rutas.reduce((s, r) => s + (r.duracionMin ?? 0), 0),
      centimos: j.ordenes.reduce((s, o) => s + (o.montoCentimos ?? 0), 0),
      fueraTramo1: j.ordenes.filter((o) => o.tramo > 1).length,
    };
  });

  const cargados = dias.filter((d) => d.cargado);
  const totalPedidos = cargados.reduce((s, d) => s + d.pedidos, 0);
  const totalRutas = cargados.reduce((s, d) => s + d.rutas, 0);
  const totalMinutos = cargados.reduce((s, d) => s + d.minutos, 0);
  const totalCentimos = cargados.reduce((s, d) => s + d.centimos, 0);
  const totalFuera = cargados.reduce((s, d) => s + d.fueraTramo1, 0);
  const huecos = dias.filter((d) => !d.cargado && d.fecha <= hoy).length;

  const duraciones = jornadas.flatMap((j) =>
    j.rutas.map((r) => r.duracionMin).filter((d): d is number => d !== null && d > 0),
  );
  const durProm = duraciones.length
    ? Math.round(duraciones.reduce((a, b) => a + b, 0) / duraciones.length)
    : 0;
  const rutaRapida = duraciones.length ? Math.min(...duraciones) : 0;
  const rutaLenta = duraciones.length ? Math.max(...duraciones) : 0;

  const mejorDia = [...cargados].sort((a, b) => b.pedidos - a.pedidos)[0];
  const mejorIngreso = [...cargados].sort((a, b) => b.centimos - a.centimos)[0];

  // Racha de días consecutivos con todo entregado (§10, récords).
  let racha = 0;
  for (const j of [...jornadas].reverse()) {
    if (j.ordenes.length > 0 && j.ordenes.every((o) => o.estado === "Entregado")) racha += 1;
    else break;
  }

  return (
    <div className="mx-auto flex max-w-[1180px] flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h2 className="text-[30px] leading-tight">Estadísticas</h2>
        <span className="rotulo">
          {formatearFecha(desde)} – {formatearFecha(hasta)}
        </span>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-0.5">
        {RANGOS.map((r) => (
          <Link
            key={r.id}
            href={`/estadisticas?rango=${r.id}`}
            aria-pressed={rango === r.id}
            className={`inline-flex min-h-9 shrink-0 items-center rounded-chip px-3 text-sm whitespace-nowrap ${
              rango === r.id
                ? "bg-acento font-semibold text-acento-texto"
                : "border border-linea-fuerte bg-sup text-tinta-2"
            }`}
          >
            {r.etiqueta}
          </Link>
        ))}
      </div>

      <div className="tarjeta">
        <GraficoDias dias={dias} />
      </div>

      {huecos > 0 && (
        <Aviso tono="atento" titulo={`${huecos} día${huecos === 1 ? "" : "s"} sin carga en el rango`}>
          <p>Los huecos no son días sin trabajo. Súbelos y las cifras se recalculan.</p>
        </Aviso>
      )}

      <Cifras
        datos={[
          { etiqueta: "Pedidos", valor: String(totalPedidos) },
          { etiqueta: "Soles", valor: (totalCentimos / 100).toFixed(2) },
          { etiqueta: "Días trabajados", valor: String(cargados.length) },
          {
            etiqueta: "Promedio por día",
            valor: (totalPedidos / cargados.length).toFixed(1),
            pie: "ped.",
          },
        ]}
      />

      <div className="grid gap-4 md:grid-cols-2 md:items-start">
        <section className="tarjeta">
          <span className="rotulo">Tiempos</span>
          <dl className="mt-2 flex flex-col">
            <Dato etiqueta="Tiempo total en ruta" valor={formatearDuracion(totalMinutos)} />
            <Dato etiqueta="Duración media por ruta" valor={`${durProm} min`} />
            <Dato
              etiqueta="Ruta más rápida / más lenta"
              valor={`${rutaRapida} / ${rutaLenta} min`}
            />
            <Dato
              etiqueta="Minutos por pedido"
              valor={totalPedidos ? `${Math.round(totalMinutos / totalPedidos)} min` : "—"}
            />
            <Dato
              etiqueta="Pedidos por ruta"
              valor={totalRutas ? (totalPedidos / totalRutas).toFixed(1) : "—"}
            />
          </dl>
          <p className="mt-3 text-xs text-tinta-3">
            Los minutos por pedido son una estimación: las capturas traen la hora de la ruta, no la
            de cada pedido.
          </p>
        </section>

        <section className="tarjeta">
          <span className="rotulo">Ingresos</span>
          <dl className="mt-2 flex flex-col">
            <Dato
              etiqueta="Promedio por día"
              valor={formatearSoles(Math.round(totalCentimos / cargados.length))}
            />
            <Dato
              etiqueta="Promedio por pedido"
              valor={totalPedidos ? formatearSoles(Math.round(totalCentimos / totalPedidos)) : "—"}
            />
            <Dato
              etiqueta="Promedio por hora en ruta"
              valor={
                totalMinutos
                  ? formatearSoles(Math.round(totalCentimos / (totalMinutos / 60)))
                  : "—"
              }
            />
            <Dato etiqueta="Pedidos fuera del tramo 1" valor={`${totalFuera} de ${totalPedidos}`} />
          </dl>
        </section>
      </div>

      <section className="tarjeta">
        <span className="rotulo">Récords</span>
        <div className="mt-3 flex flex-col gap-3">
          <Record
            Icono={Trofeo}
            titulo={`${formatearSoles(mejorIngreso.centimos)} · mejor día en ingresos`}
            detalle={`${nombreDelDia(mejorIngreso.fecha)} ${formatearFecha(mejorIngreso.fecha)}`}
          />
          <Record
            Icono={Subir}
            titulo={`${mejorDia.pedidos} pedidos · día con más carga`}
            detalle={`${nombreDelDia(mejorDia.fecha)} ${formatearFecha(mejorDia.fecha)}, en ${mejorDia.rutas} rutas`}
          />
          <Record
            Icono={Reloj}
            titulo={`${racha} día${racha === 1 ? "" : "s"} al 100 %`}
            detalle="racha actual de jornadas con todo entregado"
          />
        </div>
      </section>
    </div>
  );
}

function Dato({ etiqueta, valor }: { etiqueta: string; valor: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-linea py-2 text-sm last:border-b-0">
      <dt className="text-tinta-2">{etiqueta}</dt>
      <dd className="font-mono font-medium whitespace-nowrap tabular-nums">{valor}</dd>
    </div>
  );
}

function Record({
  Icono,
  titulo,
  detalle,
}: {
  Icono: typeof Trofeo;
  titulo: string;
  detalle: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <span className="grid size-[30px] shrink-0 place-items-center rounded-chip bg-acento-suave text-acento-tinta">
        <Icono className="size-4" />
      </span>
      <span className="flex min-w-0 flex-col">
        <b className="text-sm font-bold">{titulo}</b>
        <span className="text-xs text-tinta-3">{detalle}</span>
      </span>
    </div>
  );
}
