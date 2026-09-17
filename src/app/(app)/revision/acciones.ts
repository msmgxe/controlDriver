"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { esFechaISO, hoyEnLima, type FechaISO } from "@/lib/fechas";
import { guardarJornada, registrarCarga, reglaVigente } from "@/lib/db/jornadas";
import { perfilActual, puedeCargarJornadas } from "@/lib/supabase/servidor";
import { TRAMO_MAS_DE_12_KM, pagoDelTramo } from "@/lib/pagos/reglas";

/**
 * Confirmar y guardar la jornada revisada (§4.8).
 *
 * Todo lo que llega del cliente se vuelve a validar aquí. El navegador pudo
 * haber cambiado cualquier cosa, y el monto de un pedido es dinero: se calcula
 * **en servidor** a partir del tramo y de la regla vigente, nunca se acepta el
 * importe que mande el cliente (§7).
 */

const esquemaEnvio = z.object({
  fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  rutasDeclaradas: z.number().int().min(0).nullable(),
  ordenesDeclaradas: z.number().int().min(0).nullable(),
  validacionOk: z.boolean(),
  modo: z.enum(["reemplazar", "combinar"]),
  rutas: z
    .array(
      z.object({
        numero: z.number().int().positive(),
        estado: z.string().min(1).max(60),
        horaInicio: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).nullable(),
        horaFin: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).nullable(),
      }),
    )
    .max(40),
  ordenes: z
    .array(
      z.object({
        codigo: z.string().min(1).max(60),
        estado: z.string().min(1).max(60),
        posicion: z.number().int().positive(),
        ruta: z.number().int().positive().nullable(),
        tramo: z.number().int().min(1).max(6),
        km: z.number().min(0).max(999).nullable(),
        // Solo se usa para el tramo 6, el caso abierto de más de 12 km (§17.2).
        montoManualCentimos: z.number().int().min(0).max(100_000).nullable(),
      }),
    )
    .max(200),
  uso: z
    .object({
      modelo: z.string().max(80),
      tokensEntrada: z.number().int().min(0),
      tokensSalida: z.number().int().min(0),
    })
    .nullable(),
});

export type EnvioRevision = z.infer<typeof esquemaEnvio>;

export type ResultadoConfirmacion =
  | { ok: true; fecha: FechaISO }
  | { ok: false; error: string };

export async function confirmarJornada(envio: unknown): Promise<ResultadoConfirmacion> {
  const perfil = await perfilActual();
  if (!perfil) return { ok: false, error: "No hay sesión." };

  const hoy = hoyEnLima();
  if (!puedeCargarJornadas(perfil, hoy)) {
    return {
      ok: false,
      error: perfil.activo
        ? "Tu suscripción venció: puedes consultar tu historial, pero no guardar días nuevos."
        : "Tu cuenta está desactivada.",
    };
  }

  const parseado = esquemaEnvio.safeParse(envio);
  if (!parseado.success) {
    return { ok: false, error: "Los datos de la jornada no son válidos." };
  }
  const datos = parseado.data;

  if (!esFechaISO(datos.fecha)) {
    return { ok: false, error: "La fecha de la jornada no es válida." };
  }
  // No se permiten fechas futuras (§6). Se comprueba aquí y no solo en el
  // cliente: es lo que decide en qué semana entra el pago.
  if (datos.fecha > hoy) {
    return { ok: false, error: "No puedes guardar una jornada con fecha futura." };
  }

  const numerosDeRuta = new Set(datos.rutas.map((r) => r.numero));
  for (const orden of datos.ordenes) {
    if (orden.ruta !== null && !numerosDeRuta.has(orden.ruta)) {
      return { ok: false, error: `El pedido ${orden.codigo} apunta a una ruta que no existe.` };
    }
  }

  const { regla } = await reglaVigente(datos.fecha);

  const ordenes = [];
  for (const orden of datos.ordenes) {
    let montoCentimos: number | null;
    if (orden.tramo === TRAMO_MAS_DE_12_KM) {
      montoCentimos = orden.montoManualCentimos;
      if (montoCentimos === null) {
        return {
          ok: false,
          error: `El pedido ${orden.codigo} está marcado como de más de 12 km y necesita un monto escrito a mano.`,
        };
      }
    } else {
      montoCentimos = pagoDelTramo(regla, orden.tramo);
      if (montoCentimos === null) {
        return { ok: false, error: `El tramo ${orden.tramo} no existe en la tarifa vigente.` };
      }
    }
    ordenes.push({
      codigo: orden.codigo,
      estado: orden.estado,
      posicion: orden.posicion,
      ruta: orden.ruta,
      tramo: orden.tramo,
      km: orden.km,
      montoCentimos,
    });
  }

  try {
    const { jornadaId } = await guardarJornada(
      {
        fecha: datos.fecha,
        rutasDeclaradas: datos.rutasDeclaradas,
        ordenesDeclaradas: datos.ordenesDeclaradas,
        validacionOk: datos.validacionOk,
        rutas: datos.rutas,
        ordenes,
      },
      datos.modo,
    );

    if (datos.uso) {
      await registrarCarga({
        jornadaId,
        modelo: datos.uso.modelo,
        tokensEntrada: datos.uso.tokensEntrada,
        tokensSalida: datos.uso.tokensSalida,
        // No se guardan los códigos: la auditoría solo necesita el tamaño (§7).
        respuestaCruda: { rutas: datos.rutas.length, ordenes: datos.ordenes.length },
      });
    }
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "No se pudo guardar la jornada.",
    };
  }

  revalidatePath("/");
  revalidatePath("/historial");
  revalidatePath("/pagos");
  revalidatePath("/estadisticas");

  return { ok: true, fecha: datos.fecha };
}
