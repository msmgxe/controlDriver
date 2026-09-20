/**
 * Rutas de un día, a mano.
 *
 * Hacen falta por dos caminos que se cruzan. Uno: la captura de Rutas puede
 * salir cortada, o el lector puede perderse una, y entonces sus pedidos no
 * tienen a qué ruta apuntar. Dos: un día escrito enteramente a mano —sin
 * capturas— no tiene ninguna ruta, así que el selector de ruta de un pedido
 * sale vacío y no hay nada que elegir.
 *
 * Una ruta es poco más que un número y un horario, pero ese horario es lo que
 * da el tiempo en ruta de las estadísticas, así que vale la pena poder
 * corregirlo.
 */
import type { FechaISO } from "@/lib/fechas";

import { consultar, ejecutar, enTransaccion, nuevoId } from "./conexion";

const ahora = () => new Date().toISOString();

/** `HH:MM` de reloj, o null. */
function horaValida(hora: string | null | undefined): string | null {
  if (!hora) return null;
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(hora)) {
    throw new Error(`"${hora}" no es una hora: escríbela como 09:30.`);
  }
  return hora;
}

/**
 * Crea o corrige una ruta del día. Si ese día no existía, se crea.
 *
 * Se identifica por su número dentro del día: volver a guardar la ruta 3
 * corrige la que ya estaba, no añade otra.
 */
export async function guardarRuta(
  fecha: FechaISO,
  datos: { numero: number; horaInicio: string | null; horaFin: string | null; estado?: string },
): Promise<{ rutaId: string }> {
  if (!Number.isInteger(datos.numero) || datos.numero < 1 || datos.numero > 99) {
    throw new Error("El número de ruta tiene que estar entre 1 y 99.");
  }
  const inicio = horaValida(datos.horaInicio);
  const fin = horaValida(datos.horaFin);
  const momento = ahora();

  return enTransaccion(async () => {
    const jornadas = await consultar<{ id: string }>(
      `select id from jornadas where fecha = ?`,
      [fecha],
    );
    let jornadaId = jornadas[0]?.id;

    if (!jornadaId) {
      jornadaId = nuevoId();
      await ejecutar(
        `insert into jornadas (id, fecha, validacion_ok, creado_en, actualizado_en, sincronizado)
         values (?, ?, 0, ?, ?, 0)`,
        [jornadaId, fecha, momento, momento],
      );
    }

    await ejecutar(
      `insert into rutas (id, jornada_id, numero, estado, hora_inicio, hora_fin)
       values (?, ?, ?, ?, ?, ?)
       on conflict (jornada_id, numero) do update set
         estado = excluded.estado,
         hora_inicio = excluded.hora_inicio,
         hora_fin = excluded.hora_fin`,
      [nuevoId(), jornadaId, datos.numero, datos.estado ?? "Finalizado", inicio, fin],
    );
    await ejecutar(
      `update jornadas set actualizado_en = ?, sincronizado = 0 where id = ?`,
      [momento, jornadaId],
    );

    const creada = await consultar<{ id: string }>(
      `select id from rutas where jornada_id = ? and numero = ?`,
      [jornadaId, datos.numero],
    );
    return { rutaId: creada[0].id };
  });
}

/**
 * Borra una ruta. Sus pedidos **no se borran**: se quedan sin ruta.
 *
 * Es lo que hay que hacer: el pedido existe y se paga igual, lo que se perdió
 * es saber en qué viaje se entregó. Borrarlos con la ruta sería perder dinero
 * por corregir un horario.
 */
export async function borrarRuta(rutaId: string): Promise<void> {
  const filas = await consultar<{ jornada_id: string }>(
    `select jornada_id from rutas where id = ?`,
    [rutaId],
  );
  await ejecutar(`update ordenes set ruta_id = null where ruta_id = ?`, [rutaId]);
  await ejecutar(`delete from rutas where id = ?`, [rutaId]);
  if (filas[0]) {
    await ejecutar(
      `update jornadas set actualizado_en = ?, sincronizado = 0 where id = ?`,
      [ahora(), filas[0].jornada_id],
    );
  }
}
