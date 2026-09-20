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

/**
 * Calcula la renumeración por hora, sin tocar la base.
 *
 * Devuelve un mapa **número viejo → número nuevo**. Las rutas sin hora de
 * salida van al final, en el orden en que ya estaban entre ellas: no hay
 * forma honesta de saber cuándo salieron, así que no se inventa.
 *
 * Separada de `reordenarRutasDelDia` para poder probarla sin una base de
 * datos de por medio, y para que Revisión —donde las rutas todavía no se han
 * guardado— pueda usar el mismo cálculo sobre su propio estado en memoria.
 */
export function reordenarPorHora(
  rutas: ReadonlyArray<{ numero: number; horaInicio: string | null }>,
): Map<number, number> {
  const ordenadas = [...rutas].sort((a, b) => {
    if (a.horaInicio === null && b.horaInicio === null) return a.numero - b.numero;
    if (a.horaInicio === null) return 1;
    if (b.horaInicio === null) return -1;
    return a.horaInicio.localeCompare(b.horaInicio) || a.numero - b.numero;
  });

  const mapa = new Map<number, number>();
  ordenadas.forEach((r, i) => mapa.set(r.numero, i + 1));
  return mapa;
}

/**
 * Renumera las rutas de un día ya guardado, por hora de salida.
 *
 * Solo cambia el número: los pedidos apuntan a su ruta por el id, no por el
 * número, así que nada se desordena por debajo. Devuelve cuántas rutas
 * cambiaron de número —0 significa que ya estaban en orden—, para que la
 * pantalla lo pueda decir.
 *
 * Va en dos pasadas porque el número es único dentro del día: pasar
 * directamente de "3" a "1" mientras otra ruta todavía es "1" chocaría contra
 * esa restricción a mitad de camino. Primero se apartan todas a números
 * negativos, que no chocan con nada, y luego se ponen los definitivos.
 */
export async function reordenarRutasDelDia(fecha: FechaISO): Promise<number> {
  const jornadas = await consultar<{ id: string }>(
    `select id from jornadas where fecha = ?`,
    [fecha],
  );
  const jornadaId = jornadas[0]?.id;
  if (!jornadaId) return 0;

  const rutas = await consultar<{ id: string; numero: number; hora_inicio: string | null }>(
    `select id, numero, hora_inicio from rutas where jornada_id = ?`,
    [jornadaId],
  );
  if (rutas.length === 0) return 0;

  const mapa = reordenarPorHora(rutas.map((r) => ({ numero: r.numero, horaInicio: r.hora_inicio })));
  const cambios = rutas.filter((r) => mapa.get(r.numero) !== r.numero);
  if (cambios.length === 0) return 0;

  await enTransaccion(async () => {
    for (const r of rutas) {
      await ejecutar(`update rutas set numero = ? where id = ?`, [-(mapa.get(r.numero) as number), r.id]);
    }
    for (const r of rutas) {
      await ejecutar(`update rutas set numero = ? where id = ?`, [mapa.get(r.numero), r.id]);
    }
    await ejecutar(
      `update jornadas set actualizado_en = ?, sincronizado = 0 where id = ?`,
      [ahora(), jornadaId],
    );
  });

  return cambios.length;
}
