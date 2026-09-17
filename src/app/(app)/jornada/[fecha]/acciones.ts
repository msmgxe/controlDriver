"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import {
  actualizarTramo,
  borrarJornada,
  jornadaPorFecha,
  reglaVigente,
} from "@/lib/db/jornadas";
import { clienteServidor } from "@/lib/supabase/servidor";
import { esFechaISO, lunesDeLaSemana } from "@/lib/fechas";
import { perfilActual } from "@/lib/supabase/servidor";
import { TRAMO_MAS_DE_12_KM, pagoDelTramo } from "@/lib/pagos/reglas";

/**
 * Edición de una jornada ya guardada (§9).
 *
 * Igual que al confirmar, el monto se calcula **en servidor** a partir del
 * tramo y de la regla vigente de la tienda. Nunca se acepta el importe que
 * mande el cliente.
 *
 * Una jornada de una semana ya cerrada no se toca sin reabrirla antes (§13):
 * el monto de esa semana está congelado y editarla por debajo dejaría el
 * historial diciendo una cosa y la liquidación otra.
 */

type Resultado = { ok: true; mensaje: string } | { ok: false; error: string };

async function semanaEditable(fecha: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = await clienteServidor();
  const { data } = await supabase
    .from("liquidaciones")
    .select("estado")
    .eq("semana_inicio", lunesDeLaSemana(fecha))
    .maybeSingle();

  if (data && data.estado !== "abierta") {
    return {
      ok: false,
      error:
        "Esa semana está cerrada. Reábrela desde Pagos antes de editar la jornada, para que el monto liquidado y el historial no se contradigan.",
    };
  }
  return { ok: true };
}

const esquemaTramo = z.object({
  fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  ordenId: z.string().uuid(),
  tramo: z.number().int().min(1).max(6),
  km: z.number().min(0).max(999).nullable(),
  montoManualCentimos: z.number().int().min(0).max(100_000).nullable(),
});

/** Cambia el tramo de un pedido y recalcula su monto (§13). */
export async function cambiarTramoDePedido(datos: unknown): Promise<Resultado> {
  const perfil = await perfilActual();
  if (!perfil?.activo) return { ok: false, error: "No hay sesión activa." };

  const parseado = esquemaTramo.safeParse(datos);
  if (!parseado.success) return { ok: false, error: "Datos no válidos." };
  const { fecha, ordenId, tramo, km, montoManualCentimos } = parseado.data;

  const editable = await semanaEditable(fecha);
  if (!editable.ok) return { ok: false, error: editable.error };

  const { regla } = await reglaVigente(fecha, perfil.tienda_id);

  let montoCentimos: number | null;
  if (tramo === TRAMO_MAS_DE_12_KM) {
    montoCentimos = montoManualCentimos;
    if (montoCentimos === null) {
      return {
        ok: false,
        error: "Un pedido de más de 12 km necesita un monto escrito a mano.",
      };
    }
  } else {
    montoCentimos = pagoDelTramo(regla, tramo);
    if (montoCentimos === null) {
      return { ok: false, error: `El tramo ${tramo} no existe en la tarifa vigente.` };
    }
  }

  try {
    await actualizarTramo(ordenId, tramo, montoCentimos, km);
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "No se pudo actualizar el tramo.",
    };
  }

  revalidarTodo(fecha);
  return { ok: true, mensaje: "Tramo actualizado." };
}

const esquemaHorario = z.object({
  fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  horaEntrada: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).nullable(),
  horaSalida: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).nullable(),
});

/** Corrige la permanencia de un día ya guardado (§13 bis). */
export async function cambiarHorarioDeJornada(datos: unknown): Promise<Resultado> {
  const perfil = await perfilActual();
  if (!perfil?.activo) return { ok: false, error: "No hay sesión activa." };

  const parseado = esquemaHorario.safeParse(datos);
  if (!parseado.success) return { ok: false, error: "Horario no válido." };
  const { fecha, horaEntrada, horaSalida } = parseado.data;

  const editable = await semanaEditable(fecha);
  if (!editable.ok) return { ok: false, error: editable.error };

  const supabase = await clienteServidor();
  const { error } = await supabase
    .from("jornadas")
    .update({ hora_entrada: horaEntrada, hora_salida: horaSalida })
    .eq("fecha", fecha);

  if (error) return { ok: false, error: `No se pudo guardar el horario: ${error.message}` };

  revalidarTodo(fecha);
  return { ok: true, mensaje: "Horario actualizado." };
}

/**
 * Borra una jornada entera. Rutas y pedidos caen en cascada (§7).
 *
 * Pide el número de pedidos como confirmación: es irreversible y, si te
 * equivocas de día, pierdes una carga completa.
 */
export async function eliminarJornada(
  fecha: string,
  pedidosEsperados: number,
): Promise<Resultado> {
  const perfil = await perfilActual();
  if (!perfil?.activo) return { ok: false, error: "No hay sesión activa." };
  if (!esFechaISO(fecha)) return { ok: false, error: "Fecha no válida." };

  const editable = await semanaEditable(fecha);
  if (!editable.ok) return { ok: false, error: editable.error };

  // Se relee en servidor: si el cliente traía una cuenta vieja, es que la
  // jornada cambió desde que se cargó la pantalla y mejor no borrar nada.
  const jornada = await jornadaPorFecha(fecha);
  if (!jornada) return { ok: false, error: "Esa jornada ya no existe." };
  if (jornada.ordenes.length !== pedidosEsperados) {
    return {
      ok: false,
      error: "La jornada cambió desde que abriste esta pantalla. Recárgala y vuelve a intentarlo.",
    };
  }

  try {
    await borrarJornada(fecha);
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "No se pudo borrar la jornada.",
    };
  }

  revalidarTodo(fecha);
  return { ok: true, mensaje: `Jornada del ${fecha} borrada.` };
}

function revalidarTodo(fecha: string): void {
  revalidatePath(`/jornada/${fecha}`);
  revalidatePath("/");
  revalidatePath("/historial");
  revalidatePath("/pagos");
  revalidatePath("/estadisticas");
}
