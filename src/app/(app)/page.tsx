"use client";

import { useState } from "react";
import Link from "next/link";

import { Acordeon } from "@/components/Acordeon";
import { CargarCapturas } from "@/components/CargarCapturas";
import { usePuedeEscribir } from "@/components/Licencia";
import { Flecha, Reloj } from "@/components/iconos";
import { MontoHero, TiraSemana } from "@/components/ui";
import { useDatos } from "@/hooks/useDatos";
import { resumenPorRango } from "@/lib/db/sqlite/jornadas";
import {
  formatearDuracion,
  formatearFecha,
  formatearFechaLarga,
  hoyEnLima,
  nombreDelDia,
  rangoDeFechas,
  semanaDe,
  sumarDias,
  type FechaISO,
} from "@/lib/fechas";
import { formatearSoles } from "@/lib/pagos/reglas";

/**
 * Inicio (§9).
 *
 * El principio de §1 sigue siendo "una sola acción diaria": el botón de cargar
 * manda y está siempre a la vista. Lo demás se reordenó porque la pantalla
 * enseñaba el día, la semana, los avisos y los enlaces a la vez, y quien la
 * abría no sabía dónde mirar.
 *
 * Dos decisiones detrás de esta disposición:
 *
 *   · **La fecha se elige arriba y no manda sobre la carga.** Se consulta un
 *     día cualquiera sin que eso cambie lo que se va a subir: las capturas
 *     traen su propia fecha dentro. Atarlas al día elegido sería una trampa
 *     silenciosa —subir el lunes las del domingo lo guardaría mal.
 *
 *   · **Plegado, pero con lo esencial fuera.** Cada sección enseña su cifra
 *     aunque esté cerrada, para no obligar a abrir solo para mirar.
 */
export default function PaginaInicio() {
  const hoy = hoyEnLima();
  const [dia, setDia] = useState<FechaISO>(hoy);
  const puedeCargar = usePuedeEscribir();

  const semana = semanaDe(dia);

  const { datos: filas, cargando } = useDatos(
    () => resumenPorRango(sumarDias(hoy, -60), semana.fin),
    [hoy, semana.fin],
  );

  if (cargando || !filas) return <Esqueleto />;

  const porFecha = new Map(filas.map((f) => [f.fecha, f]));
  const delDia = porFecha.get(dia);

  const deLaSemana = rangoDeFechas(semana.inicio, semana.fin).map((fecha) => {
    const f = porFecha.get(fecha);
    return { fecha, cargado: Boolean(f), pedidos: f?.pedidos ?? 0 };
  });

  const cargadas = deLaSemana.filter((d) => d.cargado);
  const totalSemana = cargadas.reduce(
    (acc, d) => {
      const f = porFecha.get(d.fecha)!;
      return {
        pedidos: acc.pedidos + f.pedidos,
        rutas: acc.rutas + f.rutas,
        centimos: acc.centimos + f.montoCentimos,
      };
    },
    { pedidos: 0, rutas: 0, centimos: 0 },
  );

  const faltantes = deLaSemana.filter((d) => !d.cargado && d.fecha < hoy);

  return (
    <div className="mx-auto flex max-w-[880px] flex-col gap-4">
      <SelectorDeDia dia={dia} hoy={hoy} alElegir={setDia} cargadas={porFecha} />

      <CargarCapturas deshabilitado={!puedeCargar} />

      <Acordeon
        titulo={dia === hoy ? "Hoy" : nombreDelDia(dia) + " " + formatearFecha(dia)}
        resumen={
          delDia
            ? `${delDia.pedidos} pedidos · ${delDia.rutas} rutas · ${formatearSoles(delDia.montoCentimos)}`
            : "Sin cargar"
        }
        abiertoPorDefecto
      >
        {delDia ? (
          <div className="flex flex-col gap-3">
            <MontoHero
              centimos={delDia.montoCentimos}
              pie={`${delDia.pedidos} pedidos en ${delDia.rutas} rutas`}
            />
            <dl className="flex flex-col text-sm">
              <Dato etiqueta="Tiempo en ruta" valor={formatearDuracion(delDia.minutosEnRuta)} />
              <Dato etiqueta="Primera salida" valor={delDia.primeraSalida ?? "—"} />
              <Dato etiqueta="Último regreso" valor={delDia.ultimoRegreso ?? "—"} />
              {delDia.horaEntrada && delDia.horaSalida && (
                <Dato
                  etiqueta="En tienda"
                  valor={`${delDia.horaEntrada} a ${delDia.horaSalida}`}
                />
              )}
            </dl>
            <Link
              href={`/jornada?fecha=${dia}`}
              className="inline-flex min-h-11 items-center gap-2 self-start text-sm font-semibold text-acento"
            >
              Ver y corregir el detalle
              <Flecha className="size-4" />
            </Link>
          </div>
        ) : (
          <p className="text-sm text-tinta-2">
            {dia === hoy
              ? "Todavía no has subido las capturas de hoy."
              : "Ese día no está cargado. Puedes subirlo cuando quieras: manda la fecha de la captura, no la de hoy."}
          </p>
        )}
      </Acordeon>

      <Acordeon
        titulo="Esta semana"
        resumen={`${formatearSoles(totalSemana.centimos)} · ${cargadas.length} de 7 días`}
      >
        <div className="flex flex-col gap-4">
          <MontoHero
            centimos={totalSemana.centimos}
            pie={`${totalSemana.pedidos} pedidos · ${totalSemana.rutas} rutas`}
          />
          <TiraSemana dias={deLaSemana} hoy={hoy} />
          <div className="flex items-center gap-2 text-sm text-tinta-2">
            <Reloj className="size-4" />
            <span>Se paga el viernes {formatearFecha(semana.pago)}</span>
          </div>
          {faltantes.length > 0 && (
            <p className="rounded-btn bg-aviso-suave px-3 py-2 text-sm text-aviso">
              Falta{faltantes.length === 1 ? "" : "n"}{" "}
              {faltantes.map((d) => nombreDelDia(d.fecha)).join(", ")}.
            </p>
          )}
        </div>
      </Acordeon>

      <Acordeon titulo="Ver más" resumen="Historial, pagos y estadísticas">
        <div className="flex flex-col gap-2">
          <FilaEnlace href="/historial" titulo="Historial" detalle="Todos tus días y pedidos" />
          <FilaEnlace href="/pagos" titulo="Pagos" detalle="Semanas, cierres y conciliación" />
          <FilaEnlace
            href="/estadisticas"
            titulo="Estadísticas"
            detalle="Pedidos, tiempos e ingresos"
          />
        </div>
      </Acordeon>
    </div>
  );
}

/**
 * Elegir qué día se está mirando.
 *
 * Los últimos siete días como fichas —que es lo que se consulta el 95 % de las
 * veces— y un calendario al lado para ir más atrás sin pelearse con flechas.
 * Un punto bajo la ficha indica que ese día ya está cargado, así se ve de un
 * vistazo lo que falta sin abrir nada.
 */
function SelectorDeDia({
  dia,
  hoy,
  alElegir,
  cargadas,
}: {
  dia: FechaISO;
  hoy: FechaISO;
  alElegir: (f: FechaISO) => void;
  cargadas: Map<string, unknown>;
}) {
  const ultimos = rangoDeFechas(sumarDias(hoy, -6), hoy);

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-end justify-between gap-3">
        <h2 className="text-[26px] leading-tight capitalize">{formatearFechaLarga(dia)}</h2>
        <label className="shrink-0">
          <span className="sr-only">Elegir otra fecha</span>
          <input
            type="date"
            value={dia}
            max={hoy}
            onChange={(e) => e.target.value && alElegir(e.target.value as FechaISO)}
            className="min-h-11 rounded-btn border border-linea-fuerte bg-sup px-3 text-sm"
          />
        </label>
      </div>

      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
        {ultimos.map((fecha) => {
          const elegido = fecha === dia;
          return (
            <button
              key={fecha}
              type="button"
              onClick={() => alElegir(fecha)}
              aria-pressed={elegido}
              className={`flex min-h-[58px] w-[52px] shrink-0 flex-col items-center justify-center gap-0.5 rounded-btn border text-xs ${
                elegido
                  ? "border-acento bg-acento text-acento-texto"
                  : "border-linea bg-sup-2 text-tinta-2"
              }`}
            >
              <span className="capitalize">{nombreDelDia(fecha).slice(0, 3)}</span>
              <b className="text-base font-semibold">{fecha.slice(8)}</b>
              <span
                aria-hidden
                className={`size-1.5 rounded-full ${
                  cargadas.has(fecha)
                    ? elegido
                      ? "bg-acento-texto"
                      : "bg-acento"
                    : "bg-transparent"
                }`}
              />
            </button>
          );
        })}
      </div>
    </div>
  );
}

function Dato({ etiqueta, valor }: { etiqueta: string; valor: string }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-linea py-2 last:border-0">
      <dt className="text-tinta-2">{etiqueta}</dt>
      <dd className="font-medium">{valor}</dd>
    </div>
  );
}

function FilaEnlace({
  href,
  titulo,
  detalle,
}: {
  href: string;
  titulo: string;
  detalle: string;
}) {
  return (
    <Link
      href={href}
      className="flex min-h-[56px] items-center justify-between gap-3 rounded-btn bg-sup px-4 py-3"
    >
      <span className="flex min-w-0 flex-col">
        <b className="text-sm font-semibold">{titulo}</b>
        <span className="text-sm text-tinta-2">{detalle}</span>
      </span>
      <Flecha className="size-4 shrink-0 text-tinta-3" />
    </Link>
  );
}

function Esqueleto() {
  return (
    <div className="mx-auto flex max-w-[880px] animate-pulse flex-col gap-4" aria-hidden>
      <div className="h-8 w-56 rounded bg-sup-2" />
      <div className="h-[58px] rounded-btn bg-sup-2" />
      <div className="h-[92px] rounded-card bg-sup-2" />
      <div className="h-[72px] rounded-card bg-sup-2" />
      <div className="h-[72px] rounded-card bg-sup-2" />
    </div>
  );
}
