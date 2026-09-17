import Link from "next/link";

import { Aviso, ChipTramo, EstadoPedido, Vacio } from "@/components/ui";
import { Hoja } from "@/components/iconos";
import { jornadasPorRango } from "@/lib/db/jornadas";
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

export const metadata = { title: "Historial" };
export const dynamic = "force-dynamic";

/**
 * Historial (§11).
 *
 * Presentación elegida tras comparar tres alternativas en el prototipo: la
 * **tabla**. Todas las columnas de §11 siempre visibles, cabecera fija,
 * subtotal por día y total del rango. En celular se desplaza de lado dentro de
 * su propio contenedor; la página nunca se mueve en horizontal.
 */

const RANGOS = [
  { id: "semana", etiqueta: "Esta semana" },
  { id: "pasada", etiqueta: "Semana pasada" },
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

export default async function PaginaHistorial({
  searchParams,
}: {
  searchParams: Promise<{ rango?: string; vista?: string }>;
}) {
  const params = await searchParams;
  const rango = (RANGOS.find((r) => r.id === params.rango)?.id ?? "semana") as IdRango;
  const vista = params.vista === "dia" ? "dia" : "pedidos";

  const hoy = hoyEnLima();
  const [desde, hasta] = limites(rango, hoy);
  const jornadas = await jornadasPorRango(desde, hasta);

  const porFecha = new Map(jornadas.map((j) => [j.fecha, j]));
  const todosLosDias = rangoDeFechas(desde, hasta);
  const huecos = todosLosDias.filter((f) => !porFecha.has(f) && f <= hoy);

  const totales = jornadas.reduce(
    (acc, j) => ({
      pedidos: acc.pedidos + j.ordenes.length,
      rutas: acc.rutas + j.rutas.length,
      centimos: acc.centimos + j.ordenes.reduce((s, o) => s + (o.montoCentimos ?? 0), 0),
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
                const montoDia = j.ordenes.reduce((s, o) => s + (o.montoCentimos ?? 0), 0);
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
                      Subtotal {nombreDelDia(j.fecha)} {formatearFecha(j.fecha)} ·{" "}
                      {j.ordenes.length} pedidos · {j.rutas.length} rutas
                    </td>
                    <td className="num">{formatearSoles(montoDia)}</td>
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
            const monto = j.ordenes.reduce((s, o) => s + (o.montoCentimos ?? 0), 0);
            return (
              <div
                key={fecha}
                className="flex items-center gap-3 rounded-card border border-linea bg-sup px-4 py-3"
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
              </div>
            );
          })}
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        <button type="button" className="boton-sec flex-1" disabled>
          <Hoja className="size-4" />
          Exportar Excel
        </button>
        <button type="button" className="boton-sec flex-1" disabled>
          <Hoja className="size-4" />
          Exportar PDF
        </button>
      </div>
      <p className="text-xs text-tinta-3">
        La exportación a Excel y PDF llega en la Fase 2. Los botones quedan a la vista para que la
        pantalla sea la definitiva.
      </p>
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
