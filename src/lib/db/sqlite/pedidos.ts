/**
 * Corregir un pedido de un día ya guardado.
 *
 * Revisión deja corregir código, ruta y estado antes de guardar, pero el
 * lector también se equivoca en cosas que solo se ven después: un pedido que
 * cayó en la ruta de al lado, un 3 leído como 8. Sin esta salida, un día
 * guardado solo admitía cambiar el tramo o borrar el pedido, y la única forma
 * de arreglar una ruta era borrar el día entero y volver a cargarlo.
 *
 * Las comprobaciones están aquí y no solo en la pantalla porque es la base la
 * que tiene que quedar coherente: un código repetido cuenta el mismo pedido
 * dos veces en el pago de la semana, y una ruta que no existe deja un pedido
 * apuntando a nada. La pantalla avisa antes, pero quien no deja pasar es esto.
 */
import { RE_CODIGO_PEDIDO } from "@/lib/extraccion/esquema";

import { consultar, ejecutar, enTransaccion } from "./conexion";

const ahora = () => new Date().toISOString();

/**
 * Los estados que puede tener un pedido.
 *
 * Son los únicos que cuentan los contadores de la jornada: un estado fuera de
 * esta lista existiría en la base sin sumar en ninguno, y el resumen del día
 * dejaría de cuadrar con los pedidos que enseña.
 */
export const ESTADOS_DE_PEDIDO = ["Entregado", "Entrega parcial", "No entregado"] as const;

/**
 * Un código como lo guarda la base: en minúsculas y sin espacios.
 *
 * Se quitan todos los espacios, no solo los de los extremos: escrito a mano en
 * el teclado del celular es fácil que se cuele uno en medio, y un código con un
 * espacio dentro nunca casaría con el de la captura.
 */
const normalizarCodigo = (codigo: string): string => codigo.replace(/\s+/g, "").toLowerCase();

/**
 * Cambia el código, la ruta o el estado de un pedido. Solo toca lo que llega.
 *
 * La ruta llega como el número que se ve en pantalla, pero la base guarda el
 * id de la ruta: se traduce buscándola entre las de ese mismo día, porque dos
 * días distintos tienen cada uno su "ruta 3".
 *
 * Todo va en una transacción: si una parte no vale —el código ya existe, la
 * ruta no está—, no se aplica ninguna. Corregir a medias dejaría un pedido que
 * no es ni el de antes ni el que se quería.
 */
export async function actualizarPedido(
  ordenId: string,
  cambios: { codigo?: string; ruta?: number | null; estado?: string },
): Promise<void> {
  const momento = ahora();

  await enTransaccion(async () => {
    const filas = await consultar<{ jornada_id: string; codigo: string }>(
      `select jornada_id, codigo from ordenes where id = ?`,
      [ordenId],
    );
    const pedido = filas[0];
    if (!pedido) throw new Error("Ese pedido ya no existe. Recarga el día y vuelve a intentarlo.");

    const columnas: string[] = [];
    const valores: unknown[] = [];

    if (cambios.codigo !== undefined) {
      const codigo = normalizarCodigo(cambios.codigo);
      if (!RE_CODIGO_PEDIDO.test(codigo)) {
        throw new Error(`"${cambios.codigo}" no es un código de pedido: debe tener la forma v12238726wofp-01.`);
      }
      /* Se compara sin distinguir mayúsculas: un código guardado tal como lo
         transcribió el lector sigue siendo el mismo pedido aunque venga en
         mayúsculas, y el índice único de la tabla no lo vería. */
      const choque = await consultar<{ id: string }>(
        `select id from ordenes
          where jornada_id = ? and lower(codigo) = ? and id <> ?`,
        [pedido.jornada_id, codigo, ordenId],
      );
      if (choque.length > 0) {
        throw new Error(
          `El código ${codigo} ya está en otro pedido de este día: un pedido no se cuenta dos veces.`,
        );
      }
      columnas.push("codigo = ?");
      valores.push(codigo);
    }

    if (cambios.ruta !== undefined) {
      let rutaId: string | null = null;
      if (cambios.ruta !== null) {
        const rutas = await consultar<{ id: string }>(
          `select id from rutas where jornada_id = ? and numero = ?`,
          [pedido.jornada_id, cambios.ruta],
        );
        if (!rutas[0]) {
          throw new Error(
            `Ese día no tiene ruta ${cambios.ruta}. Elige una de la lista o deja el pedido sin ruta.`,
          );
        }
        rutaId = rutas[0].id;
      }
      columnas.push("ruta_id = ?");
      valores.push(rutaId);
    }

    if (cambios.estado !== undefined) {
      if (!(ESTADOS_DE_PEDIDO as readonly string[]).includes(cambios.estado)) {
        throw new Error(
          `"${cambios.estado}" no es un estado de pedido: tiene que ser ${ESTADOS_DE_PEDIDO.join(", ")}.`,
        );
      }
      columnas.push("estado = ?");
      valores.push(cambios.estado);
    }

    if (columnas.length === 0) return;

    await ejecutar(`update ordenes set ${columnas.join(", ")} where id = ?`, [...valores, ordenId]);
    await recontarEstados(pedido.jornada_id, momento);
  });
}

/**
 * Recalcula los contadores de estado de la jornada y la marca para
 * resincronizar.
 *
 * Es el mismo SQL que el de `jornadas.ts`, que no se exporta: si cambia uno,
 * tiene que cambiar el otro. Se cuenta desde la base y no desde lo que traía
 * la pantalla porque tiene que cuadrar con lo guardado. Y se recuenta aunque
 * solo haya cambiado la ruta: la jornada cambió igual, y el servidor tiene
 * que enterarse.
 */
async function recontarEstados(jornadaId: string, momento: string): Promise<void> {
  await ejecutar(
    `update jornadas set
       entregado = (select count(*) from ordenes o
                     where o.jornada_id = jornadas.id and o.estado = 'Entregado'),
       parcial = (select count(*) from ordenes o
                   where o.jornada_id = jornadas.id and o.estado = 'Entrega parcial'),
       no_entregado = (select count(*) from ordenes o
                        where o.jornada_id = jornadas.id and o.estado = 'No entregado'),
       actualizado_en = ?, sincronizado = 0
     where id = ?`,
    [momento, jornadaId],
  );
}
