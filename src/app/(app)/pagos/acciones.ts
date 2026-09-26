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

/**
 * El viernes, el driver anota lo que realmente le pagaron. Esto es lo único
 * que bloquea la semana para editarla: antes había un paso aparte —"Cerrar la
 * semana"— que la bloqueaba sin haber cobrado todavía, y era fácil tocarlo
 * sin querer y quedarse sin poder corregir un pedido que faltaba. Ahora
 * cerrar y registrar el pago son la misma acción.
 */
export async function accionRegistrarPago(
  semanaInicio: string,
  montoRecibidoSoles: number,
): Promise<Resultado> {
  if (!esFechaISO(semanaInicio)) return { ok: false, error: "Semana inválida." };
  if (!Number.isFinite(montoRecibidoSoles) || montoRecibidoSoles < 0) {
    return { ok: false, error: "El monto recibido no es válido." };
  }
  return conSesion(async () => {
    const perfil = await perfilActual();
    const { regla, id } = await reglaVigente(
      semanaDe(semanaInicio).fin,
      perfil?.tiendaId ?? null,
      perfil?.vehiculo,
    );
    await cerrarSemana(semanaInicio, regla, id);
    await registrarPago(semanaInicio, Math.round(montoRecibidoSoles * 100));
  });
}

/** Reabre una semana cerrada para poder corregir una jornada (§13). */
export async function accionReabrirSemana(semanaInicio: string): Promise<Resultado> {
  if (!esFechaISO(semanaInicio)) return { ok: false, error: "Semana inválida." };
  return conSesion(() => reabrirSemana(semanaInicio));
}
