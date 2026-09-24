"use client";

import { AccionesSemana } from "@/components/AccionesSemana";
import { PanelDeDescansos } from "@/components/PanelDeDescansos";
import { Alerta, Check, Reloj } from "@/components/iconos";
import { Aviso, MontoHero, TiraSemana } from "@/components/ui";
import { useDatos } from "@/hooks/useDatos";
import { reglaVigente } from "@/lib/db/sqlite/jornadas";
import { perfilActual } from "@/lib/db/sqlite/perfil";
import { liquidacionDeSemana } from "@/lib/db/sqlite/liquidaciones";
import type { SemanaLiquidada } from "@/lib/db/tipos";
import {
  formatearDuracion,
  formatearFecha,
  hoyEnLima,
  nombreDelDia,
  rangoDeFechas,
  sumarDias,
} from "@/lib/fechas";
import { formatearSoles } from "@/lib/pagos/reglas";


/**
 * Pagos (§13).
 *
 * La semana va de lunes a domingo (America/Lima) y se paga el viernes
 * siguiente al corte. La semana en curso se recalcula al vuelo; las anteriores
 * muestran lo congelado al cerrarlas.
 */
export default function PaginaPagos() {
  const hoy = hoyEnLima();

  const { datos, recargar } = useDatos(
    async () => {
    const [enCurso, ...anteriores] = await Promise.all([
      liquidacionDeSemana(hoy, hoy),
      liquidacionDeSemana(sumarDias(hoy, -7)),
      liquidacionDeSemana(sumarDias(hoy, -14)),
      liquidacionDeSemana(sumarDias(hoy, -21)),
    ]);

    const perfil = await perfilActual();
    const { regla } = await reglaVigente(hoy, perfil?.tiendaId ?? null, perfil?.vehiculo);

    return { enCurso, anteriores, regla };
    },
    [hoy],
    // Marcar un descanso recarga la pantalla; sin conservar, pasaría por el
    // esqueleto y el aviso de «marcaste 2 días» se perdería con él.
    { conservar: true },
  );

  if (!datos) return <Esqueleto />;
  const { enCurso, anteriores, regla } = datos;

  const diasSemana = rangoDeFechas(enCurso.liquidacion.semana.inicio, enCurso.liquidacion.semana.fin).map(
    (fecha) => {
      const dia = enCurso.liquidacion.detalle.porDia.find((d) => d.fecha === fecha);
      return {
        fecha,
        cargado: Boolean(dia),
        pedidos: dia?.pedidos ?? 0,
        descanso: !dia && enCurso.liquidacion.diasDescanso.includes(fecha),
      };
    },
  );

  const fueraTramo1 = Object.entries(enCurso.liquidacion.ordenesPorTramo)
    .filter(([tramo]) => Number(tramo) > 1)
    .reduce((s, [, cantidad]) => s + cantidad, 0);

  const faltan = enCurso.liquidacion.diasSinCarga;

  return (
    <div className="mx-auto flex max-w-[880px] flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h2 className="text-[30px] leading-tight">Pagos</h2>
        <span className="rotulo">Lunes a domingo</span>
      </div>

      <section className="overflow-hidden rounded-card">
        <div className="flex items-center justify-between gap-2 bg-acento px-4 py-2 text-xs font-bold tracking-wider text-acento-texto uppercase">
          <span>Sem. en curso</span>
          <span className="font-mono">
            {formatearFecha(enCurso.liquidacion.semana.inicio).slice(0, 5)} –{" "}
            {formatearFecha(enCurso.liquidacion.semana.fin).slice(0, 5)}
          </span>
        </div>
        <div className="flex flex-col gap-4 bg-sup-2 p-5">
          <MontoHero
            centimos={enCurso.liquidacion.montoCalculadoCentimos}
            pie={`${enCurso.liquidacion.totalOrdenes} pedidos · ${enCurso.liquidacion.totalRutas} rutas · ${fueraTramo1} fuera del tramo 1`}
          />
          <TiraSemana dias={diasSemana} hoy={hoy} />

          <dl className="flex flex-col">
            <Dato etiqueta="Se paga el" valor={`viernes ${formatearFecha(enCurso.liquidacion.semana.pago)}`} />
            <Dato etiqueta="Tiempo en ruta" valor={formatearDuracion(enCurso.liquidacion.minutosEnRuta)} />
            {enCurso.liquidacion.diasConGarantia > 0 && (
              <>
                <Dato
                  etiqueta="Solo por pedidos habría sido"
                  valor={formatearSoles(enCurso.liquidacion.montoPorPedidosCentimos)}
                />
                <Dato
                  etiqueta="Días cubiertos por la permanencia"
                  valor={String(enCurso.liquidacion.diasConGarantia)}
                />
              </>
            )}
          </dl>

          {/* §13 bis — la garantía es un piso, no un extra: cada día se paga el
              mayor de los dos. Verlo día a día es lo que sustenta un reclamo. */}
          {enCurso.liquidacion.diasConGarantia > 0 && (
            <div className="overflow-x-auto rounded-card bg-sup">
              <table className="tabla min-w-[420px]">
                <thead>
                  <tr>
                    <th>Día</th>
                    <th className="num">Pedidos</th>
                    <th className="num">Permanencia</th>
                    <th className="num">Cobras</th>
                  </tr>
                </thead>
                <tbody>
                  {enCurso.liquidacion.detalle.porDia.map((d) => (
                    <tr key={d.fecha}>
                      <td className="whitespace-nowrap capitalize">
                        {nombreDelDia(d.fecha).slice(0, 3)} {formatearFecha(d.fecha)}
                      </td>
                      <td
                        className={`num ${d.pagaPor === "permanencia" ? "text-tinta-3 line-through" : ""}`}
                      >
                        {formatearSoles(d.montoPedidosCentimos)}
                      </td>
                      <td
                        className={`num ${d.pagaPor === "pedidos" ? "text-tinta-3 line-through" : ""}`}
                      >
                        {d.horasPermanencia > 0
                          ? `${formatearSoles(d.montoPermanenciaCentimos)}`
                          : "—"}
                      </td>
                      <td className="num font-bold">{formatearSoles(d.montoCentimos)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Los días sin cargar: se suben, o se dice que no se trabajaron. */}
          <PanelDeDescansos
            faltan={faltan}
            descansos={enCurso.liquidacion.diasDescanso}
            alCambiar={recargar}
          />

          {enCurso.liquidacion.pedidosSinTarifa.length > 0 && (
            <Aviso
              tono="mal"
              titulo={`${enCurso.liquidacion.pedidosSinTarifa.length} pedido(s) sin tarifa`}
            >
              <p className="font-mono text-xs">
                {enCurso.liquidacion.pedidosSinTarifa.map((p) => p.codigo).join(", ")}
              </p>
              <p>
                Son de más de 12 km, que la tarifa de la tienda no cubre. Ponles un monto a mano
                desde la jornada antes de cerrar la semana.
              </p>
            </Aviso>
          )}

          <AccionesSemana
            semanaInicio={enCurso.liquidacion.semana.inicio}
            estado={enCurso.estado}
            montoCalculadoCentimos={enCurso.liquidacion.montoCalculadoCentimos}
            montoRecibidoCentimos={enCurso.montoRecibidoCentimos}
            alCambiar={recargar}
          />
        </div>
      </section>

      <div className="grid gap-4 md:grid-cols-2 md:items-start">
        <section>
          <span className="rotulo">Sem. anteriores</span>
          <div className="mt-2 flex flex-col gap-2">
            {anteriores.map((s) => (
              <FilaSemana key={s.liquidacion.semana.inicio} semana={s} />
            ))}
          </div>
        </section>

        <section className="tarjeta">
          <div className="mb-2 flex items-baseline justify-between">
            <span className="rotulo">Tarifa vigente</span>
          </div>
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
          <p className="mt-3 text-xs text-tinta-3">
            Se paga cada pedido, entregado o no: el recorrido se hizo igual. El estado solo cuenta
            para las estadísticas.
          </p>

          {regla.garantiaPermanencia?.activa && (
            <div className="mt-3 border-t border-linea pt-3">
              <span className="rotulo">Garantía por permanencia</span>
              <p className="mt-1 text-xs text-tinta-2">
                La tienda paga{" "}
                <b>
                  {formatearSoles(Math.round(regla.garantiaPermanencia.solesPorHora * 100))} por hora
                </b>{" "}
                de permanencia. Cada día se paga <b>el mayor</b> de los dos: lo que sumen tus
                pedidos o lo que sume la permanencia. No se suman. Las horas se cuentan completas:
                salir a las 21:30 cuenta como 12 h, no 12.5.
              </p>
            </div>
          )}
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

function FilaSemana({ semana }: { semana: SemanaLiquidada }) {
  const { liquidacion, estado, montoRecibidoCentimos } = semana;
  const diferencia =
    montoRecibidoCentimos === null ? null : montoRecibidoCentimos - liquidacion.montoCalculadoCentimos;

  return (
    <div className="flex items-center gap-3 rounded-card border border-linea bg-sup px-4 py-3">
      <span className="flex min-w-0 flex-1 flex-col gap-px">
        <b className="font-mono text-sm font-medium">
          {formatearFecha(liquidacion.semana.inicio)} – {formatearFecha(liquidacion.semana.fin)}
        </b>
        <span className="text-xs text-tinta-3">
          {liquidacion.totalOrdenes} pedidos · pago {formatearFecha(liquidacion.semana.pago)}
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
          <span
            className={`inline-flex items-center gap-1 rounded-chip px-2 py-0.5 text-[10px] font-bold tracking-wide uppercase ${
              estado === "pagada"
                ? "bg-bien-suave text-bien"
                : "bg-acento-suave text-acento-tinta"
            }`}
          >
            {estado === "pagada" ? <Check className="size-3" /> : <Reloj className="size-3" />}
            {estado}
          </span>
        )}
      </span>
    </div>
  );
}

/** Mientras la base responde. Son milisegundos, pero el blanco asusta. */
function Esqueleto() {
  return (
    <div className="mx-auto flex max-w-[880px] animate-pulse flex-col gap-4" aria-hidden>
      <div className="h-8 w-40 rounded bg-sup-2" />
      <div className="h-[280px] rounded-card bg-sup-2" />
      <div className="h-[88px] rounded-card bg-sup-2" />
      <div className="h-[88px] rounded-card bg-sup-2" />
    </div>
  );
}
