"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";

import Link from "next/link";

import { BotonesExportar } from "@/components/BotonesExportar";
import { Aviso, ChipTramo, EstadoPedido, Vacio } from "@/components/ui";
import { useDatos } from "@/hooks/useDatos";
import { buscarPedidos, jornadasPorRango, reglaVigente } from "@/lib/db/sqlite/jornadas";
import { listarTiendas, perfilActual } from "@/lib/db/sqlite/perfil";
import { horasDePermanencia } from "@/lib/pagos/reglas";
import { montoDelDia } from "@/lib/pagos/calcular-liquidacion";
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
 * Presentación elegida tras comparar tres alternativas en el prototipo: la
 * **tabla**. Todas las columnas de §11 siempre visibles, cabecera fija,
 * subtotal por día y total del rango. En celular se desplaza de lado dentro de
 * su propio contenedor; la página nunca se mueve en horizontal.
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
  const vista = params.get("vista") === "dia" ? "dia" : "pedidos";
  const buscado = (params.get("buscar") ?? "").trim();

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

  // La numeración corrida se calcula antes de pintar: mutar un contador dentro
  // del JSX rompe si React vuelve a ejecutar el render.
  const numeroDeOrden = new Map<string, number>();
  let contador = 0;
  for (const j of jornadas) {
    for (const o of j.ordenes) {
      contador += 1;
      numeroDeOrden.set(o.id, contador);
    }
  }

  return (
    <div className="mx-auto flex max-w-[1180px] flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h2 className="text-[30px] leading-tight">Historial</h2>
        <div className="inline-grid grid-flow-col gap-[3px] rounded-btn bg-sup-2 p-[3px]">
          {(["dia", "pedidos"] as const).map((v) => (
            <Link
              key={v}
              href={`/historial?rango=${rango}&vista=${v}`}
              aria-selected={vista === v}
              className={`flex min-h-[38px] items-center justify-center rounded-[11px] px-4 text-sm ${
                vista === v ? "bg-sup font-bold" : "font-medium text-tinta-2"
              }`}
            >
              {v === "dia" ? "Por día" : "Pedidos"}
            </Link>
          ))}
        </div>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-0.5">
        {RANGOS.map((r) => (
          <Link
            key={r.id}
            href={`/historial?rango=${r.id}&vista=${vista}`}
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

      {/* §10, utilidades — la consulta de "la tienda me pregunta por este
          pedido": dice en qué fecha fue, en qué ruta y con qué horario. */}
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
      ) : vista === "pedidos" ? (
        <div className="overflow-x-auto rounded-card bg-sup">
          <table className="tabla min-w-[700px]">
            <thead>
              <tr>
                <th className="num">N°</th>
                <th>Fecha</th>
                <th>Código de pedido</th>
                <th className="num">Ruta</th>
                <th>Horario de ruta</th>
                <th>Estado</th>
                <th>Tramo</th>
                <th className="num">Monto</th>
              </tr>
            </thead>
            <tbody>
              {jornadas.map((j) => {
                const horarios = new Map(
                  j.rutas.map((r) => [r.numero, `${r.horaInicio ?? "--:--"}–${r.horaFin ?? "--:--"}`]),
                );
                const cobroDia = cobroDe(j);
                const montoDia = cobroDia.pagadoCentimos;
                return [
                  ...j.ordenes.map((o) => {
                    return (
                      <tr key={o.id}>
                        <td className="num">{numeroDeOrden.get(o.id)}</td>
                        <td className="whitespace-nowrap">{formatearFecha(j.fecha)}</td>
                        <td>
                          <span className="codigo">{o.codigo}</span>
                        </td>
                        <td className="num">{o.ruta ?? "—"}</td>
                        <td>
                          <span className="codigo whitespace-nowrap">
                            {o.ruta !== null ? (horarios.get(o.ruta) ?? "—") : "—"}
                          </span>
                        </td>
                        <td>
                          <EstadoPedido estado={o.estado} />
                        </td>
                        <td>
                          <ChipTramo tramo={o.tramo} />
                        </td>
                        <td className="num">{formatearSoles(o.montoCentimos ?? 0)}</td>
                      </tr>
                    );
                  }),
                  <tr key={`sub-${j.id}`} className="subtotal">
                    <td colSpan={7}>
                      <Link href={`/jornada?fecha=${j.fecha}`} className="hover:text-acento">
                        Subtotal {nombreDelDia(j.fecha)} {formatearFecha(j.fecha)} ·{" "}
                        {j.ordenes.length} pedidos · {j.rutas.length} rutas
                      </Link>
                    </td>
                    <td className="num">
                      {formatearSoles(montoDia)}
                      {cobroDia.pagaPor === "permanencia" && (
                        <span className="block text-[10px] font-normal text-tinta-3">
                          piso por permanencia
                        </span>
                      )}
                    </td>
                  </tr>,
                ];
              })}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={7}>Total del rango · {totales.pedidos} pedidos</td>
                <td className="num">{formatearSoles(totales.centimos)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {todosLosDias.map((fecha) => {
            const j = porFecha.get(fecha);
            if (!j) {
              return (
                <div
                  key={fecha}
                  className="flex items-center gap-3 rounded-card border border-dashed border-linea px-4 py-3"
                >
                  <span className="flex w-[86px] shrink-0 flex-col">
                    <b className="text-sm font-bold capitalize">{nombreDelDia(fecha).slice(0, 3)}</b>
                    <span className="font-mono text-xs text-tinta-3">{formatearFecha(fecha)}</span>
                  </span>
                  <span className="text-xs text-tinta-3">
                    {diasEntre(hoy, fecha) > 0 ? "Aún no ocurre" : "Sin carga"}
                  </span>
                </div>
              );
            }
            const minutos = j.rutas.reduce((s, r) => s + (r.duracionMin ?? 0), 0);
            const monto = cobroDe(j).pagadoCentimos;
            return (
              <Link
                key={fecha}
                href={`/jornada?fecha=${fecha}`}
                className="flex items-center gap-3 rounded-card border border-linea bg-sup px-4 py-3 hover:bg-sup-2"
              >
                <span className="flex w-[86px] shrink-0 flex-col">
                  <b className="text-sm font-bold capitalize">{nombreDelDia(fecha).slice(0, 3)}</b>
                  <span className="font-mono text-xs text-tinta-3">{formatearFecha(fecha)}</span>
                </span>
                <span className="flex min-w-0 flex-1 flex-wrap gap-4 text-xs text-tinta-2">
                  <span>
                    <i className="font-mono font-medium text-tinta not-italic">
                      {j.ordenes.length}
                    </i>{" "}
                    pedidos
                  </span>
                  <span>
                    <i className="font-mono font-medium text-tinta not-italic">{j.rutas.length}</i>{" "}
                    rutas
                  </span>
                  <span>
                    <i className="font-mono font-medium text-tinta not-italic">
                      {formatearDuracion(minutos)}
                    </i>{" "}
                    en ruta
                  </span>
                </span>
                <span className="monto text-sm">{formatearSoles(monto)}</span>
              </Link>
            );
          })}
        </div>
      )}

      <BotonesExportar datos={datosExportacion} />
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
      <div className="overflow-x-auto rounded-card bg-sup">
        <table className="tabla min-w-[560px]">
          <thead>
            <tr>
              <th>Código</th>
              <th>Fecha</th>
              <th className="num">Ruta</th>
              <th>Horario de ruta</th>
              <th>Estado</th>
              <th className="num">Monto</th>
            </tr>
          </thead>
          <tbody>
            {encontrados.map((p) => (
              <tr key={`${p.fecha}-${p.codigo}`}>
                <td>
                  <span className="codigo">{p.codigo}</span>
                </td>
                <td className="whitespace-nowrap">
                  <Link href={`/jornada?fecha=${p.fecha}`} className="hover:text-acento">
                    {nombreDelDia(p.fecha).slice(0, 3)} {formatearFecha(p.fecha)}
                  </Link>
                </td>
                <td className="num">{p.ruta ?? "—"}</td>
                <td>
                  <span className="codigo whitespace-nowrap">
                    {p.horaInicio && p.horaFin ? `${p.horaInicio}–${p.horaFin}` : "—"}
                  </span>
                </td>
                <td>
                  <EstadoPedido estado={p.estado} />
                </td>
                <td className="num">{formatearSoles(p.montoCentimos ?? 0)}</td>
              </tr>
            ))}
          </tbody>
        </table>
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
