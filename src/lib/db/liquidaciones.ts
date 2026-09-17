import "server-only";
import { clienteServidor } from "@/lib/supabase/servidor";
import { aCentimos, type ReglaPago } from "@/lib/pagos/reglas";
import {
  calcularLiquidacion,
  type JornadaLiquidable,
  type Liquidacion,
} from "@/lib/pagos/calcular-liquidacion";
import { jornadasPorRango, reglaVigente } from "@/lib/db/jornadas";
import { perfilActual } from "@/lib/supabase/servidor";
import { semanaDe, type FechaISO } from "@/lib/fechas";

/**
 * Liquidaciones semanales (§13).
 *
 * La semana en curso **se recalcula al vuelo** cada vez que se pide: así refleja
 * al instante cualquier jornada que se acabe de guardar. Solo cuando la semana
 * se cierra se congela el resultado en la tabla `liquidaciones`, junto con la
 * regla que se usó, para que un cambio de tarifa no altere semanas ya pagadas.
 */

export type EstadoSemana = "abierta" | "cerrada" | "pagada";

export interface SemanaLiquidada {
  liquidacion: Liquidacion;
  estado: EstadoSemana;
  montoRecibidoCentimos: number | null;
  /** null mientras la semana no se haya cerrado. */
  id: string | null;
}

export async function liquidacionDeSemana(
  referencia: FechaISO,
  hasta?: FechaISO,
): Promise<SemanaLiquidada> {
  const semana = semanaDe(referencia);
  const perfil = await perfilActual();
  const [jornadas, { regla }, guardada] = await Promise.all([
    jornadasPorRango(semana.inicio, semana.fin),
    reglaVigente(semana.fin, perfil?.tienda_id ?? null),
    leerGuardada(semana.inicio),
  ]);

  const liquidacion = calcularLiquidacion(
    jornadas.map(aLiquidable),
    regla,
    semana.inicio,
    { hasta },
  );

  return {
    liquidacion,
    estado: guardada?.estado ?? "abierta",
    montoRecibidoCentimos: guardada?.montoRecibidoCentimos ?? null,
    id: guardada?.id ?? null,
  };
}

function aLiquidable(j: Awaited<ReturnType<typeof jornadasPorRango>>[number]): JornadaLiquidable {
  return {
    fecha: j.fecha,
    horaEntrada: j.horaEntrada,
    horaSalida: j.horaSalida,
    rutas: j.rutas.map((r) => ({ numero: r.numero, duracionMin: r.duracionMin })),
    pedidos: j.ordenes.map((o) => ({
      codigo: o.codigo,
      tramo: o.tramo,
      estado: o.estado,
      ruta: o.ruta,
      montoManualCentimos: o.montoCentimos,
    })),
  };
}

async function leerGuardada(semanaInicio: FechaISO): Promise<{
  id: string;
  estado: EstadoSemana;
  montoRecibidoCentimos: number | null;
} | null> {
  const supabase = await clienteServidor();
  const { data } = await supabase
    .from("liquidaciones")
    .select("id, estado, monto_recibido")
    .eq("semana_inicio", semanaInicio)
    .maybeSingle();

  if (!data) return null;
  return {
    id: data.id as string,
    estado: data.estado as EstadoSemana,
    montoRecibidoCentimos:
      data.monto_recibido === null ? null : aCentimos(Number(data.monto_recibido)),
  };
}

/**
 * Cierra una semana: congela el monto, el desglose y la regla usada (§13).
 * Editar una jornada de una semana cerrada exige reabrirla explícitamente.
 */
export async function cerrarSemana(
  referencia: FechaISO,
  regla: ReglaPago,
  reglaId: string | null,
): Promise<void> {
  const supabase = await clienteServidor();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("No hay sesión.");

  const semana = semanaDe(referencia);
  const jornadas = await jornadasPorRango(semana.inicio, semana.fin);
  const liquidacion = calcularLiquidacion(jornadas.map(aLiquidable), regla, semana.inicio);

  const { error } = await supabase.from("liquidaciones").upsert(
    {
      user_id: user.id,
      semana_inicio: semana.inicio,
      semana_fin: semana.fin,
      fecha_pago: semana.pago,
      regla_id: reglaId,
      total_rutas: liquidacion.totalRutas,
      total_ordenes: liquidacion.totalOrdenes,
      ordenes_por_tramo: liquidacion.ordenesPorTramo,
      monto_calculado: liquidacion.montoCalculadoCentimos / 100,
      detalle: {
        ...liquidacion.detalle,
        montoPorPedidosCentimos: liquidacion.montoPorPedidosCentimos,
        diasConGarantia: liquidacion.diasConGarantia,
      },
      estado: "cerrada",
    },
    { onConflict: "user_id,semana_inicio" },
  );

  if (error) throw new Error(`No se pudo cerrar la semana: ${error.message}`);
}

/** Registra lo que realmente pagaron y marca la semana como pagada (§13). */
export async function registrarPago(
  semanaInicio: FechaISO,
  montoRecibidoCentimos: number,
): Promise<void> {
  const supabase = await clienteServidor();
  const { error } = await supabase
    .from("liquidaciones")
    .update({ monto_recibido: montoRecibidoCentimos / 100, estado: "pagada" })
    .eq("semana_inicio", semanaInicio);

  if (error) throw new Error(`No se pudo registrar el pago: ${error.message}`);
}

/** Vuelve a abrir una semana cerrada para poder editar sus jornadas. */
export async function reabrirSemana(semanaInicio: FechaISO): Promise<void> {
  const supabase = await clienteServidor();
  const { error } = await supabase
    .from("liquidaciones")
    .update({ estado: "abierta" })
    .eq("semana_inicio", semanaInicio);

  if (error) throw new Error(`No se pudo reabrir la semana: ${error.message}`);
}
