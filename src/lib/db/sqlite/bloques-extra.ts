/**
 * Apoyo a otra tienda y taxi libre, sobre la base local del celular.
 *
 * Aparte de `ordenes`/`rutas` a propósito (§ plan de apoyo/taxi): no
 * comparten código de despacho, no se tarifan con la regla de la jornada, y
 * no deben inflar las cifras de "pedidos/rutas" que son de la tienda
 * principal. Cuelgan de la misma `jornada_id` —si el día no tenía jornada
 * (un día de solo taxi, sin pedidos de tienda), se crea una vacía, igual que
 * hace `agregarPedidoManual`.
 */
import { VEHICULO_POR_DEFECTO, pagoDelTramo } from "@/lib/pagos/reglas";
import { montoApoyoHora, montoApoyoTramos } from "@/lib/pagos/bloques-extra";
import type {
  ApoyoHoraParaGuardar,
  ApoyoTramosParaGuardar,
  BloqueExtraFila,
  FuenteDeKm,
  PedidoDeApoyoFila,
  TaxiParaGuardar,
  TipoBloqueExtra,
} from "../tipos";
import type { FechaISO } from "@/lib/fechas";
import { consultar, ejecutar, enTransaccion, nuevoId } from "./conexion";
import { reglaVigente } from "./jornadas";
import { perfilActual } from "./perfil";

const ahora = () => new Date().toISOString();

/** Busca la jornada de esa fecha, o crea una vacía (sin tienda, sin horario) si no existe. */
async function idDeJornada(fecha: FechaISO, momento: string): Promise<string> {
  const existentes = await consultar<{ id: string }>(`select id from jornadas where fecha = ?`, [fecha]);
  if (existentes[0]) return existentes[0].id;

  const id = nuevoId();
  await ejecutar(
    `insert into jornadas (id, fecha, validacion_ok, vehiculo, creado_en, actualizado_en, sincronizado)
     values (?, ?, 0, ?, ?, ?, 0)`,
    [id, fecha, VEHICULO_POR_DEFECTO, momento, momento],
  );
  return id;
}

async function siguientePosicion(jornadaId: string): Promise<number> {
  const filas = await consultar<{ ultima: number | null }>(
    `select max(posicion) as ultima from bloques_extra where jornada_id = ?`,
    [jornadaId],
  );
  return (filas[0]?.ultima ?? 0) + 1;
}

export async function guardarApoyoHora(datos: ApoyoHoraParaGuardar): Promise<{ id: string }> {
  const momento = ahora();
  return enTransaccion(async () => {
    const jornadaId = await idDeJornada(datos.fecha, momento);
    const posicion = await siguientePosicion(jornadaId);
    const id = nuevoId();
    const monto = montoApoyoHora(datos.tarifaHoraCentimos, datos.horas);

    await ejecutar(
      `insert into bloques_extra
         (id, jornada_id, tipo, posicion, hora_inicio, hora_fin,
          tienda_nombre, tarifa_hora_centimos, horas, motivo,
          monto_centimos, notas, creado_en, actualizado_en, sincronizado)
       values (?, ?, 'apoyo_hora', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)`,
      [
        id, jornadaId, posicion, datos.horaInicio, datos.horaFin,
        datos.tiendaNombre, datos.tarifaHoraCentimos, datos.horas, datos.motivo,
        monto, datos.notas, momento, momento,
      ],
    );
    return { id };
  });
}

export async function guardarApoyoTramos(datos: ApoyoTramosParaGuardar): Promise<{ id: string }> {
  const momento = ahora();
  return enTransaccion(async () => {
    const jornadaId = await idDeJornada(datos.fecha, momento);
    const perfil = await perfilActual();
    const { regla } = await reglaVigente(datos.fecha, datos.tiendaId, perfil?.vehiculo ?? VEHICULO_POR_DEFECTO);

    /* Un pedido de más de 12 km no tiene tarifa automática (igual que en
       `ordenes`): en v1 queda en S/0 en vez de bloquear el bloque entero —
       es un caso raro en una cobertura corta de unas horas. */
    const pedidosTarifados = datos.pedidos.map((p) => ({
      ...p,
      montoCentimos: pagoDelTramo(regla, p.tramo) ?? 0,
    }));
    const monto = montoApoyoTramos(pedidosTarifados);

    const posicion = await siguientePosicion(jornadaId);
    const id = nuevoId();
    await ejecutar(
      `insert into bloques_extra
         (id, jornada_id, tipo, posicion, hora_inicio, hora_fin,
          tienda_id, monto_centimos, notas, creado_en, actualizado_en, sincronizado)
       values (?, ?, 'apoyo_tramos', ?, ?, ?, ?, ?, ?, ?, ?, 0)`,
      [id, jornadaId, posicion, datos.horaInicio, datos.horaFin, datos.tiendaId, monto, datos.notas, momento, momento],
    );

    for (const [i, p] of pedidosTarifados.entries()) {
      await ejecutar(
        `insert into bloques_apoyo_pedidos (id, bloque_id, posicion, km, km_fuente, tramo, monto_centimos)
         values (?, ?, ?, ?, ?, ?, ?)`,
        [nuevoId(), id, i, p.km, p.kmFuente, p.tramo, p.montoCentimos],
      );
    }
    return { id };
  });
}

export async function guardarTaxi(datos: TaxiParaGuardar): Promise<{ id: string }> {
  const momento = ahora();
  return enTransaccion(async () => {
    const jornadaId = await idDeJornada(datos.fecha, momento);
    const posicion = await siguientePosicion(jornadaId);
    const id = nuevoId();

    await ejecutar(
      `insert into bloques_extra
         (id, jornada_id, tipo, posicion, hora_inicio, hora_fin,
          origen_lat, origen_lng, destino_lat, destino_lng, km, km_fuente,
          monto_centimos, notas, creado_en, actualizado_en, sincronizado)
       values (?, ?, 'taxi', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)`,
      [
        id, jornadaId, posicion, datos.horaInicio, datos.horaFin,
        datos.origen?.lat ?? null, datos.origen?.lng ?? null,
        datos.destino?.lat ?? null, datos.destino?.lng ?? null,
        datos.km, datos.kmFuente, datos.montoCentimos, datos.notas, momento, momento,
      ],
    );
    return { id };
  });
}

interface FilaBloqueExtraDb {
  id: string;
  tipo: TipoBloqueExtra;
  posicion: number;
  hora_inicio: string | null;
  hora_fin: string | null;
  tienda_nombre: string | null;
  tarifa_hora_centimos: number | null;
  horas: number | null;
  motivo: string | null;
  tienda_id: string | null;
  tienda_apoyo_nombre: string | null;
  origen_lat: number | null;
  origen_lng: number | null;
  destino_lat: number | null;
  destino_lng: number | null;
  km: number | null;
  km_fuente: FuenteDeKm | null;
  monto_centimos: number;
  notas: string | null;
}

interface FilaPedidoApoyoDb {
  bloque_id: string;
  id: string;
  km: number | null;
  km_fuente: FuenteDeKm | null;
  tramo: number;
  monto_centimos: number;
}

function aBloqueExtraFila(f: FilaBloqueExtraDb, pedidos: PedidoDeApoyoFila[]): BloqueExtraFila {
  const base = {
    id: f.id,
    posicion: f.posicion,
    horaInicio: f.hora_inicio,
    horaFin: f.hora_fin,
    montoCentimos: f.monto_centimos,
    notas: f.notas,
  };
  if (f.tipo === "apoyo_hora") {
    return {
      ...base,
      tipo: "apoyo_hora",
      tiendaNombre: f.tienda_nombre ?? "",
      tarifaHoraCentimos: f.tarifa_hora_centimos ?? 0,
      horas: f.horas ?? 0,
      motivo: f.motivo,
    };
  }
  if (f.tipo === "apoyo_tramos") {
    return {
      ...base,
      tipo: "apoyo_tramos",
      tiendaId: f.tienda_id ?? "",
      tiendaNombre: f.tienda_apoyo_nombre ?? "",
      pedidos,
    };
  }
  return {
    ...base,
    tipo: "taxi",
    origen: f.origen_lat !== null && f.origen_lng !== null ? { lat: f.origen_lat, lng: f.origen_lng } : null,
    destino: f.destino_lat !== null && f.destino_lng !== null ? { lat: f.destino_lat, lng: f.destino_lng } : null,
    km: f.km,
    kmFuente: f.km_fuente,
  };
}

/** Todos los bloques de ese día, en el orden en que se registraron. */
export async function listarBloquesDelDia(fecha: FechaISO): Promise<BloqueExtraFila[]> {
  const filas = await consultar<FilaBloqueExtraDb>(
    `select b.*, t.nombre as tienda_apoyo_nombre
       from bloques_extra b
       join jornadas j on j.id = b.jornada_id
       left join tiendas t on t.id = b.tienda_id
      where j.fecha = ?
      order by b.posicion asc`,
    [fecha],
  );
  return cargarPedidosYMapear(filas);
}

/** Todos los bloques del rango, agrupados por fecha —para la liquidación semanal. */
export async function bloquesPorRango(
  desde: FechaISO,
  hasta: FechaISO,
): Promise<Map<FechaISO, BloqueExtraFila[]>> {
  const filas = await consultar<FilaBloqueExtraDb & { fecha: FechaISO }>(
    `select b.*, t.nombre as tienda_apoyo_nombre, j.fecha as fecha
       from bloques_extra b
       join jornadas j on j.id = b.jornada_id
       left join tiendas t on t.id = b.tienda_id
      where j.fecha >= ? and j.fecha <= ?
      order by j.fecha asc, b.posicion asc`,
    [desde, hasta],
  );

  const porId = await cargarPedidosYMapear(filas);
  const resultado = new Map<FechaISO, BloqueExtraFila[]>();
  filas.forEach((f, i) => {
    const lista = resultado.get(f.fecha) ?? [];
    lista.push(porId[i]);
    resultado.set(f.fecha, lista);
  });
  return resultado;
}

/** Lee los pedidos de los bloques `apoyo_tramos` de la lista y arma las filas finales. */
async function cargarPedidosYMapear(filas: FilaBloqueExtraDb[]): Promise<BloqueExtraFila[]> {
  const idsTramos = filas.filter((f) => f.tipo === "apoyo_tramos").map((f) => f.id);
  const pedidosPorBloque = new Map<string, PedidoDeApoyoFila[]>();

  if (idsTramos.length > 0) {
    const marcadores = idsTramos.map(() => "?").join(", ");
    const pedidos = await consultar<FilaPedidoApoyoDb>(
      `select bloque_id, id, km, km_fuente, tramo, monto_centimos
         from bloques_apoyo_pedidos
        where bloque_id in (${marcadores})
        order by posicion asc`,
      idsTramos,
    );
    for (const p of pedidos) {
      const lista = pedidosPorBloque.get(p.bloque_id) ?? [];
      lista.push({ id: p.id, km: p.km, kmFuente: p.km_fuente, tramo: p.tramo, montoCentimos: p.monto_centimos });
      pedidosPorBloque.set(p.bloque_id, lista);
    }
  }

  return filas.map((f) => aBloqueExtraFila(f, pedidosPorBloque.get(f.id) ?? []));
}

/** Borra un bloque. Sus pedidos (si era `apoyo_tramos`) caen en cascada. */
export async function borrarBloque(id: string): Promise<void> {
  await ejecutar(
    `update jornadas set actualizado_en = ?, sincronizado = 0
      where id = (select jornada_id from bloques_extra where id = ?)`,
    [ahora(), id],
  );
  await ejecutar(`delete from bloques_extra where id = ?`, [id]);
}
