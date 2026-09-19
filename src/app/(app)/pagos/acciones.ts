"use client";


import { reglaVigente } from "@/lib/db/sqlite/jornadas";
import { cerrarSemana, reabrirSemana, registrarPago } from "@/lib/db/sqlite/liquidaciones";
import { esFechaISO, semanaDe } from "@/lib/fechas";
import { perfilActual } from "@/lib/db/sqlite/perfil";

type Resultado = { ok: true } | { ok: false; error: string };

/* Antes esto comprobaba la sesión. Dentro del APK no hay sesión que
   comprobar: la base es del dueño del teléfono. Lo que decide si se puede
   escribir es la licencia, y eso se mira en la pantalla, antes de llegar
   aquí. Lo único que queda es no dejar escapar un error. */
async function conSesion(accion: () => Promise<void>): Promise<Resultado> {
  try {
    await accion();
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
  const perfil = await perfilActual();
  const { regla, id } = await reglaVigente(semanaDe(semanaInicio).fin, perfil?.tiendaId ?? null, perfil?.vehiculo);
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
