"use server";

import { revalidatePath } from "next/cache";

import { reglaVigente } from "@/lib/db/jornadas";
import { cerrarSemana, reabrirSemana, registrarPago } from "@/lib/db/liquidaciones";
import { esFechaISO, semanaDe } from "@/lib/fechas";
import { perfilActual } from "@/lib/supabase/servidor";

type Resultado = { ok: true } | { ok: false; error: string };

async function conSesion(accion: () => Promise<void>): Promise<Resultado> {
  const perfil = await perfilActual();
  if (!perfil || !perfil.activo) return { ok: false, error: "No hay sesión activa." };
  try {
    await accion();
    revalidatePath("/pagos");
    revalidatePath("/");
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "No se pudo completar la operación.",
    };
  }
}

/** Cierra la semana y congela su monto, desglose y regla (§13). */
export async function accionCerrarSemana(semanaInicio: string): Promise<Resultado> {
  if (!esFechaISO(semanaInicio)) return { ok: false, error: "Semana inválida." };
  const { regla, id } = await reglaVigente(semanaDe(semanaInicio).fin);
  return conSesion(() => cerrarSemana(semanaInicio, regla, id));
}

/** El viernes, el driver registra lo que realmente le pagaron (§13). */
export async function accionRegistrarPago(
  semanaInicio: string,
  montoRecibidoSoles: number,
): Promise<Resultado> {
  if (!esFechaISO(semanaInicio)) return { ok: false, error: "Semana inválida." };
  if (!Number.isFinite(montoRecibidoSoles) || montoRecibidoSoles < 0) {
    return { ok: false, error: "El monto recibido no es válido." };
  }
  return conSesion(() => registrarPago(semanaInicio, Math.round(montoRecibidoSoles * 100)));
}

/** Reabre una semana cerrada para poder corregir una jornada (§13). */
export async function accionReabrirSemana(semanaInicio: string): Promise<Resultado> {
  if (!esFechaISO(semanaInicio)) return { ok: false, error: "Semana inválida." };
  return conSesion(() => reabrirSemana(semanaInicio));
}
