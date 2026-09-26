"use client";

import { useState } from "react";

import { Acordeon } from "@/components/Acordeon";
import { ExportarEstadisticas } from "@/components/ExportarEstadisticas";
import { GraficoDias, type DiaGrafico } from "@/components/GraficoDias";
import { Reloj, Subir, Trofeo } from "@/components/iconos";
import { Pestanas } from "@/components/Pestanas";
import { Aviso, Cifras, Vacio } from "@/components/ui";
import { useDatos } from "@/hooks/useDatos";
import { descansosPorRango } from "@/lib/db/sqlite/descansos";
import { jornadasPorRango, reglaVigente } from "@/lib/db/sqlite/jornadas";
import { montoDelDia } from "@/lib/pagos/calcular-liquidacion";
import { perfilActual } from "@/lib/db/sqlite/perfil";
import {
  formatearDuracion,
  formatearFecha,
  hoyEnLima,
  nombreDelDia,
  rangoDeFechas,
  sumarDias,
  type FechaISO,
} from "@/lib/fechas";
import { TRAMO_MAS_DE_12_KM, formatearSoles } from "@/lib/pagos/reglas";

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

/**
 * Estadísticas (§10).
 *
 * Lo que se mira de un vistazo —el rango, las cuatro cifras y el gráfico de los
 * días— está siempre a la vista. El detalle va en acordeones cerrados que dicen
 * su dato clave sin abrirse: Tiempos, Ingresos, Por distancia, Récords y
 * Exportar.
 */
export default function PaginaEstadisticas() {
  const [rango, setRango] = useState<IdRango>("30");

  const hoy = hoyEnLima();
  const [desde, hasta] = limites(rango, hoy);

  const { datos } = useDatos(
    async () => {
      const [jornadas, perfil, descansos] = await Promise.all([
        jornadasPorRango(desde, hasta),
        perfilActual(),
        descansosPorRango(desde, hasta),
      ]);
      const { regla } = await reglaVigente(hasta, perfil?.tiendaId ?? null, perfil?.vehiculo);
      return { jornadas, perfil, regla, descansos: new Set<FechaISO>(descansos) };
    },
    [desde, hasta],
    // Cambiar de rango no debe vaciar la pantalla: se ve lo de antes un instante.
    { conservar: true, entreCambios: true },
  );

  if (!datos) return <Esqueleto />;
  const { jornadas, perfil, regla, descansos } = datos;

  const cabecera = (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h2 className="text-[26px] leading-tight">Estadísticas</h2>
        <span className="rotulo">
          {formatearFecha(desde)} – {formatearFecha(hasta)}
        </span>
      </div>
      <Pestanas
        etiqueta="Rango de días"
        actual={rango}
        alCambiar={(id) => setRango(id as IdRango)}
        items={RANGOS.map((r) => ({ id: r.id, etiqueta: r.etiqueta }))}
      />
    </div>
  );

  if (jornadas.length === 0) {
    return (
      <div className="mx-auto flex max-w-[1180px] flex-col gap-4">
        {cabecera}
        <Vacio>No hay jornadas cargadas en este rango.</Vacio>
      </div>
    );
  }

  const porFecha = new Map(jornadas.map((j) => [j.fecha, j]));
  const dias: DiaGrafico[] = rangoDeFechas(desde, hasta).map((fecha) => {
    const j = porFecha.get(fecha);
    if (!j) {
      return { fecha, cargado: false, descanso: descansos.has(fecha), pedidos: 0, rutas: 0, minutos: 0, centimos: 0, fueraTramo1: 0 };
    }
    return {
      fecha,
      cargado: true,
      pedidos: j.ordenes.length,
      rutas: j.rutas.length,
      minutos: j.rutas.reduce((s, r) => s + (r.duracionMin ?? 0), 0),
      // Lo que se cobró ese día, piso de permanencia incluido.
      centimos: montoDelDia(
        j.ordenes.reduce((s, o) => s + (o.montoCentimos ?? 0), 0),
        regla,
        j.horaEntrada,
        j.horaSalida,
      ).pagadoCentimos,
      fueraTramo1: j.ordenes.filter((o) => o.tramo > 1).length,
    };
  });

  const cargados = dias.filter((d) => d.cargado);
  const totalPedidos = cargados.reduce((s, d) => s + d.pedidos, 0);
  const totalRutas = cargados.reduce((s, d) => s + d.rutas, 0);
  const totalMinutos = cargados.reduce((s, d) => s + d.minutos, 0);
  const totalCentimos = cargados.reduce((s, d) => s + d.centimos, 0);
  const totalFuera = cargados.reduce((s, d) => s + d.fueraTramo1, 0);
  // Un día de descanso no es un hueco: no falta nada por subir.
  const huecos = dias.filter((d) => !d.cargado && !d.descanso && d.fecha <= hoy).length;

  const duraciones = jornadas.flatMap((j) =>
    j.rutas.map((r) => r.duracionMin).filter((d): d is number => d !== null && d > 0),
  );
  const durProm = duraciones.length ? Math.round(duraciones.reduce((a, b) => a + b, 0) / duraciones.length) : 0;
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

  /* Por distancia: en qué tramos cayeron los pedidos y, de los que se ubicaron
     con su comanda, qué tan lejos. */
  const ordenes = jornadas.flatMap((j) => j.ordenes);
  const porTramo = [...regla.tramos.map((t) => t.id), TRAMO_MAS_DE_12_KM]
    .map((id) => ({ id, cuantos: ordenes.filter((o) => o.tramo === id).length }))
    .filter((t) => t.id !== TRAMO_MAS_DE_12_KM || t.cuantos > 0);
  const masCuantos = Math.max(1, ...porTramo.map((t) => t.cuantos));
  const conKm = ordenes.filter((o) => o.km !== null);
  const kmMedio = conKm.length ? conKm.reduce((s, o) => s + (o.km ?? 0), 0) / conKm.length : 0;
  const kmMaximo = conKm.length ? Math.max(...conKm.map((o) => o.km ?? 0)) : 0;

  const promedioDia = cargados.length ? totalPedidos / cargados.length : 0;
  const centimosPorDia = cargados.length ? Math.round(totalCentimos / cargados.length) : 0;
  const centimosPorPedido = totalPedidos ? Math.round(totalCentimos / totalPedidos) : 0;

  const bloqueTiempos = (
    <dl className="flex flex-col">
      <Dato etiqueta="Tiempo total en ruta" valor={formatearDuracion(totalMinutos)} />
      <Dato etiqueta="Duración media por ruta" valor={`${durProm} min`} />
      <Dato etiqueta="Ruta más rápida / más lenta" valor={`${rutaRapida} / ${rutaLenta} min`} />
      <Dato etiqueta="Minutos por pedido" valor={totalPedidos ? `${Math.round(totalMinutos / totalPedidos)} min` : "—"} />
      <Dato etiqueta="Pedidos por ruta" valor={totalRutas ? (totalPedidos / totalRutas).toFixed(1) : "—"} />
    </dl>
  );
  const bloqueIngresos = (
    <dl className="flex flex-col">
      <Dato etiqueta="Promedio por día" valor={formatearSoles(centimosPorDia)} />
      <Dato etiqueta="Promedio por pedido" valor={totalPedidos ? formatearSoles(centimosPorPedido) : "—"} />
      <Dato
        etiqueta="Promedio por hora en ruta"
        valor={totalMinutos ? formatearSoles(Math.round(totalCentimos / (totalMinutos / 60))) : "—"}
      />
      <Dato etiqueta="Pedidos fuera del tramo 1" valor={`${totalFuera} de ${totalPedidos}`} />
    </dl>
  );
  const bloqueRecords = (
    <div className="flex flex-col gap-3">
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
  );
  const bloqueCifras = (id?: string) => (
    <div id={id}>
      <Cifras
        datos={[
          { etiqueta: "Pedidos", valor: String(totalPedidos) },
          { etiqueta: "Soles", valor: (totalCentimos / 100).toFixed(2) },
          { etiqueta: "Días trabajados", valor: String(cargados.length) },
          { etiqueta: "Promedio por día", valor: promedioDia.toFixed(1), pie: "ped." },
        ]}
      />
    </div>
  );

  return (
    <div className="mx-auto flex max-w-[1180px] flex-col gap-4">
      {cabecera}

      {bloqueCifras()}

      <div className="tarjeta">
        <GraficoDias dias={dias} />
      </div>

      {huecos > 0 && (
        <Aviso tono="atento" titulo={`${huecos} día${huecos === 1 ? "" : "s"} sin carga en el rango`}>
          <p>
            Un hueco no es un día sin trabajo. Súbelo y las cifras se recalculan; si no trabajaste, márcalo como
            descanso en Pagos.
          </p>
        </Aviso>
      )}

      <Acordeon
        titulo="Tiempos"
        resumen={`${formatearDuracion(totalMinutos)} en ruta · ${durProm} min por ruta`}
      >
        {bloqueTiempos}
        <p className="text-xs text-tinta-3">
          Los minutos por pedido son una estimación: las capturas traen la hora de la ruta, no la de cada pedido.
        </p>
      </Acordeon>

      <Acordeon
        titulo="Ingresos"
        resumen={`${formatearSoles(centimosPorDia)} por día${totalPedidos ? ` · ${formatearSoles(centimosPorPedido)} por pedido` : ""}`}
      >
        {bloqueIngresos}
      </Acordeon>

      <Acordeon
        titulo="Por distancia"
        resumen={`${totalFuera} de ${totalPedidos} pedidos fuera del tramo 1${
          conKm.length > 0 ? ` · media ${kmMedio.toFixed(1)} km` : ""
        }`}
      >
        <div className="flex flex-col gap-2.5">
          {porTramo.map((t) => (
            <div key={t.id} className="grid grid-cols-[42px_1fr_auto] items-center gap-2.5 text-sm">
              <span className="font-mono text-xs">{t.id === TRAMO_MAS_DE_12_KM ? "+12 km" : `T${t.id}`}</span>
              <div className="h-3 overflow-hidden rounded-full bg-linea">
                <div className="h-full rounded-full bg-acento" style={{ width: `${(t.cuantos / masCuantos) * 100}%` }} />
              </div>
              <b className="font-mono text-xs">{t.cuantos}</b>
            </div>
          ))}
        </div>
        {conKm.length > 0 ? (
          <dl className="flex flex-col">
            <Dato etiqueta="Distancia media" valor={`${kmMedio.toFixed(1)} km`} />
            <Dato etiqueta="El pedido más lejano" valor={`${kmMaximo.toFixed(1)} km`} />
            <Dato etiqueta="Pedidos con distancia" valor={`${conKm.length} de ${totalPedidos}`} />
          </dl>
        ) : (
          <p className="text-xs text-tinta-3">
            Todavía ningún pedido tiene distancia. Al leer las comandas se guarda de dónde vino cada pedido y aquí
            verás qué tan lejos reparte.
          </p>
        )}
      </Acordeon>

      <Acordeon
        titulo="Récords"
        resumen={`${formatearSoles(mejorIngreso.centimos)} · mejor día`}
      >
        {bloqueRecords}
      </Acordeon>

      <Acordeon titulo="Exportar" resumen="Estadísticas a PDF">
        <ExportarEstadisticas
          driver={perfil?.nombre ?? ""}
          desde={desde}
          hasta={hasta}
          cifras={[
            { etiqueta: "Pedidos", valor: String(totalPedidos) },
            { etiqueta: "Soles", valor: formatearSoles(totalCentimos) },
            { etiqueta: "Días trabajados", valor: String(cargados.length) },
            { etiqueta: "Promedio por día", valor: `${promedioDia.toFixed(1)} pedidos` },
            { etiqueta: "Tiempo en ruta", valor: formatearDuracion(totalMinutos) },
            { etiqueta: "Por pedido", valor: totalPedidos ? formatearSoles(centimosPorPedido) : "—" },
          ]}
          bloques={[
            {
              id: "bloque-grafico",
              titulo: "Pedidos y soles por día",
              lectura:
                "La altura de cada barra son los pedidos del día y la etiqueta de abajo, los soles. El segmento superior en otro tono son los pedidos que pasaron de 3 km. Los huecos con marca tenue son días sin carga, no días sin trabajo.",
            },
            { id: "bloque-cifras", titulo: "Totales del rango", lectura: "Lo que suma el periodo consultado." },
            {
              id: "bloque-detalle",
              titulo: "Tiempos e ingresos",
              lectura: "Los minutos por pedido son una estimación: las capturas traen la hora de la ruta, no la de cada pedido.",
            },
            { id: "bloque-records", titulo: "Récords", lectura: "Lo mejor del periodo consultado." },
          ]}
        />
      </Acordeon>

      {/* El PDF se compone de estos bloques, y con los acordeones cerrados no se
          verían: su contenido está plegado. Por eso van aquí, fuera de la
          pantalla y siempre desplegados, con los ids que busca la exportación. */}
      <div aria-hidden className="pointer-events-none fixed top-0 -left-[9999px] flex w-[560px] flex-col gap-4">
        <div id="bloque-grafico" className="tarjeta">
          <GraficoDias dias={dias} />
        </div>
        {bloqueCifras("bloque-cifras")}
        <div id="bloque-detalle" className="grid gap-4">
          <section className="tarjeta">
            <span className="rotulo">Tiempos</span>
            <div className="mt-2">{bloqueTiempos}</div>
          </section>
          <section className="tarjeta">
            <span className="rotulo">Ingresos</span>
            <div className="mt-2">{bloqueIngresos}</div>
          </section>
        </div>
        <section id="bloque-records" className="tarjeta">
          <span className="rotulo">Récords</span>
          <div className="mt-3">{bloqueRecords}</div>
        </section>
      </div>
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

function Esqueleto() {
  return (
    <div className="mx-auto flex max-w-[1180px] animate-pulse flex-col gap-4" aria-hidden>
      <div className="h-8 w-52 rounded bg-sup-2" />
      <div className="h-[104px] rounded-card bg-sup-2" />
      <div className="h-[300px] rounded-card bg-sup-2" />
    </div>
  );
}
