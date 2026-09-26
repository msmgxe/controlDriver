"use client";

import { z } from "zod";

import {
  actualizarHorario,
  actualizarTramo,
  agregarPedidosLeidos,
  borrarJornada,
  borrarPedido,
  jornadaPorFecha,
  reglaVigente,
} from "@/lib/db/sqlite/jornadas";
import { guardarCliente, guardarDistancia, quitarCliente } from "@/lib/db/sqlite/clientes";
import { estadoDeSemana } from "@/lib/db/sqlite/liquidaciones";
import { reordenarRutasDelDia } from "@/lib/db/sqlite/rutas";
import { ESTADOS_DE_PEDIDO, actualizarPedido } from "@/lib/db/sqlite/pedidos";
import { perfilActual } from "@/lib/db/sqlite/perfil";
import { esFechaISO, hoyEnLima, type FechaISO } from "@/lib/fechas";
import { RE_CODIGO_PEDIDO } from "@/lib/extraccion/esquema";
import { tramoPorDistancia } from "@/lib/geo/tramo";
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
  // Igual que en la pantalla (§ jornada/page.tsx): lo que bloquea es haber
  // cobrado, no haber cerrado la semana. Antes este cheque se quedó en el
  // criterio viejo —solo "abierta" pasaba— y una semana "cerrada" (cerrar y
  // pagar eran dos pasos separados) se veía editable en pantalla pero
  // rechazaba cualquier cambio al guardarlo, sin explicación visible.
  if (estado === "pagada") {
    return {
      ok: false,
      error:
        "Esa semana ya está pagada. Reábrela desde Pagos antes de editar la jornada, para que el monto liquidado y el historial no se contradigan.",
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
  /** Deja intacta la distancia que el pedido ya tenía: el tramo se eligió a mano, pero los km siguen siendo un dato. */
  conservarKm: z.boolean().optional(),
});

/** Cambia el tramo de un pedido y recalcula su monto (§13). */
export async function cambiarTramoDePedido(datos: unknown): Promise<Resultado> {
  const parseado = esquemaTramo.safeParse(datos);
  if (!parseado.success) return { ok: false, error: "Datos no válidos." };
  const { fecha, ordenId, tramo, km, montoManualCentimos, conservarKm } = parseado.data;

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
    // Elegido a mano: deja de ser «automático» aunque los km se conserven.
    await actualizarTramo(ordenId, tramo, montoCentimos, km, { auto: false, conservarKm });
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

const esquemaCorreccion = z.object({
  codigo: z.string().min(1).max(40).optional(),
  ruta: z.number().int().min(1).max(99).nullable().optional(),
  estado: z.enum(ESTADOS_DE_PEDIDO).optional(),
});

/**
 * Corrige el código, la ruta o el estado de un pedido ya guardado.
 *
 * Antes solo se podía cambiar el tramo o borrar el pedido: si el lector le
 * ponía la ruta de al lado, la única salida era borrar el día entero y volver
 * a cargarlo. Las comprobaciones de fondo están en la capa de datos; aquí solo
 * se mira que la semana se pueda tocar y se traduce el fallo a un mensaje.
 */
export async function corregirPedido(
  fecha: string,
  ordenId: string,
  cambios: unknown,
): Promise<Resultado> {
  const parseado = esquemaCorreccion.safeParse(cambios);
  if (!parseado.success) return { ok: false, error: "Datos no válidos." };

  const editable = await semanaEditable(fecha as FechaISO);
  if (!editable.ok) return { ok: false, error: editable.error };

  try {
    await actualizarPedido(ordenId, parseado.data);
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "No se pudo corregir el pedido.",
    };
  }
  return { ok: true, mensaje: "Pedido corregido." };
}

/**
 * Renumera las rutas del día por hora de salida. Opcional: solo se usa si la
 * lista quedó desordenada —capturas fuera de secuencia, rutas añadidas a
 * mano— y se prefiere que los números sigan el orden real de la jornada.
 */
export async function reordenarRutas(fecha: string): Promise<Resultado> {
  const editable = await semanaEditable(fecha as FechaISO);
  if (!editable.ok) return { ok: false, error: editable.error };

  try {
    const cambios = await reordenarRutasDelDia(fecha as FechaISO);
    return {
      ok: true,
      mensaje: cambios === 0 ? "Ya estaban en orden." : `${cambios} rutas renumeradas.`,
    };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "No se pudieron reordenar las rutas.",
    };
  }
}

const esquemaPedidosDeFoto = z
  .array(
    z.object({
      codigo: z.string().regex(RE_CODIGO_PEDIDO),
      ruta: z.number().int().min(1).max(99).nullable(),
      estado: z.enum(ESTADOS_DE_PEDIDO),
    }),
  )
  .min(1)
  .max(200);

/**
 * Añade a un día los pedidos leídos de una foto, sin repetir ninguno.
 *
 * La fecha la elige la persona y puede no ser la del día que tiene abierto, así
 * que aquí se comprueba de nuevo que sea una fecha que se pueda tocar: ni
 * futura, ni de una semana cerrada. Lo segundo importa más que en las rutas:
 * un pedido es dinero, y añadirlo por debajo de una liquidación dejaría el
 * historial diciendo una cosa y el pago otra.
 *
 * El "no repetir" lo garantiza la capa de datos, dentro de la misma
 * transacción que la escritura. Devuelve cuántos entraron y cuáles ya estaban.
 */
export async function agregarPedidosDeFoto(
  fecha: string,
  pedidos: unknown,
): Promise<
  | { ok: true; nuevos: number; repetidos: Array<{ codigo: string; fecha: FechaISO }> }
  | { ok: false; error: string }
> {
  if (!esFechaISO(fecha)) return { ok: false, error: "Fecha no válida." };
  if (fecha > hoyEnLima()) {
    return { ok: false, error: "No puedes añadir pedidos a una fecha futura." };
  }

  const parseado = esquemaPedidosDeFoto.safeParse(pedidos);
  if (!parseado.success) return { ok: false, error: "Los pedidos leídos no son válidos." };

  const editable = await semanaEditable(fecha);
  if (!editable.ok) return { ok: false, error: editable.error };

  try {
    const { nuevos, repetidos } = await agregarPedidosLeidos(fecha, parseado.data);
    return { ok: true, nuevos, repetidos };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "No se pudieron añadir los pedidos.",
    };
  }
}

/* ---------------------------------------------------------------------------
 * El cliente de un pedido y su distancia
 * ------------------------------------------------------------------------- */

const esquemaCliente = z.object({
  nombre: z.string().max(80).nullable().optional(),
  telefono: z.string().max(30).nullable().optional(),
  direccion: z.string().max(200).nullable().optional(),
  lat: z.number().min(-90).max(90).nullable().optional(),
  lng: z.number().min(-180).max(180).nullable().optional(),
});

/**
 * Guarda los datos del cliente de un pedido. Todo es opcional.
 *
 * Como el resto de ediciones, no toca una semana ya pagada. Solo cambia lo que
 * llega: un dato que no viene se deja como estaba.
 */
export async function guardarClienteDePedido(
  fecha: string,
  ordenId: string,
  datos: unknown,
): Promise<Resultado> {
  if (!esFechaISO(fecha)) return { ok: false, error: "Fecha no válida." };
  const parseado = esquemaCliente.safeParse(datos);
  if (!parseado.success) return { ok: false, error: "Los datos del cliente no son válidos." };

  const editable = await semanaEditable(fecha);
  if (!editable.ok) return { ok: false, error: editable.error };

  try {
    await guardarCliente(ordenId, parseado.data);
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "No se pudieron guardar los datos del cliente.",
    };
  }
  return { ok: true, mensaje: "Datos del cliente guardados." };
}

/** Borra los datos del cliente y la distancia de un pedido. El tramo y el monto no cambian. */
export async function quitarClienteDePedido(fecha: string, ordenId: string): Promise<Resultado> {
  if (!esFechaISO(fecha)) return { ok: false, error: "Fecha no válida." };

  const editable = await semanaEditable(fecha);
  if (!editable.ok) return { ok: false, error: editable.error };

  try {
    await quitarCliente(ordenId);
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "No se pudieron quitar los datos del cliente.",
    };
  }
  return { ok: true, mensaje: "Datos del cliente quitados." };
}

const esquemaDistancia = z.object({
  km: z.number().min(0).max(999),
  kmFuente: z.enum(["recta", "ruta", "estimado", "manual"]),
  /** Dónde está el cliente, si esta distancia sale de ubicarlo. */
  lat: z.number().min(-90).max(90).nullable().optional(),
  lng: z.number().min(-180).max(180).nullable().optional(),
  /** Que el tramo y el monto sigan a la distancia. Si no, solo se guardan los km. */
  aplicarTramo: z.boolean(),
  /** Para más de 12 km, que no tiene tarifa. */
  montoManualCentimos: z.number().int().min(1).max(100_000).nullable().optional(),
});

/**
 * Deja la distancia de un pedido y, si se pide, el tramo que le corresponde.
 *
 * El tramo y el monto **se calculan aquí**, con la tarifa de esa fecha, y no se
 * aceptan de la pantalla: es dinero. Más de 12 km no tiene tarifa: sin un monto
 * escrito, no se cambia el tramo.
 */
export async function fijarDistanciaDePedido(
  fecha: string,
  ordenId: string,
  datos: unknown,
): Promise<Resultado> {
  if (!esFechaISO(fecha)) return { ok: false, error: "Fecha no válida." };
  const parseado = esquemaDistancia.safeParse(datos);
  if (!parseado.success) return { ok: false, error: "La distancia no es válida." };
  const d = parseado.data;

  const editable = await semanaEditable(fecha);
  if (!editable.ok) return { ok: false, error: editable.error };

  try {
    if (d.lat != null && d.lng != null) await guardarCliente(ordenId, { lat: d.lat, lng: d.lng });

    if (!d.aplicarTramo) {
      await guardarDistancia(ordenId, { km: d.km, kmFuente: d.kmFuente });
      return { ok: true, mensaje: "Distancia guardada." };
    }

    const perfil = await perfilActual();
    const { regla } = await reglaVigente(fecha, perfil?.tiendaId ?? null, perfil?.vehiculo);
    const calculado = tramoPorDistancia(regla, d.km);
    const montoCentimos = calculado.montoCentimos ?? d.montoManualCentimos ?? null;
    if (montoCentimos === null) {
      return {
        ok: false,
        error: "Más de 12 km no tiene tarifa: escribe cuánto se cobra por este pedido.",
      };
    }
    await guardarDistancia(ordenId, {
      km: d.km,
      kmFuente: d.kmFuente,
      tramo: calculado.tramo,
      montoCentimos,
      tramoAuto: true,
    });
    return { ok: true, mensaje: "Distancia y tramo guardados." };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "No se pudo guardar la distancia.",
    };
  }
}
