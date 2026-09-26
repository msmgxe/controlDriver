"use client";

import { z } from "zod";

import { esFechaISO, hoyEnLima, type FechaISO } from "@/lib/fechas";
import {
  guardarJornada,
  quitarDeDiasPosteriores,
  registrarCarga,
  reglaVigente,
} from "@/lib/db/sqlite/jornadas";
import { perfilActual } from "@/lib/db/sqlite/perfil";
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
  // Permanencia en tienda de ese día (§13 bis). Puede faltar: hay tiendas que
  // no la pagan y perfiles a los que aún no se les configuró el horario.
  horaEntrada: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).nullable(),
  horaSalida: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).nullable(),
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
  if (!perfil) return { ok: false, error: "La aplicación aún no está configurada." };

  /* Si la licencia permite escribir se comprueba en la pantalla, que es donde
     se puede explicar al usuario y ofrecerle renovar. Repetirlo aquí solo
     serviría para dar el mismo "no" sin contexto. */

  const hoy = hoyEnLima();

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

  /* Un pedido que apunta a una ruta que no está en las capturas **se guarda
     sin ruta**, no se rechaza el día entero.

     Antes esto devolvía un error y el botón de guardar no servía para nada:
     bastaba con que el lector confundiera un número, o con que faltara la
     captura de una ruta, para perder la jornada completa. La ruta solo sirve
     para repartir el tiempo entre pedidos; el pedido y su pago existen igual.
     Pantalla de Revisión ya lo avisa, y se puede asignar después. */
  const numerosDeRuta = new Set(datos.rutas.map((r) => r.numero));
  datos.ordenes = datos.ordenes.map((o) =>
    o.ruta !== null && !numerosDeRuta.has(o.ruta) ? { ...o, ruta: null } : o,
  );

  /* Con el vehículo del perfil: es el que decide qué tarifa se aplica (§13).
     Sin él, `reglaVigente` cae en auto y una moto se guardaba con los montos de
     un auto aunque en pantalla se hubiera visto la tarifa de la moto. */
  const { regla } = await reglaVigente(datos.fecha, perfil.tiendaId, perfil.vehiculo);

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
        horaEntrada: datos.horaEntrada,
        horaSalida: datos.horaSalida,
        // La tienda se toma del perfil en servidor, nunca del cliente: define
        // qué tarifa se aplica, así que es dinero.
        tiendaId: perfil.tiendaId,
        // El vehículo del día decide qué tarifa se aplica (§13).
        vehiculo: perfil.vehiculo,
        rutas: datos.rutas,
        ordenes,
      },
      datos.modo,
    );

    // Los pedidos de este día que otro día posterior tenía como arrastre se
    // le quitan a aquel: un pedido vive en el día en que se hizo.
    await quitarDeDiasPosteriores(
      datos.fecha as FechaISO,
      ordenes.map((o) => o.codigo),
    );

    if (datos.uso) {
      await registrarCarga({
        jornadaId,
        modelo: datos.uso.modelo,
        tokensEntrada: datos.uso.tokensEntrada,
        tokensSalida: datos.uso.tokensSalida,
      });
    }
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "No se pudo guardar la jornada.",
    };
  }

  return { ok: true, fecha: datos.fecha };
}
