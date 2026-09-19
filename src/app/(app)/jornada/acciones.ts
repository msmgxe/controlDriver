"use client";

import { z } from "zod";

import {
  actualizarHorario,
  actualizarTramo,
  borrarJornada,
  borrarPedido,
  jornadaPorFecha,
  reglaVigente,
} from "@/lib/db/sqlite/jornadas";
import { estadoDeSemana } from "@/lib/db/sqlite/liquidaciones";
import { perfilActual } from "@/lib/db/sqlite/perfil";
import { esFechaISO, type FechaISO } from "@/lib/fechas";
import { TRAMO_MAS_DE_12_KM, pagoDelTramo } from "@/lib/pagos/reglas";

/**
 * Edición de una jornada ya guardada (§9).
 *
 * Antes esto eran Server Actions: el monto se calculaba en el servidor porque
 * el cliente no era de fiar. Dentro del APK esa frontera no existe —la base es
 * del propio usuario y está en su teléfono—, así que las comprobaciones se
 * quedan por una razón distinta: **evitar que un error deje datos incoherentes**,
 * no proteger de un atacante.
 *
 * Lo que sí sigue igual de importante: el monto se deriva del tramo y de la
 * regla vigente, nunca se escribe a mano salvo en el tramo abierto de más de
 * 12 km. Y una jornada de una semana cerrada no se toca sin reabrirla (§13).
 */

type Resultado = { ok: true; mensaje: string } | { ok: false; error: string };

async function semanaEditable(fecha: FechaISO): Promise<{ ok: true } | { ok: false; error: string }> {
  const estado = await estadoDeSemana(fecha);
  if (estado !== "abierta") {
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
  const parseado = esquemaTramo.safeParse(datos);
  if (!parseado.success) return { ok: false, error: "Datos no válidos." };
  const { fecha, ordenId, tramo, km, montoManualCentimos } = parseado.data;

  const editable = await semanaEditable(fecha as FechaISO);
  if (!editable.ok) return { ok: false, error: editable.error };

  const perfil = await perfilActual();
  const { regla } = await reglaVigente(fecha as FechaISO, perfil?.tiendaId ?? null, perfil?.vehiculo);

  let montoCentimos: number | null;
  if (tramo === TRAMO_MAS_DE_12_KM) {
    montoCentimos = montoManualCentimos;
    if (montoCentimos === null) {
      return { ok: false, error: "Un pedido de más de 12 km necesita un monto escrito a mano." };
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
  return { ok: true, mensaje: "Tramo actualizado." };
}

const esquemaHorario = z.object({
  fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  horaEntrada: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).nullable(),
  horaSalida: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).nullable(),
});

/** Corrige la permanencia de un día ya guardado (§13 bis). */
export async function cambiarHorarioDeJornada(datos: unknown): Promise<Resultado> {
  const parseado = esquemaHorario.safeParse(datos);
  if (!parseado.success) return { ok: false, error: "Horario no válido." };
  const { fecha, horaEntrada, horaSalida } = parseado.data;

  const editable = await semanaEditable(fecha as FechaISO);
  if (!editable.ok) return { ok: false, error: editable.error };

  try {
    await actualizarHorario(fecha as FechaISO, horaEntrada, horaSalida);
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "No se pudo guardar el horario.",
    };
  }
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
  if (!esFechaISO(fecha)) return { ok: false, error: "Fecha no válida." };

  const editable = await semanaEditable(fecha);
  if (!editable.ok) return { ok: false, error: editable.error };

  // Se relee antes de borrar: si la cuenta que traía la pantalla ya no cuadra,
  // la jornada cambió mientras tanto y es mejor no borrar nada.
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
  return { ok: true, mensaje: `Jornada del ${fecha} borrada.` };
}

/**
 * Borra un pedido de un día ya guardado.
 *
 * Para cuando el lector tomó mal un dato y el pedido nunca debió estar: un
 * código leído de otra captura, un arrastre de la noche anterior que se coló.
 * La pantalla pide confirmación antes de llegar aquí. Como el resto de
 * ediciones, no se permite en una semana cerrada.
 */
export async function eliminarPedido(fecha: string, ordenId: string): Promise<Resultado> {
  if (!esFechaISO(fecha)) return { ok: false, error: "Fecha no válida." };

  const editable = await semanaEditable(fecha);
  if (!editable.ok) return { ok: false, error: editable.error };

  try {
    await borrarPedido(ordenId);
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "No se pudo borrar el pedido.",
    };
  }
  return { ok: true, mensaje: "Pedido borrado." };
}
