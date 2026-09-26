"use client";

import { useState } from "react";
import Link from "next/link";

import { AccionesSemana } from "@/components/AccionesSemana";
import { Acordeon } from "@/components/Acordeon";
import { DueloDePago } from "@/components/DueloDePago";
import { Alerta, Calendario, Check, Flecha, Luna, Reloj } from "@/components/iconos";
import { PanelDeDescansos } from "@/components/PanelDeDescansos";
import { TiraDeSemanas } from "@/components/TiraDeSemanas";
import { Aviso } from "@/components/ui";
import { useDatos } from "@/hooks/useDatos";
import { useTiraDeSemanas } from "@/hooks/useTiraDeSemanas";
import { marcarDescanso, quitarDescanso } from "@/lib/db/sqlite/descansos";
import { reglaVigente } from "@/lib/db/sqlite/jornadas";
import { liquidacionDeSemana } from "@/lib/db/sqlite/liquidaciones";
import { perfilActual } from "@/lib/db/sqlite/perfil";
import type { SemanaLiquidada } from "@/lib/db/tipos";
import {
  formatearDuracion,
  formatearFecha,
  hoyEnLima,
  nombreDelDia,
  rangoDeFechas,
  semanaDe,
  sumarDias,
  type FechaISO,
} from "@/lib/fechas";
import type { DetalleDia } from "@/lib/pagos/calcular-liquidacion";
import { formatearSoles } from "@/lib/pagos/reglas";

/**
 * Pagos (§13).
 *
 * La semana va de lunes a domingo (America/Lima) y se paga el viernes
 * siguiente al corte. Aquí vive **todo lo acumulado**: la misma barra de
 * semanas de Inicio, con lo que se cobró cada día; debajo, el total de la
 * semana elegida y cuatro acordeones cerrados —Día por día, Cobro, Tarifa
 * vigente y Otras semanas— que dicen su dato clave sin abrirse.
 *
 * La semana en curso se recalcula al vuelo; las anteriores muestran lo
 * congelado al cerrarlas.
 */

const NUMERO_DE_SEMANAS = 9;

export default function PaginaPagos() {
  const hoy = hoyEnLima();
  const actual = semanaDe(hoy).inicio;

  const [inicio, setInicio] = useState<FechaISO>(actual);
  // El día del que se mira el detalle. Sin ninguno, se ve la semana entera.
  const [dia, setDia] = useState<FechaISO | null>(null);
  const [abiertos, setAbiertos] = useState<Record<string, boolean>>({});

  const semana = semanaDe(inicio);
  const esActual = semana.inicio === actual;

  const { datos: tira, recargar: recargarTira } = useTiraDeSemanas(semana.inicio, hoy);

  const { datos, recargar: recargarSemana } = useDatos(
    async () => {
      const perfil = await perfilActual();
      // En la semana en curso, «faltan» solo cuenta hasta hoy; en una pasada, la semana entera.
      const s = await liquidacionDeSemana(semana.inicio, esActual ? hoy : undefined);
      const { regla } = await reglaVigente(semana.fin, perfil?.tiendaId ?? null, perfil?.vehiculo);
      return { s, regla };
    },
    [semana.inicio],
    // Marcar un descanso recarga la pantalla; sin conservar, pasaría por el
    // esqueleto y el aviso de «marcaste 2 días» se perdería con él. Y al
    // cambiar de semana se conserva lo de antes: la barra no puede vaciarse a
    // mitad de un arrastre.
    { conservar: true, entreCambios: true },
  );

  const { datos: otras, recargar: recargarOtras } = useDatos(
    () =>
      Promise.all(
        Array.from({ length: NUMERO_DE_SEMANAS }, (_, b) =>
          liquidacionDeSemana(sumarDias(actual, -7 * b), b === 0 ? hoy : undefined),
        ),
      ),
    [actual],
    { conservar: true },
  );

  function recargar() {
    recargarTira();
    recargarSemana();
    recargarOtras();
  }

  function abrir(id: string, valor = true) {
    setAbiertos((a) => ({ ...a, [id]: valor }));
  }

  function elegirDia(fecha: FechaISO) {
    // Tocar el día que ya estaba elegido lo suelta: vuelve a verse la semana entera.
    if (fecha === dia) {
      setDia(null);
      return;
    }
    setDia(fecha);
    abrir("dias");
  }

  if (!tira || !datos || !otras) return <Esqueleto />;
  const { s: elegida, regla } = datos;
  const liquidacion = elegida.liquidacion;

  const porDia = new Map(liquidacion.detalle.porDia.map((d) => [d.fecha, d]));
  const faltan = liquidacion.diasSinCarga;
  const cargados = porDia.size;
  const fueraTramo1 = Object.entries(liquidacion.ordenesPorTramo)
    .filter(([tramo]) => Number(tramo) > 1)
    .reduce((s, [, cantidad]) => s + cantidad, 0);
  const sinTarifa = liquidacion.pedidosSinTarifa.length;
  const diasDeLaSemana = rangoDeFechas(semana.inicio, semana.fin);

  return (
    <div className="mx-auto flex max-w-[880px] flex-col gap-4">
      <div className="flex flex-col gap-3">
        <div className="flex items-end justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-[24px] leading-tight">
              Sem. {Number(semana.inicio.slice(8, 10))}–{Number(semana.fin.slice(8, 10))}
            </h2>
            <p className="text-xs text-tinta-3">
              {formatearFecha(semana.inicio).slice(0, 5)} – {formatearFecha(semana.fin).slice(0, 5)} · {cargados} de 7 días
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            {!esActual && (
              <button
                type="button"
                onClick={() => {
                  setInicio(actual);
                  setDia(null);
                }}
                className="min-h-11 px-2 text-xs font-bold text-acento-tinta underline underline-offset-2"
              >
                Volver a hoy
              </button>
            )}
            {/* Para ir directo a un día y ver su detalle acumulado. */}
            <label className="relative grid size-11 place-items-center rounded-btn border border-linea-fuerte bg-sup">
              <span className="sr-only">Elegir un día</span>
              <Calendario className="size-5" />
              <input
                type="date"
                value={dia ?? semana.inicio}
                max={hoy}
                onChange={(e) => {
                  const v = e.target.value as FechaISO;
                  if (!v) return;
                  setInicio(semanaDe(v).inicio);
                  setDia(v);
                  abrir("dias");
                }}
                onClick={(e) => {
                  try {
                    e.currentTarget.showPicker();
                  } catch {
                    /* Algunos navegadores solo lo abren con un toque directo en el campo. */
                  }
                }}
                className="absolute inset-0 cursor-pointer opacity-0"
              />
            </label>
          </div>
        </div>

        <TiraDeSemanas
          semana={semana.inicio}
          dia={dia}
          hoy={hoy}
          modo="pagos"
          datos={tira}
          alElegirDia={elegirDia}
          alMoverSemana={(delta) => {
            setInicio((i) => {
              const siguiente = sumarDias(i, delta * 7);
              return siguiente > actual ? actual : siguiente;
            });
            setDia(null);
          }}
        />
      </div>

      {/* El total de la semana elegida. */}
      <section className="tarjeta flex flex-col gap-1.5" aria-label="Total de la semana">
        <div className="flex items-center justify-between gap-2">
          <span className="rotulo !text-tinta-2">
            Sem. {Number(semana.inicio.slice(8, 10))}–{Number(semana.fin.slice(8, 10))}
          </span>
          <EstadoDeLaSemana semana={elegida} termino={semana.fin < hoy} />
        </div>
        <span className="font-display text-[42px] leading-none font-bold tracking-tight text-acento tabular-nums [zoom:var(--zoom-titulo,1)]">
          {formatearSoles(liquidacion.montoCalculadoCentimos)}
        </span>
        <span className="text-sm text-tinta-2">
          {liquidacion.totalOrdenes} pedidos · {liquidacion.totalRutas} rutas
          {fueraTramo1 > 0 && ` · ${fueraTramo1} fuera del tramo 1`}
        </span>
        <div className="mt-1.5 grid grid-cols-7 gap-1" aria-label={`${cargados} de 7 días cargados`}>
          {diasDeLaSemana.map((f) => (
            <i
              key={f}
              className={`h-[5px] rounded-full ${
                porDia.has(f) ? "bg-acento" : liquidacion.diasDescanso.includes(f) ? "bg-descanso" : "bg-linea"
              }`}
            />
          ))}
        </div>
        <div className="mt-2 flex items-center gap-2 border-t border-linea pt-2.5 text-sm text-tinta-2">
          <Reloj className="size-[18px] shrink-0" />
          <span>{textoDePago(elegida, semana.pago, hoy)}</span>
        </div>
      </section>

      {/* Lo que falta, a la vista sin abrir nada. */}
      {faltan.length > 0 && (
        <button
          type="button"
          onClick={() => abrir("dias")}
          className="flex w-full items-center gap-3 rounded-btn bg-aviso-suave px-4 py-3 text-left text-sm text-aviso"
        >
          <Alerta className="size-[18px] shrink-0" />
          <span className="flex-1">
            <b className="block">
              Falta{faltan.length === 1 ? "" : "n"} {faltan.length} día{faltan.length === 1 ? "" : "s"} por subir
            </b>
            Toca para subirlos o marcarlos como descanso
          </span>
          <Flecha className="size-4 shrink-0" />
        </button>
      )}

      <Acordeon
        titulo="Día por día"
        resumen={`${cargados} de 7 días${faltan.length > 0 ? ` · faltan ${faltan.length}` : ""}`}
        aviso={faltan.length > 0}
        abierto={!!abiertos.dias}
        alCambiar={(a) => abrir("dias", a)}
      >
        {/* Los días sin cargar: se suben, o se dice que no se trabajaron. */}
        <PanelDeDescansos faltan={faltan} descansos={liquidacion.diasDescanso} alCambiar={recargar} />

        <div className="flex flex-col gap-2">
          {diasDeLaSemana.map((f) => (
            <FilaDeDia
              key={f}
              fecha={f}
              hoy={hoy}
              detalle={porDia.get(f) ?? null}
              descanso={liquidacion.diasDescanso.includes(f)}
              elegido={dia === f}
              alPulsar={() => setDia((d) => (d === f ? null : f))}
              alCambiar={recargar}
            />
          ))}
        </div>
      </Acordeon>

      <Acordeon
        titulo="Cobro"
        resumen={
          elegida.estado === "pagada"
            ? `Pagada · anotaste ${formatearSoles(elegida.montoRecibidoCentimos ?? 0)}`
            : esActual
              ? "Semana en curso"
              : sinTarifa > 0
                ? `${sinTarifa} pedido${sinTarifa === 1 ? "" : "s"} sin tarifa`
                : "Anota lo que te pagaron"
        }
        aviso={sinTarifa > 0}
        abierto={!!abiertos.cobro}
        alCambiar={(a) => abrir("cobro", a)}
      >
        <dl className="flex flex-col">
          <Dato etiqueta="Se paga el" valor={`viernes ${formatearFecha(semana.pago)}`} />
          <Dato etiqueta="Tiempo en ruta" valor={formatearDuracion(liquidacion.minutosEnRuta)} />
          {liquidacion.diasConGarantia > 0 && (
            <>
              <Dato etiqueta="Solo por pedidos habría sido" valor={formatearSoles(liquidacion.montoPorPedidosCentimos)} />
              <Dato etiqueta="Días cubiertos por la permanencia" valor={String(liquidacion.diasConGarantia)} />
            </>
          )}
        </dl>

        {sinTarifa > 0 && (
          <Aviso tono="mal" titulo={`${sinTarifa} pedido(s) sin tarifa`}>
            <p className="font-mono text-xs">{liquidacion.pedidosSinTarifa.map((p) => p.codigo).join(", ")}</p>
            <p>
              Son de más de 12 km, que la tarifa de la tienda no cubre. Ponles un monto a mano desde el pedido antes de
              cerrar la semana.
            </p>
          </Aviso>
        )}

        <AccionesSemana
          semanaInicio={semana.inicio}
          estado={elegida.estado}
          montoCalculadoCentimos={liquidacion.montoCalculadoCentimos}
          montoRecibidoCentimos={elegida.montoRecibidoCentimos}
          alCambiar={recargar}
        />
      </Acordeon>

      <Acordeon
        titulo="Tarifa vigente"
        resumen="Por tramo de distancia y garantía"
        abierto={!!abiertos.tarifa}
        alCambiar={(a) => abrir("tarifa", a)}
      >
        <table className="tabla">
          <thead>
            <tr>
              <th>Tramo</th>
              <th>Distancia</th>
              <th className="num">Por pedido</th>
            </tr>
          </thead>
          <tbody>
            {regla.tramos.map((t) => (
              <tr key={t.id}>
                <td>{t.id}</td>
                <td>
                  {t.desde} a {t.hasta} km
                </td>
                <td className="num">{formatearSoles(Math.round(t.monto * 100))}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="text-xs text-tinta-3">
          Se paga cada pedido, entregado o no: el recorrido se hizo igual. El estado solo cuenta para las estadísticas.
        </p>

        {regla.garantiaPermanencia?.activa && (
          <div className="flex flex-col gap-1 border-t border-linea pt-3">
            <span className="rotulo">Garantía por permanencia</span>
            <p className="text-xs text-tinta-2">
              La tienda paga <b>{formatearSoles(Math.round(regla.garantiaPermanencia.solesPorHora * 100))} por hora</b> de
              permanencia. Cada día se paga <b>el mayor</b> de los dos: lo que sumen tus pedidos o lo que sume la
              permanencia. No se suman. Las horas se cuentan completas: salir a las 21:30 cuenta como 12 h, no 12.5.
            </p>
          </div>
        )}
      </Acordeon>

      <Acordeon
        titulo="Otras semanas"
        resumen="Toca una para verla"
        abierto={!!abiertos.semanas}
        alCambiar={(a) => abrir("semanas", a)}
      >
        <div className="overflow-hidden rounded-card border border-linea bg-sup">
          {otras.map((o) => (
            <FilaSemana
              key={o.liquidacion.semana.inicio}
              semana={o}
              hoy={hoy}
              elegida={o.liquidacion.semana.inicio === semana.inicio}
              alPulsar={() => {
                setInicio(o.liquidacion.semana.inicio);
                setDia(null);
                window.scrollTo({ top: 0, behavior: "smooth" });
              }}
            />
          ))}
        </div>
      </Acordeon>
    </div>
  );
}

/** En curso, por cobrar o pagada. Con icono y texto: nunca solo color (§9). */
function EstadoDeLaSemana({ semana, termino }: { semana: SemanaLiquidada; termino: boolean }) {
  if (semana.estado === "pagada") {
    return (
      <span className="inline-flex items-center gap-1 rounded-chip bg-bien-suave px-2 py-0.5 text-[10px] font-bold tracking-wide text-bien uppercase">
        <Check className="size-3" />
        Pagada
      </span>
    );
  }
  return termino ? (
    <span className="inline-flex items-center gap-1 rounded-chip bg-aviso-suave px-2 py-0.5 text-[10px] font-bold tracking-wide text-aviso uppercase">
      <Reloj className="size-3" />
      Por cobrar
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 rounded-chip bg-acento-suave px-2 py-0.5 text-[10px] font-bold tracking-wide text-acento-tinta uppercase">
      <Reloj className="size-3" />
      En curso
    </span>
  );
}

function textoDePago(semana: SemanaLiquidada, pago: FechaISO, hoy: FechaISO): string {
  const dia = `viernes ${formatearFecha(pago)}`;
  if (semana.estado === "pagada") return `Pagada · ${dia}`;
  if (pago === hoy) return "Se paga hoy";
  if (pago === sumarDias(hoy, 1)) return `Se paga mañana · ${dia}`;
  if (pago < hoy) return `Se pagó el ${dia} · falta anotar el cobro`;
  return `Se paga el ${dia}`;
}

/**
 * Un día de la semana, con su cobro. Se abre para ver de dónde salió: cuántos
 * pedidos, cuántas rutas, cuánto tiempo en ruta, y si cobró por pedidos o por
 * la permanencia —«compiten, no se suman»—.
 */
function FilaDeDia({
  fecha,
  hoy,
  detalle,
  descanso,
  elegido,
  alPulsar,
  alCambiar,
}: {
  fecha: FechaISO;
  hoy: FechaISO;
  detalle: DetalleDia | null;
  descanso: boolean;
  elegido: boolean;
  alPulsar: () => void;
  alCambiar: () => void;
}) {
  const futuro = fecha > hoy;
  const nombre = nombreDelDia(fecha).slice(0, 3);
  const [ocupado, setOcupado] = useState(false);

  async function alternarDescanso() {
    setOcupado(true);
    try {
      if (descanso) await quitarDescanso([fecha]);
      else await marcarDescanso([fecha]);
      alCambiar();
    } finally {
      setOcupado(false);
    }
  }

  const texto = detalle
    ? `${detalle.pedidos} pedidos · ${detalle.rutas} rutas${detalle.pagaPor === "permanencia" ? " · cubierto por permanencia" : ""}`
    : descanso
      ? "Descanso"
      : futuro
        ? "Todavía no llega"
        : "Sin cargar";

  return (
    <div className={`overflow-hidden rounded-card border bg-sup ${elegido ? "border-acento" : "border-linea"}`}>
      <button
        type="button"
        onClick={alPulsar}
        disabled={futuro}
        aria-expanded={elegido}
        className="grid min-h-14 w-full grid-cols-[42px_1fr_auto] items-center gap-2 px-3 py-2 text-left disabled:opacity-60"
      >
        <span className="flex flex-col leading-tight">
          <b className="text-sm capitalize">{nombre}</b>
          <span className="font-mono text-xs text-tinta-3">{fecha.slice(8)}</span>
        </span>
        <span className="flex items-center gap-1 text-[12.5px] leading-snug text-tinta-2">
          {descanso && !detalle && <Luna className="size-3.5 shrink-0" />}
          {texto}
        </span>
        <span className="flex items-center gap-1.5 font-mono text-[13px] font-bold">
          {detalle ? formatearSoles(detalle.montoCentimos) : "—"}
          {!futuro && (
            <Flecha className={`size-4 text-tinta-3 transition-transform ${elegido ? "-rotate-90" : "rotate-90"}`} />
          )}
        </span>
      </button>

      {elegido && (
        <div className="flex flex-col gap-3 border-t border-linea px-3 py-3">
          {detalle ? (
            <>
              <div className="grid grid-cols-3 gap-2 text-center">
                <Cifra valor={String(detalle.pedidos)} etiqueta="pedidos" />
                <Cifra valor={String(detalle.rutas)} etiqueta="rutas" />
                <Cifra valor={detalle.minutosEnRuta > 0 ? formatearDuracion(detalle.minutosEnRuta) : "—"} etiqueta="en ruta" />
              </div>
              {detalle.horasPermanencia > 0 ? (
                <DueloDePago
                  pedidosCentimos={detalle.montoPedidosCentimos}
                  permanenciaCentimos={detalle.montoPermanenciaCentimos}
                  horas={detalle.horasPermanencia}
                />
              ) : (
                <p className="text-xs text-tinta-3">Sin horario en tienda ese día: se cobra por pedidos.</p>
              )}
              <Link href={`/?dia=${fecha}`} className="inline-flex min-h-11 items-center gap-2 self-start text-sm font-semibold text-acento">
                Abrir este día en Inicio
                <Flecha className="size-4" />
              </Link>
            </>
          ) : descanso ? (
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm text-tinta-2">Dijiste que no trabajaste este día.</p>
              <button type="button" className="boton-sec" disabled={ocupado} onClick={() => void alternarDescanso()}>
                Quitar el descanso
              </button>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              <p className="text-sm text-tinta-2">Este día no tiene nada guardado.</p>
              <div className="grid grid-cols-2 gap-2">
                <Link href={`/?dia=${fecha}`} className="boton-sec">
                  Subir el día
                </Link>
                <button type="button" className="boton-sec" disabled={ocupado} onClick={() => void alternarDescanso()}>
                  <Luna className="size-4" />
                  No trabajé
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Cifra({ valor, etiqueta }: { valor: string; etiqueta: string }) {
  return (
    <div className="flex flex-col rounded-btn bg-sup-2 px-1 py-2">
      <b className="font-display text-lg leading-tight [zoom:var(--zoom-titulo,1)]">{valor}</b>
      <span className="text-[11.5px] font-semibold text-tinta-2">{etiqueta}</span>
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

function FilaSemana({
  semana,
  hoy,
  elegida,
  alPulsar,
}: {
  semana: SemanaLiquidada;
  hoy: FechaISO;
  elegida: boolean;
  alPulsar: () => void;
}) {
  const { liquidacion, estado, montoRecibidoCentimos } = semana;
  const diferencia =
    montoRecibidoCentimos === null ? null : montoRecibidoCentimos - liquidacion.montoCalculadoCentimos;

  return (
    <button
      type="button"
      onClick={alPulsar}
      className={`flex min-h-[60px] w-full items-center gap-3 border-b border-linea px-4 py-3 text-left last:border-b-0 ${
        elegida ? "bg-acento-suave" : ""
      }`}
    >
      <span className="flex min-w-0 flex-1 flex-col gap-px">
        <b className="font-mono text-sm font-medium">
          {formatearFecha(liquidacion.semana.inicio).slice(0, 5)} – {formatearFecha(liquidacion.semana.fin).slice(0, 5)}
        </b>
        <span className="text-xs text-tinta-3">
          {liquidacion.totalOrdenes} pedidos · pago {formatearFecha(liquidacion.semana.pago).slice(0, 5)}
        </span>
      </span>
      <span className="flex flex-col items-end gap-1">
        <span className="monto text-sm">{formatearSoles(liquidacion.montoCalculadoCentimos)}</span>
        {diferencia !== null && diferencia !== 0 ? (
          <span className="inline-flex items-center gap-1 rounded-chip bg-aviso-suave px-2 py-0.5 text-[10px] font-bold tracking-wide text-aviso uppercase">
            <Alerta className="size-3" />
            {diferencia < 0 ? "−" : "+"}
            {(Math.abs(diferencia) / 100).toFixed(2)}
          </span>
        ) : (
          <EstadoDeLaSemana semana={semana} termino={liquidacion.semana.fin < hoy && estado !== "pagada"} />
        )}
      </span>
    </button>
  );
}

/** Mientras la base responde. Son milisegundos, pero el blanco asusta. */
function Esqueleto() {
  return (
    <div className="mx-auto flex max-w-[880px] animate-pulse flex-col gap-4" aria-hidden>
      <div className="h-8 w-40 rounded bg-sup-2" />
      <div className="h-[66px] rounded-btn bg-sup-2" />
      <div className="h-[180px] rounded-card bg-sup-2" />
      <div className="h-[62px] rounded-card bg-sup-2" />
      <div className="h-[62px] rounded-card bg-sup-2" />
    </div>
  );
}
