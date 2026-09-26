/**
 * El cliente de un pedido, su ubicación y la distancia que lo separa de la
 * tienda.
 *
 * Todo esto nace de la comanda —la hoja de despacho que acompaña al pedido—,
 * pero no depende de ella: también se puede escribir a mano en la pestaña
 * «Cliente» del pedido. Y todo es opcional: son datos de una tercera persona,
 * y solo se guarda lo que la persona elige guardar.
 *
 * Las comprobaciones de «esta semana ya está pagada» no están aquí sino en
 * `acciones.ts` de cada pantalla, igual que en el resto de las ediciones: esta
 * capa solo deja la base coherente.
 */
import type { DatosDeCliente, FuenteDeKm } from "../tipos";
import type { FechaISO } from "@/lib/fechas";
import { consultar, ejecutar } from "./conexion";

const ahora = () => new Date().toISOString();

/** Un texto vacío o solo de espacios es lo mismo que no haber escrito nada. */
const limpiar = (t: string | null | undefined): string | null => {
  const l = (t ?? "").replace(/\s+/g, " ").trim();
  return l === "" ? null : l;
};

/** Marca la jornada del pedido para resincronizar: cambió aunque la fila tocada sea un pedido. */
async function tocarJornada(ordenId: string): Promise<void> {
  await ejecutar(
    `update jornadas set actualizado_en = ?, sincronizado = 0
      where id = (select jornada_id from ordenes where id = ?)`,
    [ahora(), ordenId],
  );
}

/**
 * Guarda los datos del cliente de un pedido. **Solo toca lo que llega**:
 * `undefined` deja el dato como estaba, `null` o un texto vacío lo borra.
 */
export async function guardarCliente(
  ordenId: string,
  datos: Partial<DatosDeCliente>,
): Promise<void> {
  const columnas: string[] = [];
  const valores: unknown[] = [];

  if (datos.nombre !== undefined) {
    columnas.push("cliente_nombre = ?");
    valores.push(limpiar(datos.nombre));
  }
  if (datos.telefono !== undefined) {
    columnas.push("cliente_telefono = ?");
    valores.push(limpiar(datos.telefono));
  }
  if (datos.direccion !== undefined) {
    columnas.push("direccion = ?");
    valores.push(limpiar(datos.direccion));
  }
  if (datos.lat !== undefined || datos.lng !== undefined) {
    // Un punto necesita las dos coordenadas: una sola no ubica a nadie.
    const lat = datos.lat ?? null;
    const lng = datos.lng ?? null;
    if ((lat === null) !== (lng === null)) {
      throw new Error("La ubicación necesita latitud y longitud a la vez.");
    }
    if (lat !== null && (lat < -90 || lat > 90 || lng! < -180 || lng! > 180)) {
      throw new Error("Esa ubicación no es válida.");
    }
    columnas.push("lat = ?", "lng = ?");
    valores.push(lat, lng);
  }
  if (columnas.length === 0) return;

  const cambiadas = await ejecutar(
    `update ordenes set ${columnas.join(", ")} where id = ?`,
    [...valores, ordenId],
  );
  if (cambiadas === 0) throw new Error("Ese pedido ya no existe. Recarga el día y vuelve a intentarlo.");
  await tocarJornada(ordenId);
}

/**
 * Borra todo lo que se sabía del cliente de un pedido, y su distancia.
 *
 * El tramo y el monto se quedan como estaban: lo que se cobra no cambia por
 * olvidar al cliente, y quitar un dato personal no puede mover dinero.
 */
export async function quitarCliente(ordenId: string): Promise<void> {
  await ejecutar(
    `update ordenes set cliente_nombre = null, cliente_telefono = null, direccion = null,
            lat = null, lng = null, km = null, km_fuente = null, tramo_auto = 0
      where id = ?`,
    [ordenId],
  );
  await tocarJornada(ordenId);
}

/**
 * Deja la distancia de un pedido, con el tramo y el monto que salen de ella.
 *
 * `tramo` y `montoCentimos` se pasan **ya calculados**: qué tramo corresponde a
 * unos kilómetros depende de la tarifa vigente de esa fecha, y eso lo sabe
 * quien llama. Aquí solo se escribe, sin decidir nada.
 */
export async function guardarDistancia(
  ordenId: string,
  datos: {
    km: number;
    kmFuente: FuenteDeKm;
    /** Si se pasa, el pedido cambia de tramo y de monto junto con la distancia. */
    tramo?: number;
    montoCentimos?: number;
    /** El tramo lo puso el cálculo, no la persona. */
    tramoAuto?: boolean;
  },
): Promise<void> {
  if (!(datos.km >= 0 && datos.km < 1000)) throw new Error("Esa distancia no es válida.");

  const columnas = ["km = ?", "km_fuente = ?"];
  const valores: unknown[] = [Math.round(datos.km * 100) / 100, datos.kmFuente];

  if (datos.tramo !== undefined) {
    if (datos.montoCentimos === undefined) {
      throw new Error("Cambiar el tramo exige también el monto.");
    }
    columnas.push("tramo = ?", "monto_centimos = ?", "tramo_auto = ?");
    valores.push(datos.tramo, datos.montoCentimos, datos.tramoAuto ? 1 : 0);
  }

  const cambiadas = await ejecutar(
    `update ordenes set ${columnas.join(", ")} where id = ?`,
    [...valores, ordenId],
  );
  if (cambiadas === 0) throw new Error("Ese pedido ya no existe. Recarga el día y vuelve a intentarlo.");
  await tocarJornada(ordenId);
}

export interface PedidoDeUnNumero {
  ordenId: string;
  codigo: string;
  fecha: FechaISO;
  ruta: number | null;
  horaRuta: string | null;
  tramo: number;
  tramoAuto: boolean;
  km: number | null;
  tieneCliente: boolean;
  fotos: number;
}

/**
 * Los pedidos que llevan este número de despacho, en cualquier día.
 *
 * Una comanda dice «Hoja de despacho Nº 12264655», y el código del pedido es
 * `v12264655wofp-01` o `wpet-12264655-01`: el número **es** la parte del medio,
 * en los dos formatos. Con eso se sabe si
 * el pedido ya estaba cargado desde las capturas —y entonces la comanda solo
 * lo completa— o si hay que crearlo.
 *
 * Puede haber más de uno (`-01`, `-02`): un despacho con varios bultos. Vienen
 * primero los que todavía no tienen cliente, que son los que la comanda
 * completa, y dentro de eso, los más recientes.
 */
export async function pedidosPorNumero(numero: string): Promise<PedidoDeUnNumero[]> {
  // Solo dígitos: el número se mete en un LIKE y no debe traer comodines.
  if (!/^\d{6,12}$/.test(numero)) return [];

  const filas = await consultar<{
    id: string;
    codigo: string;
    fecha: string;
    numero: number | null;
    hora_inicio: string | null;
    tramo: number;
    tramo_auto: number;
    km: number | null;
    con_cliente: number;
    fotos: number;
  }>(
    `select o.id, o.codigo, j.fecha, r.numero, r.hora_inicio, o.tramo, o.tramo_auto, o.km,
            case when o.cliente_nombre is not null or o.cliente_telefono is not null
                   or o.direccion is not null then 1 else 0 end as con_cliente,
            (select count(*) from pruebas p where p.orden_id = o.id) as fotos
       from ordenes o
       join jornadas j on j.id = o.jornada_id
       left join rutas r on r.id = o.ruta_id
      where o.codigo like ? or o.codigo like ?
      order by con_cliente asc, j.fecha desc, o.codigo asc`,
    [`v${numero}wofp-%`, `wpet-${numero}-%`],
  );

  return filas.map((f) => ({
    ordenId: f.id,
    codigo: f.codigo,
    fecha: f.fecha as FechaISO,
    ruta: f.numero,
    horaRuta: f.hora_inicio,
    tramo: f.tramo || 1,
    tramoAuto: f.tramo_auto === 1,
    km: f.km,
    tieneCliente: f.con_cliente === 1,
    fotos: f.fotos,
  }));
}
