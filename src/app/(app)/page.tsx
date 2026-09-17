import Link from "next/link";

import { CargarCapturas } from "@/components/CargarCapturas";
import { Alerta, Flecha, Reloj } from "@/components/iconos";
import { Aviso, MontoHero, TiraSemana } from "@/components/ui";
import { resumenPorRango } from "@/lib/db/jornadas";
import {
  formatearDuracion,
  formatearFecha,
  formatearFechaLarga,
  hoyEnLima,
  nombreDelDia,
  rangoDeFechas,
  semanaDe,
  sumarDias,
} from "@/lib/fechas";
import { formatearSoles } from "@/lib/pagos/reglas";
import { perfilActual, puedeCargarJornadas } from "@/lib/supabase/servidor";

export const metadata = { title: "Hoy" };
export const dynamic = "force-dynamic";

/**
 * Hoy (§9).
 *
 * El principio rector de §1 es "una sola acción diaria". Por eso esta pantalla
 * tiene un único botón grande y todo lo demás es consulta.
 */
export default async function PaginaHoy() {
  const hoy = hoyEnLima();
  const semana = semanaDe(hoy);
  const perfil = await perfilActual();

  // Se pide un mes largo de una vez: sirve para la semana en curso y para
  // encontrar la última jornada cargada sin una segunda consulta.
  const desde = sumarDias(hoy, -45);
  const filas = await resumenPorRango(desde, semana.fin);
  const porFecha = new Map(filas.map((f) => [f.fecha, f]));

  const deLaSemana = rangoDeFechas(semana.inicio, semana.fin).map((fecha) => {
    const f = porFecha.get(fecha);
    return { fecha, cargado: Boolean(f), pedidos: f?.pedidos ?? 0 };
  });

  const cargadasSemana = deLaSemana.filter((d) => d.cargado);
  const totalSemana = cargadasSemana.reduce(
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

  const jornadaDeHoy = porFecha.get(hoy);
  const ultima = filas.filter((f) => f.fecha <= hoy).at(-1);
  const faltantes = deLaSemana.filter((d) => !d.cargado && d.fecha < hoy);
  const puedeCargar = perfil ? puedeCargarJornadas(perfil, hoy) : false;

  return (
    <div className="mx-auto flex max-w-[880px] flex-col gap-4">
      <div>
        <span className="rotulo">Hoy</span>
        <h2 className="text-[30px] leading-tight capitalize">{formatearFechaLarga(hoy)}</h2>
        <p className="mt-0.5 text-sm text-tinta-2">
          {jornadaDeHoy
            ? `${jornadaDeHoy.pedidos} pedidos en ${jornadaDeHoy.rutas} rutas · ${formatearDuracion(jornadaDeHoy.minutosEnRuta)} en ruta.`
            : "Todavía no has subido las capturas de hoy."}
        </p>
      </div>

      <CargarCapturas deshabilitado={!puedeCargar} />

      {faltantes.length > 0 && (
        <Aviso
          tono="atento"
          titulo={`Falta ${faltantes.length === 1 ? "un día" : `${faltantes.length} días`} de esta semana`}
        >
          <p>
            {faltantes.map((d) => `${nombreDelDia(d.fecha)} ${formatearFecha(d.fecha)}`).join(", ")}.
            Puedes subirlo cuando quieras: manda la fecha de la captura, no la de carga.
          </p>
        </Aviso>
      )}

      <div className="grid gap-4 md:grid-cols-2 md:items-start">
        <div className="tarjeta flex flex-col gap-4">
          <div className="flex items-end justify-between gap-3">
            <MontoHero
              centimos={totalSemana.centimos}
              pie={`${totalSemana.pedidos} pedidos · ${totalSemana.rutas} rutas · ${cargadasSemana.length} día${cargadasSemana.length === 1 ? "" : "s"}`}
            />
            <span className="inline-flex items-center rounded-chip bg-acento-suave px-2 py-0.5 text-[10px] font-bold tracking-wide text-acento-tinta uppercase">
              abierta
            </span>
          </div>
          <TiraSemana dias={deLaSemana} hoy={hoy} />
          <div className="flex items-center gap-2 text-sm text-tinta-2">
            <Reloj className="size-4" />
            <span>Se paga el viernes {formatearFecha(semana.pago)}</span>
          </div>
        </div>

        <div className="flex flex-col gap-3">
          {ultima && (
            <FilaEnlace
              href="/historial"
              titulo={`Última jornada · ${nombreDelDia(ultima.fecha)} ${formatearFecha(ultima.fecha)}`}
              detalle={`${ultima.pedidos} pedidos · ${ultima.rutas} rutas · ${formatearDuracion(ultima.minutosEnRuta)} en ruta`}
              valor={formatearSoles(ultima.montoCentimos)}
            />
          )}
          <FilaEnlace
            href="/pagos"
            titulo="Pagos"
            detalle="Semana en curso, cierres y conciliación"
          />
          <FilaEnlace
            href="/estadisticas"
            titulo="Últimos 30 días"
            detalle="Pedidos, tiempos e ingresos"
          />
        </div>
      </div>

      {filas.length === 0 && (
        <div className="flex gap-3 rounded-btn bg-sup-2 px-4 py-3 text-sm text-tinta-2">
          <Alerta className="mt-0.5 size-[18px] shrink-0 text-tinta-3" />
          <p>
            Todavía no hay ninguna jornada guardada. Sube las capturas de tu último día de reparto y
            aparecerá aquí.
          </p>
        </div>
      )}
    </div>
  );
}

function FilaEnlace({
  href,
  titulo,
  detalle,
  valor,
}: {
  href: string;
  titulo: string;
  detalle: string;
  valor?: string;
}) {
  return (
    <Link
      href={href}
      className="flex items-center justify-between gap-3 rounded-card bg-sup-2 px-4 py-3 hover:brightness-[.98]"
    >
      <span className="flex min-w-0 flex-col">
        <b className="text-sm font-semibold">{titulo}</b>
        <span className="text-sm text-tinta-2">{detalle}</span>
      </span>
      <span className="flex shrink-0 items-center gap-2">
        {valor && <span className="monto text-sm">{valor}</span>}
        <Flecha className="size-4 text-tinta-3" />
      </span>
    </Link>
  );
}
