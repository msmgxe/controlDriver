import Link from "next/link";
import { notFound } from "next/navigation";

import { EditorJornada } from "@/components/EditorJornada";
import { Flecha } from "@/components/iconos";
import { Aviso } from "@/components/ui";
import { jornadaPorFecha, reglaVigente } from "@/lib/db/jornadas";
import { clienteServidor, perfilActual } from "@/lib/supabase/servidor";
import {
  esFechaISO,
  formatearFechaLarga,
  hoyEnLima,
  lunesDeLaSemana,
} from "@/lib/fechas";

export const dynamic = "force-dynamic";

/**
 * Detalle de una jornada (§9).
 *
 * Igual que Revisión, pero sobre datos ya guardados: se puede corregir el tramo
 * de un pedido, el horario de permanencia, o borrar el día entero.
 *
 * Si la semana está cerrada no se edita nada sin reabrirla antes (§13): el
 * monto liquidado está congelado y tocarlo por debajo dejaría el historial
 * diciendo una cosa y la liquidación otra.
 */
export default async function PaginaJornada({
  params,
}: {
  params: Promise<{ fecha: string }>;
}) {
  const { fecha } = await params;
  if (!esFechaISO(fecha)) notFound();

  const jornada = await jornadaPorFecha(fecha);
  if (!jornada) notFound();

  const perfil = await perfilActual();
  const { regla } = await reglaVigente(fecha, perfil?.tienda_id ?? null);

  const supabase = await clienteServidor();
  const { data: liquidacion } = await supabase
    .from("liquidaciones")
    .select("estado")
    .eq("semana_inicio", lunesDeLaSemana(fecha))
    .maybeSingle();

  const estadoSemana = (liquidacion?.estado as string | undefined) ?? "abierta";
  const editable = estadoSemana === "abierta";

  return (
    <div className="mx-auto flex max-w-[880px] flex-col gap-4">
      <Link
        href="/historial"
        className="inline-flex items-center gap-2 self-start text-sm text-tinta-2 hover:text-tinta"
      >
        <Flecha className="size-4 rotate-180" />
        Historial
      </Link>

      <div>
        <span className="rotulo">Jornada</span>
        <h2 className="text-[30px] leading-tight capitalize">{formatearFechaLarga(fecha)}</h2>
      </div>

      {!editable && (
        <Aviso tono="atento" titulo={`Esta semana está ${estadoSemana}`}>
          <p>
            El monto liquidado está congelado. Para corregir algo de este día, reabre la semana
            desde Pagos.
          </p>
        </Aviso>
      )}

      <EditorJornada
        fecha={fecha}
        jornada={{
          rutas: jornada.rutas,
          ordenes: jornada.ordenes,
          horaEntrada: jornada.horaEntrada,
          horaSalida: jornada.horaSalida,
        }}
        regla={regla}
        editable={editable}
        esHoy={fecha === hoyEnLima()}
      />
    </div>
  );
}
