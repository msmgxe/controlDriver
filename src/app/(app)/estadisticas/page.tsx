"use client";

import { useState } from "react";

import { Acordeon } from "@/components/Acordeon";
import { ComparacionDeSemanas } from "@/components/ComparacionDeSemanas";
import { ExportarEstadisticas } from "@/components/ExportarEstadisticas";
import { GraficoDias } from "@/components/GraficoDias";
import { GraficoSemanas } from "@/components/GraficoSemanas";
import { Flecha, Reloj, Subir, Trofeo } from "@/components/iconos";
import { Pestanas } from "@/components/Pestanas";
import { SelectorDeMes } from "@/components/SelectorDeMes";
import { SelectorDeSemana } from "@/components/SelectorDeSemana";
import { Aviso, Cifras, Vacio } from "@/components/ui";
import { useDatos } from "@/hooks/useDatos";
import { descansosPorRango } from "@/lib/db/sqlite/descansos";
import { jornadasPorRango, resumenPorRango, reglaVigente } from "@/lib/db/sqlite/jornadas";
import { perfilActual } from "@/lib/db/sqlite/perfil";
import type { JornadaCompleta } from "@/lib/db/tipos";
import {
  diasDelRango,
  lunesDeLasUltimas,
  semanasDe,
  totalesDe,
  type DiaGrafico,
} from "@/lib/estadisticas";
import {
  formatearDuracion,
  formatearFecha,
  hoyEnLima,
  lunesDeLaSemana,
  nombreDelDia,
  nombreDelMes,
  primerDiaDelMes,
  sumarDias,
  ultimoDiaDelMes,
  type FechaISO,
} from "@/lib/fechas";
import { TRAMO_MAS_DE_12_KM, formatearSoles, type ReglaPago } from "@/lib/pagos/reglas";

type Vista = "semana" | "comparar" | "mes";

/** Cuántas semanas enseña «Semana a semana». */
const SEMANAS_A_LA_VISTA = 8;
/** Hasta cuántas semanas atrás se puede comparar. */
const MAX_SEMANAS_ATRAS = 52;

/**
 * Estadísticas (§10).
 *
 * Tres vistas, en pestañas, y **siempre se elige qué semana o qué mes**:
 *
 *   · **Semana** — la barra de días de arriba elige cualquier semana; el gráfico
 *     enseña sus siete días, y debajo, las últimas ocho semanas para ver cómo va
 *     frente a las anteriores;
 *   · **Comparar** — la semana elegida frente a otra, día por día y en cifras;
 *   · **Mes** — el mes elegido semana a semana; tocar una semana la abre.
 *
 * Antes eran «7 días / 30 días / Este mes»: treinta barras de un día que
 * empezaban por las más viejas y dejaban fuera la semana pasada y la de ahora,
 * sin forma de elegir otra ni de compararlas.
 *
 * El detalle —Tiempos, Ingresos, Por distancia, Récords y Exportar— va en
 * acordeones cerrados que dicen su dato clave sin abrirse.
 */
export default function PaginaEstadisticas() {
  const hoy = hoyEnLima();
  const [vista, setVista] = useState<Vista>("semana");
  const [semana, setSemana] = useState<FechaISO>(lunesDeLaSemana(hoy));
  const [mes, setMes] = useState<FechaISO>(primerDiaDelMes(hoy));
  // Con cuántas semanas atrás se compara (1 = la anterior).
  const [atras, setAtras] = useState(1);

  const finSemana = sumarDias(semana, 6);
  const lunesB = sumarDias(semana, -7 * atras);
  const finMes = ultimoDiaDelMes(mes);

  /* Lo que hace falta según la vista: el rango del detalle y el del resumen por
     día, que en «Semana» abarca las ocho semanas y en «Comparar» las dos. */
  const detalleDesde = vista === "mes" ? mes : semana;
  const detalleHasta = vista === "mes" ? finMes : finSemana;
  const resumenDesde =
    vista === "semana" ? lunesDeLasUltimas(semana, SEMANAS_A_LA_VISTA)[0] : vista === "comparar" ? lunesB : mes;

  const { datos } = useDatos(
    async () => {
      const [filas, jornadas, perfil, descansos] = await Promise.all([
        resumenPorRango(resumenDesde, detalleHasta),
        vista === "comparar" ? Promise.resolve([] as JornadaCompleta[]) : jornadasPorRango(detalleDesde, detalleHasta),
        perfilActual(),
        descansosPorRango(resumenDesde, detalleHasta),
      ]);
      const { regla } = await reglaVigente(detalleHasta, perfil?.tiendaId ?? null, perfil?.vehiculo);
      return { filas, jornadas, perfil, regla, descansos: new Set<FechaISO>(descansos) };
    },
    [vista, resumenDesde, detalleDesde, detalleHasta],
    // Cambiar de semana no debe vaciar la pantalla: se ve lo de antes un instante.
    { conservar: true, entreCambios: true },
  );

  if (!datos) return <Esqueleto />;
  const { filas, jornadas, perfil, regla, descansos } = datos;

  const encabezado = (
    <div className="flex flex-col gap-3">
      <h2 className="text-[26px] leading-tight">Estadísticas</h2>
      <Pestanas
        etiqueta="Qué mirar"
        actual={vista}
        alCambiar={(id) => setVista(id as Vista)}
        items={[
          { id: "semana", etiqueta: "Semana" },
          { id: "comparar", etiqueta: "Comparar" },
          { id: "mes", etiqueta: "Mes" },
        ]}
      />
    </div>
  );

  /* ------------------------------ Comparar ------------------------------ */
  if (vista === "comparar") {
    const diasA = diasDelRango(semana, finSemana, filas, descansos, hoy);
    const diasB = diasDelRango(lunesB, sumarDias(lunesB, 6), filas, descansos, hoy);
    const rotulo = (lunes: FechaISO) => `${Number(lunes.slice(8, 10))}–${Number(sumarDias(lunes, 6).slice(8, 10))}`;

    return (
      <div className="mx-auto flex max-w-[880px] flex-col gap-4">
        {encabezado}
        <SelectorDeSemana semana={semana} alCambiar={setSemana} etiqueta="Semana que miras" />

        <div className="flex items-center justify-between gap-2 rounded-btn border border-linea-fuerte bg-sup p-1">
          <button
            type="button"
            aria-label="Comparar con una semana más antigua"
            disabled={atras >= MAX_SEMANAS_ATRAS}
            onClick={() => setAtras((n) => n + 1)}
            className="grid size-11 place-items-center rounded-btn hover:bg-sup-2 disabled:opacity-30"
          >
            <Flecha className="size-5 rotate-180" />
          </button>
          <div className="flex min-w-0 flex-col items-center text-center">
            <span className="rotulo">Compararla con</span>
            <b className="text-[17px] leading-tight">Sem. {rotulo(lunesB)}</b>
            <span className="text-xs text-tinta-3">
              {atras === 1 ? "la semana anterior" : `hace ${atras} semanas`}
            </span>
          </div>
          <button
            type="button"
            aria-label="Comparar con una semana más reciente"
            disabled={atras <= 1}
            onClick={() => setAtras((n) => n - 1)}
            className="grid size-11 place-items-center rounded-btn hover:bg-sup-2 disabled:opacity-30"
          >
            <Flecha className="size-5" />
          </button>
        </div>

        {!diasA.some((d) => d.cargado) && !diasB.some((d) => d.cargado) ? (
          <Vacio>No hay jornadas cargadas en ninguna de las dos semanas.</Vacio>
        ) : (
          <ComparacionDeSemanas
            a={{ lunes: semana, rotulo: rotulo(semana), dias: diasA, totales: totalesDe(diasA) }}
            b={{ lunes: lunesB, rotulo: rotulo(lunesB), dias: diasB, totales: totalesDe(diasB) }}
          />
        )}
      </div>
    );
  }

  /* ---------------------------- Semana y Mes ---------------------------- */
  const dias = diasDelRango(detalleDesde, detalleHasta, filas, descansos, hoy);
  const t = totalesDe(dias);
  const hayDatos = t.diasTrabajados > 0;
  // Un día de descanso no es un hueco: no falta nada por subir.
  const huecos = dias.filter((d) => !d.cargado && !d.descanso && d.fecha <= hoy).length;

  // Las semanas del gráfico: en «Semana», las últimas ocho hasta la elegida; en «Mes», las del mes.
  const semanas =
    vista === "semana"
      ? semanasDe(
          diasDelRango(lunesDeLasUltimas(semana, SEMANAS_A_LA_VISTA)[0], finSemana, filas, descansos, hoy),
          lunesDeLaSemana,
        )
      : semanasDe(dias, lunesDeLaSemana);

  return (
    <div className="mx-auto flex max-w-[880px] flex-col gap-4">
      {encabezado}

      {vista === "semana" ? (
        <SelectorDeSemana semana={semana} alCambiar={setSemana} />
      ) : (
        <SelectorDeMes mes={mes} alCambiar={setMes} />
      )}

      <Cifras
        datos={[
          { etiqueta: "Pedidos", valor: String(t.pedidos) },
          { etiqueta: "Soles", valor: (t.centimos / 100).toFixed(2) },
          { etiqueta: "Días trabajados", valor: String(t.diasTrabajados) },
          { etiqueta: "Promedio por día", valor: t.promedioPorDia.toFixed(1), pie: "ped." },
        ]}
      />

      {vista === "semana" && (
        <div className="tarjeta">
          <GraficoDias dias={dias} />
        </div>
      )}

      <div className="tarjeta">
        <GraficoSemanas
          semanas={semanas}
          elegida={vista === "semana" ? semana : undefined}
          titulo={vista === "semana" ? "Semana a semana" : `Semanas de ${nombreDelMes(mes)}`}
          alElegir={(lunes) => {
            setSemana(lunes);
            setVista("semana");
          }}
        />
      </div>

      {huecos > 0 && (
        <Aviso tono="atento" titulo={`${huecos} día${huecos === 1 ? "" : "s"} sin carga en el rango`}>
          <p>
            Un hueco no es un día sin trabajo. Súbelo y las cifras se recalculan; si no trabajaste, márcalo como
            descanso en Pagos.
          </p>
        </Aviso>
      )}

      {!hayDatos ? (
        <Vacio>No hay jornadas cargadas en este rango.</Vacio>
      ) : (
        <>
          {vista === "mes" && (
            <Acordeon titulo="Día por día" resumen={`${t.diasTrabajados} días con carga`}>
              <GraficoDias dias={dias} />
            </Acordeon>
          )}
          <DetalleDelRango
            jornadas={jornadas}
            dias={dias}
            regla={regla}
            driver={perfil?.nombre ?? ""}
            desde={detalleDesde}
            hasta={detalleHasta}
          />
        </>
      )}
    </div>
  );
}

/**
 * El detalle de un rango de días —una semana o un mes—: Tiempos, Ingresos, Por
 * distancia, Récords y Exportar, en acordeones cerrados que dicen su dato clave.
 */
function DetalleDelRango({
  jornadas,
  dias,
  regla,
  driver,
  desde,
  hasta,
}: {
  jornadas: JornadaCompleta[];
  dias: DiaGrafico[];
  regla: ReglaPago;
  driver: string;
  desde: FechaISO;
  hasta: FechaISO;
}) {
  const cargados = dias.filter((d) => d.cargado);
  const t = totalesDe(dias);
  const { pedidos: totalPedidos, rutas: totalRutas, minutos: totalMinutos, centimos: totalCentimos } = t;
  const totalFuera = t.fueraTramo1;
  const promedioDia = t.promedioPorDia;
  const centimosPorDia = t.centimosPorDia;
  const centimosPorPedido = t.centimosPorPedido;

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
  const porTramo = [...regla.tramos.map((tr) => tr.id), TRAMO_MAS_DE_12_KM]
    .map((id) => ({ id, cuantos: ordenes.filter((o) => o.tramo === id).length }))
    .filter((tr) => tr.id !== TRAMO_MAS_DE_12_KM || tr.cuantos > 0);
  const masCuantos = Math.max(1, ...porTramo.map((tr) => tr.cuantos));
  const conKm = ordenes.filter((o) => o.km !== null);
  const kmMedio = conKm.length ? conKm.reduce((s, o) => s + (o.km ?? 0), 0) / conKm.length : 0;
  const kmMaximo = conKm.length ? Math.max(...conKm.map((o) => o.km ?? 0)) : 0;

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
    <>
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
          {porTramo.map((tr) => (
            <div key={tr.id} className="grid grid-cols-[42px_1fr_auto] items-center gap-2.5 text-sm">
              <span className="font-mono text-xs">{tr.id === TRAMO_MAS_DE_12_KM ? "+12 km" : `T${tr.id}`}</span>
              <div className="h-3 overflow-hidden rounded-full bg-linea">
                <div className="h-full rounded-full bg-acento" style={{ width: `${(tr.cuantos / masCuantos) * 100}%` }} />
              </div>
              <b className="font-mono text-xs">{tr.cuantos}</b>
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
          driver={driver}
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
    </>
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
