"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import Link from "next/link";

import { Acordeon } from "@/components/Acordeon";
import { BotonesExportar } from "@/components/BotonesExportar";
import { FilaPedidoSimple } from "@/components/FilaPedidoSimple";
import { Pestanas } from "@/components/Pestanas";
import { Aviso, EstadoPedido, Vacio } from "@/components/ui";
import { useDatos } from "@/hooks/useDatos";
import { buscarPedidos, esCodigoPendiente, jornadasPorRango, reglaVigente } from "@/lib/db/sqlite/jornadas";
import { listarTiendas, perfilActual } from "@/lib/db/sqlite/perfil";
import { horasDePermanencia } from "@/lib/pagos/reglas";
import { montoDelDia } from "@/lib/pagos/calcular-liquidacion";
import type { JornadaCompleta } from "@/lib/db/tipos";
import type { DatosExportacion } from "@/lib/exportar/datos";
import {
  diasEntre,
  formatearDuracion,
  formatearFecha,
  hoyEnLima,
  lunesDeLaSemana,
  nombreDelDia,
  rangoDeFechas,
  sumarDias,
  type FechaISO,
} from "@/lib/fechas";
import { formatearSoles } from "@/lib/pagos/reglas";

/**
 * Historial (§11).
 *
 * Dos vistas en pestañas, una a la vez:
 *
 *   · **Por día** — las semanas del rango como acordeones cerrados; cada uno
 *     dice cuántos pedidos y cuánto sumó sin abrirlo, y dentro van sus días.
 *   · **Pedidos** — cada pedido como una fila, agrupados por día.
 *
 * El rango, la vista y el código buscado viven en la URL: al volver de un día
 * se está donde se estaba. Exportar va en un acordeón al final: lo que se baja
 * es exactamente lo filtrado en pantalla.
 */

const RANGOS = [
  { id: "semana", etiqueta: "Esta sem." },
  { id: "pasada", etiqueta: "Sem. pasada" },
  { id: "mes", etiqueta: "Este mes" },
  { id: "anterior", etiqueta: "Mes pasado" },
] as const;

type IdRango = (typeof RANGOS)[number]["id"];

function limites(id: IdRango, hoy: FechaISO): [FechaISO, FechaISO] {
  const lunes = lunesDeLaSemana(hoy);
  if (id === "pasada") return [sumarDias(lunes, -7), sumarDias(lunes, -1)];
  if (id === "mes") return [`${hoy.slice(0, 8)}01`, hoy];
  if (id === "anterior") {
    const finAnterior = sumarDias(`${hoy.slice(0, 8)}01`, -1);
    return [`${finAnterior.slice(0, 8)}01`, finAnterior];
  }
  return [lunes, sumarDias(lunes, 6)];
}

/* `useSearchParams` obliga a envolver en Suspense: el filtro viene de la URL y
   Next necesita saber qué pintar mientras la resuelve. */
export default function PaginaHistorial() {
  return (
    <Suspense fallback={<Esqueleto />}>
      <Contenido />
    </Suspense>
  );
}

function Contenido() {
  const params = useSearchParams();
  const rango = (RANGOS.find((r) => r.id === params.get("rango"))?.id ?? "semana") as IdRango;
  const vista = params.get("vista") === "pedidos" ? "pedidos" : "dia";
  const buscado = (params.get("buscar") ?? "").trim();
  const router = useRouter();
  const irA = (r: IdRango, v: "dia" | "pedidos") => router.replace(`/historial?rango=${r}&vista=${v}`);

  const hoy = hoyEnLima();
  const [desde, hasta] = limites(rango, hoy);

  const { datos } = useDatos(async () => {
    const [jornadas, perfil, tiendas] = await Promise.all([
      jornadasPorRango(desde, hasta),
      perfilActual(),
      listarTiendas(),
    ]);
    const { regla } = await reglaVigente(hasta, perfil?.tiendaId ?? null, perfil?.vehiculo);
    const nombreTienda = tiendas.find((x) => x.id === perfil?.tiendaId)?.nombre ?? null;
    return { jornadas, perfil, regla, nombreTienda };
  }, [desde, hasta]);

  if (!datos) return <Esqueleto />;
  const { jornadas, perfil, regla, nombreTienda } = datos;

  /* Lo que se cobra por un día: el mayor entre los pedidos y el piso de
     permanencia. La misma función que usa la liquidación, para que el
     historial no diga una cifra y Pagos otra. */
  const cobroDe = (j: (typeof jornadas)[number]) =>
    montoDelDia(
      j.ordenes.reduce((s, o) => s + (o.montoCentimos ?? 0), 0),
      regla,
      j.horaEntrada,
      j.horaSalida,
    );

  /* Los datos del archivo se arman aquí y el celular genera el Excel o el PDF.
     Se exporta exactamente lo que está filtrado en pantalla (§11). */
  const datosExportacion: DatosExportacion = {
    driver: perfil?.nombre ?? "",
    tienda: nombreTienda,
    desde,
    hasta,
    jornadas: jornadas.map((j) => {
      const horarios = new Map(
        j.rutas.map((r) => [r.numero, `${r.horaInicio ?? "--:--"}–${r.horaFin ?? "--:--"}`]),
      );
      const cobro = cobroDe(j);
      const montoPedidos = cobro.pedidosCentimos;
      const permanencia = cobro.permanenciaCentimos;
      return {
        fecha: j.fecha,
        rutas: j.rutas.map((r) => ({
          numero: r.numero,
          horaInicio: r.horaInicio,
          horaFin: r.horaFin,
          duracionMin: r.duracionMin,
          pedidos: j.ordenes.filter((o) => o.ruta === r.numero).length,
        })),
        pedidos: j.ordenes.map((o) => ({
          posicion: o.posicion,
          codigo: o.codigo,
          ruta: o.ruta,
          horarioRuta: o.ruta !== null ? (horarios.get(o.ruta) ?? null) : null,
          estado: o.estado,
          tramo: o.tramo,
          km: o.km,
          montoCentimos: o.montoCentimos ?? 0,
        })),
        minutosEnRuta: j.rutas.reduce((s, r) => s + (r.duracionMin ?? 0), 0),
        montoPedidosCentimos: montoPedidos,
        montoPermanenciaCentimos: permanencia,
        montoCentimos: cobro.pagadoCentimos,
        horasPermanencia: horasDePermanencia(j.horaEntrada, j.horaSalida),
        pagaPor: permanencia > montoPedidos ? ("permanencia" as const) : ("pedidos" as const),
      };
    }),
  };

  const porFecha = new Map(jornadas.map((j) => [j.fecha, j]));
  const todosLosDias = rangoDeFechas(desde, hasta);
  const huecos = todosLosDias.filter((f) => !porFecha.has(f) && f <= hoy);

  const totales = jornadas.reduce(
    (acc, j) => ({
      pedidos: acc.pedidos + j.ordenes.length,
      rutas: acc.rutas + j.rutas.length,
      centimos: acc.centimos + cobroDe(j).pagadoCentimos,
    }),
    { pedidos: 0, rutas: 0, centimos: 0 },
  );

  // Los días del rango agrupados por semana (lunes a domingo), en orden.
  const semanas: Array<{ lunes: FechaISO; dias: FechaISO[] }> = [];
  for (const f of todosLosDias) {
    const lunes = lunesDeLaSemana(f);
    const ultima = semanas[semanas.length - 1];
    if (ultima?.lunes === lunes) ultima.dias.push(f);
    else semanas.push({ lunes, dias: [f] });
  }

  return (
    <div className="mx-auto flex max-w-[880px] flex-col gap-4">
      <h2 className="text-[30px] leading-tight">Historial</h2>

      <Pestanas
        etiqueta="Vista del historial"
        actual={vista}
        alCambiar={(id) => irA(rango, id === "pedidos" ? "pedidos" : "dia")}
        items={[
          { id: "dia", etiqueta: "Por día" },
          { id: "pedidos", etiqueta: "Pedidos", cuenta: totales.pedidos },
        ]}
      />

      <div className="flex gap-2 overflow-x-auto pb-0.5" role="group" aria-label="Rango">
        {RANGOS.map((r) => (
          <button
            key={r.id}
            type="button"
            onClick={() => irA(r.id, vista)}
            aria-pressed={rango === r.id}
            className={`inline-flex min-h-9 shrink-0 items-center rounded-chip px-3 text-sm whitespace-nowrap ${
              rango === r.id
                ? "bg-acento font-semibold text-acento-texto"
                : "border border-linea-fuerte bg-sup text-tinta-2"
            }`}
          >
            {r.etiqueta}
          </button>
        ))}
      </div>

      {/* §10, utilidades — la consulta de "la tienda me pregunta por este
          pedido": dice en qué fecha fue, en qué ruta y con qué horario. Para
          buscar por cliente, teléfono o dirección está la pantalla Buscar. */}
      <form method="get" action="/historial" className="flex flex-wrap gap-2">
        <input type="hidden" name="rango" value={rango} />
        <input type="hidden" name="vista" value={vista} />
        <input
          type="search"
          name="buscar"
          defaultValue={buscado}
          placeholder="Buscar un pedido por su código"
          aria-label="Buscar un pedido por su código"
          className="min-h-11 min-w-48 flex-1 rounded-btn border border-linea-fuerte bg-sup px-4 font-mono text-base"
        />
        <button type="submit" className="boton-sec">
          Buscar
        </button>
        {buscado !== "" && (
          <Link href={`/historial?rango=${rango}&vista=${vista}`} className="boton-sec">
            Limpiar
          </Link>
        )}
      </form>

      {buscado !== "" && <ResultadosBusqueda texto={buscado} />}

      <div className="grid grid-cols-2 gap-3 rounded-card bg-sup-2 px-4 py-3 sm:grid-cols-4">
        <Resumen etiqueta="Pedidos" valor={String(totales.pedidos)} />
        <Resumen etiqueta="Rutas" valor={String(totales.rutas)} />
        <Resumen etiqueta="Días" valor={String(jornadas.length)} />
        <Resumen etiqueta="Monto" valor={formatearSoles(totales.centimos)} />
      </div>

      {huecos.length > 0 && (
        <Aviso
          tono="atento"
          titulo={`${huecos.length} día${huecos.length === 1 ? "" : "s"} sin carga en el rango`}
        >
          <p>No se cuentan como días sin trabajo. Súbelos y los totales se recalculan.</p>
        </Aviso>
      )}

      {jornadas.length === 0 ? (
        <Vacio>No hay pedidos en este rango.</Vacio>
      ) : vista === "dia" ? (
        <div className="flex flex-col gap-3">
          {semanas.map((sem) => {
            const delaSemana = sem.dias.map((f) => porFecha.get(f)).filter((j) => j !== undefined);
            const pedidos = delaSemana.reduce((s, j) => s + j.ordenes.length, 0);
            const monto = delaSemana.reduce((s, j) => s + cobroDe(j).pagadoCentimos, 0);
            const fin = sem.dias[sem.dias.length - 1];
            return (
              <Acordeon
                key={sem.lunes}
                titulo={`${formatearFecha(sem.dias[0]).slice(0, 5)} – ${formatearFecha(fin).slice(0, 5)}`}
                resumen={
                  pedidos === 0
                    ? "Sin carga"
                    : `${pedidos} pedidos · ${delaSemana.length} día${delaSemana.length === 1 ? "" : "s"} · ${formatearSoles(monto)}`
                }
              >
                <div className="-my-4 flex flex-col">
                  {sem.dias.map((fecha) => {
                    const j = porFecha.get(fecha);
                    return j ? (
                      <FilaDeDia key={fecha} fecha={fecha} j={j} monto={cobroDe(j).pagadoCentimos} />
                    ) : (
                      <FilaDeDiaVacio key={fecha} fecha={fecha} futuro={diasEntre(hoy, fecha) > 0} />
                    );
                  })}
                </div>
              </Acordeon>
            );
          })}
        </div>
      ) : (
        <ListaDePedidos
          jornadas={jornadas}
          horarioDe={(j, ruta) => {
            const r = j.rutas.find((x) => x.numero === ruta);
            return r?.horaInicio ?? null;
          }}
          montoDe={(j) => cobroDe(j).pagadoCentimos}
          alAbrir={(fecha) => router.push(`/?dia=${fecha}`)}
        />
      )}

      <Acordeon
        titulo="Exportar"
        resumen={`Excel o PDF de ${formatearFecha(desde).slice(0, 5)} a ${formatearFecha(hasta).slice(0, 5)}`}
      >
        <BotonesExportar datos={datosExportacion} />
      </Acordeon>
    </div>
  );
}

type Jornadas = JornadaCompleta[];

/** Un día con carga: qué se hizo y cuánto rindió. Lleva al detalle de ese día. */
function FilaDeDia({ fecha, j, monto }: { fecha: FechaISO; j: Jornadas[number]; monto: number }) {
  const minutos = j.rutas.reduce((s, r) => s + (r.duracionMin ?? 0), 0);
  return (
    <Link
      href={`/?dia=${fecha}`}
      className="flex items-center gap-3 border-b border-linea py-3 last:border-b-0 hover:bg-sup-2"
    >
      <span className="flex w-[70px] shrink-0 flex-col">
        <b className="text-sm font-bold capitalize">{nombreDelDia(fecha).slice(0, 3)}</b>
        <span className="font-mono text-xs text-tinta-3">{formatearFecha(fecha).slice(0, 5)}</span>
      </span>
      <span className="flex min-w-0 flex-1 flex-wrap gap-x-3 gap-y-0.5 text-xs text-tinta-2">
        <span>
          <i className="font-mono font-medium text-tinta not-italic">{j.ordenes.length}</i> pedidos
        </span>
        <span>
          <i className="font-mono font-medium text-tinta not-italic">{j.rutas.length}</i> rutas
        </span>
        <span>
          <i className="font-mono font-medium text-tinta not-italic">{formatearDuracion(minutos)}</i> en ruta
        </span>
      </span>
      <span className="monto text-sm">{formatearSoles(monto)}</span>
    </Link>
  );
}

function FilaDeDiaVacio({ fecha, futuro }: { fecha: FechaISO; futuro: boolean }) {
  return (
    <div className="flex items-center gap-3 border-b border-linea py-3 last:border-b-0">
      <span className="flex w-[70px] shrink-0 flex-col">
        <b className="text-sm font-bold capitalize">{nombreDelDia(fecha).slice(0, 3)}</b>
        <span className="font-mono text-xs text-tinta-3">{formatearFecha(fecha).slice(0, 5)}</span>
      </span>
      <span className="text-xs text-tinta-3">{futuro ? "Aún no ocurre" : "Sin carga"}</span>
    </div>
  );
}

const PEDIDOS_POR_PAGINA = 40;

/**
 * Cada pedido del rango como una fila, agrupado por día. Tocar uno lleva a su
 * día, donde se puede corregir. Son muchos, así que se enseñan por tandas.
 */
function ListaDePedidos({
  jornadas,
  horarioDe,
  montoDe,
  alAbrir,
}: {
  jornadas: Jornadas;
  horarioDe: (j: Jornadas[number], ruta: number) => string | null;
  montoDe: (j: Jornadas[number]) => number;
  alAbrir: (fecha: FechaISO) => void;
}) {
  const [visibles, setVisibles] = useState(PEDIDOS_POR_PAGINA);
  const total = jornadas.reduce((s, j) => s + j.ordenes.length, 0);

  // Cuántos pedidos de cada día caben en lo que se ve: se calcula antes de pintar.
  const cortes: number[] = [];
  let restantes = visibles;
  for (const j of jornadas) {
    const ver = Math.min(j.ordenes.length, restantes);
    cortes.push(ver);
    restantes -= ver;
  }

  return (
    <div className="flex flex-col gap-3">
      {jornadas.map((j, i) =>
        cortes[i] === 0 ? null : (
          <section key={j.id} className="flex flex-col gap-1.5">
            <div className="flex items-baseline justify-between gap-3 px-1">
              <span className="rotulo">
                {nombreDelDia(j.fecha).slice(0, 3)} {formatearFecha(j.fecha).slice(0, 5)} · {j.ordenes.length} pedidos
              </span>
              <span className="monto text-xs text-tinta-2">{formatearSoles(montoDe(j))}</span>
            </div>
            <div className="overflow-hidden rounded-card border border-linea bg-sup">
              {j.ordenes.slice(0, cortes[i]).map((o) => (
                <FilaPedidoSimple
                  key={o.id}
                  codigo={o.codigo}
                  ruta={o.ruta}
                  hora={o.ruta !== null ? horarioDe(j, o.ruta) : null}
                  estado={o.estado}
                  tramo={o.tramo}
                  monto={formatearSoles(o.montoCentimos ?? 0)}
                  manual={o.manual}
                  porCompletar={esCodigoPendiente(o.codigo)}
                  km={o.km}
                  cliente={o.cliente?.nombre ?? null}
                  conFoto={o.fotos > 0}
                  onClick={() => alAbrir(j.fecha)}
                />
              ))}
            </div>
          </section>
        ),
      )}
      {total > visibles && (
        <button type="button" className="boton-sec self-center" onClick={() => setVisibles((v) => v + PEDIDOS_POR_PAGINA)}>
          Ver más ({total - visibles} restantes)
        </button>
      )}
    </div>
  );
}

function Resumen({ etiqueta, valor }: { etiqueta: string; valor: string }) {
  return (
    <div className="flex min-w-0 flex-col gap-px">
      <span className="text-[10px] tracking-wide text-tinta-3 uppercase">{etiqueta}</span>
      <span className="font-mono text-sm font-medium tabular-nums">{valor}</span>
    </div>
  );
}

function ResultadosBusqueda({ texto }: { texto: string }) {
  const { datos: encontrados } = useDatos(
    () => (texto.length < 3 ? Promise.resolve([]) : buscarPedidos(texto)),
    [texto],
  );

  if (texto.length < 3) {
    return <Vacio>Escribe al menos tres caracteres del código.</Vacio>;
  }
  if (!encontrados) return null;
  if (encontrados.length === 0) {
    return <Vacio>Ningún pedido tuyo coincide con «{texto}».</Vacio>;
  }

  return (
    <section className="flex flex-col gap-2">
      <span className="rotulo">
        {encontrados.length} pedido{encontrados.length === 1 ? "" : "s"} con «{texto}»
      </span>
      <div className="overflow-hidden rounded-card border border-linea bg-sup">
        {encontrados.map((p) => (
          <Link
            key={`${p.fecha}-${p.codigo}`}
            href={`/?dia=${p.fecha}`}
            className="flex flex-col gap-1 border-b border-linea px-4 py-3 last:border-b-0 hover:bg-sup-2"
          >
            <span className="flex items-baseline justify-between gap-3">
              <span className="font-mono text-[15px] font-medium tracking-tight">{p.codigo}</span>
              <span className="monto text-xs text-tinta-2">{formatearSoles(p.montoCentimos ?? 0)}</span>
            </span>
            <span className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-tinta-2">
              <span>
                {nombreDelDia(p.fecha).slice(0, 3)} {formatearFecha(p.fecha)}
              </span>
              <span>{p.ruta === null ? "Sin ruta" : `Ruta ${p.ruta}`}</span>
              {p.horaInicio && p.horaFin && (
                <span className="font-mono">
                  {p.horaInicio}–{p.horaFin}
                </span>
              )}
              <EstadoPedido estado={p.estado} />
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}

function Esqueleto() {
  return (
    <div className="mx-auto flex max-w-[880px] animate-pulse flex-col gap-4" aria-hidden>
      <div className="h-8 w-44 rounded bg-sup-2" />
      <div className="h-11 rounded-btn bg-sup-2" />
      <div className="h-[420px] rounded-card bg-sup-2" />
    </div>
  );
}
