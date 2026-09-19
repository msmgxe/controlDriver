/**
 * Jornadas, sobre la base local del celular.
 *
 * Misma interfaz que la versión de Postgres (`../postgres/jornadas.ts`) y los
 * mismos tipos de `../tipos.ts`: las pantallas no distinguen cuál está
 * corriendo. Tres diferencias de fondo, todas a favor:
 *
 *   · **Guardar una jornada sí es transaccional.** Sobre PostgREST no había
 *     forma de envolver las tres escrituras, y un fallo a medias dejaba la
 *     jornada sin pedidos. Aquí o entra todo o no entra nada.
 *
 *   · **No hay `user_id`.** Una base por celular, un dueño. Filtrar por usuario
 *     no protegería nada que el sistema operativo no proteja ya.
 *
 *   · **El dinero ya está en céntimos** en la propia base, así que no hay
 *     conversión que hacer al leer ni al escribir.
 */
import {
  REGLA_INICIAL,
  VEHICULO_POR_DEFECTO,
  esquemaReglaPago,
  type ReglaPago,
  type TipoVehiculo,
} from "@/lib/pagos/reglas";
import type { FechaISO } from "@/lib/fechas";
import type {
  FilaResumenDiario,
  JornadaCompleta,
  JornadaParaGuardar,
  ModoDeGuardado,
  OrdenFila,
  PedidoEncontrado,
  RutaFila,
} from "../tipos";
import { aBool, consultar, deBool, ejecutar, enTransaccion, nuevoId } from "./conexion";

const ahora = () => new Date().toISOString();

/* ---------------------------------------------------------------------------
 * Lectura
 * ------------------------------------------------------------------------- */

interface FilaResumen {
  fecha: string;
  rutas: number;
  pedidos: number;
  minutos_en_ruta: number;
  primera_salida: string | null;
  ultimo_regreso: string | null;
  monto_centimos: number;
  pedidos_fuera_tramo_1: number;
  entregado: number;
  parcial: number;
  no_entregado: number;
  validacion_ok: number;
  hora_entrada: string | null;
  hora_salida: string | null;
  vehiculo: string;
}

/** Resumen por día del rango, para Hoy, Pagos y Estadísticas. */
export async function resumenPorRango(
  desde: FechaISO,
  hasta: FechaISO,
): Promise<FilaResumenDiario[]> {
  const filas = await consultar<FilaResumen>(
    `select * from v_resumen_diario
      where fecha >= ? and fecha <= ?
      order by fecha asc`,
    [desde, hasta],
  );

  return filas.map((f) => ({
    fecha: f.fecha as FechaISO,
    rutas: f.rutas ?? 0,
    pedidos: f.pedidos ?? 0,
    minutosEnRuta: f.minutos_en_ruta ?? 0,
    primeraSalida: f.primera_salida,
    ultimoRegreso: f.ultimo_regreso,
    montoCentimos: f.monto_centimos ?? 0,
    pedidosFueraTramo1: f.pedidos_fuera_tramo_1 ?? 0,
    entregado: f.entregado ?? 0,
    parcial: f.parcial ?? 0,
    noEntregado: f.no_entregado ?? 0,
    validacionOk: aBool(f.validacion_ok),
    horaEntrada: f.hora_entrada,
    horaSalida: f.hora_salida,
    vehiculo: (f.vehiculo ?? VEHICULO_POR_DEFECTO) as TipoVehiculo,
  }));
}

/**
 * Jornadas completas del rango, con sus rutas y pedidos.
 *
 * Van tres consultas y no un join a propósito: unir jornadas, rutas y pedidos
 * en una sola multiplica las filas —12 pedidos × 6 rutas = 72— y cualquier
 * suma posterior sale inflada. Es un error que no salta a la vista porque el
 * resultado parece razonable.
 */
export async function jornadasPorRango(
  desde: FechaISO,
  hasta: FechaISO,
): Promise<JornadaCompleta[]> {
  const jornadas = await consultar<{
    id: string;
    fecha: string;
    rutas_declaradas: number | null;
    ordenes_declaradas: number | null;
    entregado: number;
    parcial: number;
    no_entregado: number;
    validacion_ok: number;
    tienda_id: string | null;
    hora_entrada: string | null;
    hora_salida: string | null;
    vehiculo: string;
  }>(
    `select id, fecha, rutas_declaradas, ordenes_declaradas, entregado, parcial,
            no_entregado, validacion_ok, tienda_id, hora_entrada, hora_salida, vehiculo
       from jornadas
      where fecha >= ? and fecha <= ?
      order by fecha asc`,
    [desde, hasta],
  );
  if (jornadas.length === 0) return [];

  const ids = jornadas.map((j) => j.id);
  const huecos = ids.map(() => "?").join(", ");

  const rutas = await consultar<{
    id: string;
    jornada_id: string;
    numero: number;
    estado: string;
    hora_inicio: string | null;
    hora_fin: string | null;
    duracion_min: number | null;
  }>(
    `select id, jornada_id, numero, estado, hora_inicio, hora_fin,
            case when hora_inicio is null or hora_fin is null then null
                 else (strftime('%s', '2000-01-01 ' || hora_fin)
                     - strftime('%s', '2000-01-01 ' || hora_inicio)) / 60
            end as duracion_min
       from rutas where jornada_id in (${huecos})`,
    ids,
  );

  const ordenes = await consultar<{
    id: string;
    jornada_id: string;
    ruta_id: string | null;
    codigo: string;
    estado: string;
    posicion: number;
    tramo: number;
    km: number | null;
    monto_centimos: number | null;
    manual: number;
  }>(
    `select id, jornada_id, ruta_id, codigo, estado, posicion, tramo, km, monto_centimos, manual
       from ordenes where jornada_id in (${huecos})`,
    ids,
  );

  /* Se agrupa por jornada con un índice en memoria: recorrer el array entero
     por cada jornada sería cuadrático, y un mes son cientos de pedidos. */
  const rutasPorJornada = agrupar(rutas, (r) => r.jornada_id);
  const ordenesPorJornada = agrupar(ordenes, (o) => o.jornada_id);

  return jornadas.map((j) => {
    const misRutas: RutaFila[] = (rutasPorJornada.get(j.id) ?? [])
      .map((r) => ({
        id: r.id,
        numero: r.numero,
        estado: r.estado,
        horaInicio: r.hora_inicio,
        horaFin: r.hora_fin,
        duracionMin: r.duracion_min,
      }))
      .sort((a, b) => a.numero - b.numero);

    // Los pedidos guardan el id de su ruta, pero la interfaz enseña el número.
    const numeroPorId = new Map(misRutas.map((r) => [r.id, r.numero]));

    const misOrdenes: OrdenFila[] = (ordenesPorJornada.get(j.id) ?? [])
      .map((o) => ({
        id: o.id,
        codigo: o.codigo,
        estado: o.estado,
        posicion: o.posicion,
        ruta: o.ruta_id ? (numeroPorId.get(o.ruta_id) ?? null) : null,
        tramo: o.tramo || 1,
        km: o.km,
        montoCentimos: o.monto_centimos,
        manual: aBool(o.manual),
      }))
      .sort((a, b) => a.posicion - b.posicion);

    return {
      id: j.id,
      fecha: j.fecha as FechaISO,
      rutasDeclaradas: j.rutas_declaradas,
      ordenesDeclaradas: j.ordenes_declaradas,
      entregado: j.entregado,
      parcial: j.parcial,
      noEntregado: j.no_entregado,
      validacionOk: aBool(j.validacion_ok),
      horaEntrada: j.hora_entrada,
      horaSalida: j.hora_salida,
      tiendaId: j.tienda_id,
      vehiculo: (j.vehiculo ?? VEHICULO_POR_DEFECTO) as TipoVehiculo,
      rutas: misRutas,
      ordenes: misOrdenes,
    };
  });
}

function agrupar<T, C>(filas: T[], clave: (f: T) => C): Map<C, T[]> {
  const mapa = new Map<C, T[]>();
  for (const fila of filas) {
    const k = clave(fila);
    const lista = mapa.get(k);
    if (lista) lista.push(fila);
    else mapa.set(k, [fila]);
  }
  return mapa;
}

/** Una jornada concreta, o null si ese día no está cargado. */
export async function jornadaPorFecha(fecha: FechaISO): Promise<JornadaCompleta | null> {
  const jornadas = await jornadasPorRango(fecha, fecha);
  return jornadas[0] ?? null;
}

/**
 * De los códigos dados, cuáles ya están registrados y en qué fecha.
 * Alimenta el aviso "código ya registrado en otra fecha" de §6.
 */
export async function codigosYaRegistrados(
  codigos: readonly string[],
): Promise<Record<string, FechaISO>> {
  if (codigos.length === 0) return {};
  const huecos = codigos.map(() => "?").join(", ");

  try {
    const filas = await consultar<{ codigo: string; fecha: string }>(
      `select o.codigo as codigo, j.fecha as fecha
         from ordenes o join jornadas j on j.id = o.jornada_id
        where o.codigo in (${huecos})`,
      codigos as string[],
    );
    const salida: Record<string, FechaISO> = {};
    for (const f of filas) salida[f.codigo] = f.fecha as FechaISO;
    return salida;
  } catch {
    return {}; // Es solo un aviso: si falla, no se bloquea la carga.
  }
}

/**
 * Regla de pago vigente para una tienda en una fecha (§13).
 *
 * Sin tienda no hay regla que aplicar: se cae a la del código, que es la de
 * "Wong - Aldabas". Es un respaldo para que un perfil a medio configurar no
 * rompa un cálculo de dinero, no un valor por defecto legítimo.
 */
export async function reglaVigente(
  fecha: FechaISO,
  tiendaId: string | null,
  vehiculo: TipoVehiculo = VEHICULO_POR_DEFECTO,
): Promise<{ id: string | null; regla: ReglaPago }> {
  if (!tiendaId) return { id: null, regla: REGLA_INICIAL };

  const filas = await consultar<{ id: string; parametros: string }>(
    `select id, parametros from reglas_pago
      where tienda_id = ? and vehiculo = ? and vigente_desde <= ?
      order by vigente_desde desc limit 1`,
    [tiendaId, vehiculo, fecha],
  );
  if (filas.length === 0) return { id: null, regla: REGLA_INICIAL };

  try {
    const parseada = esquemaReglaPago.safeParse(JSON.parse(filas[0].parametros));
    // Si la fila está corrupta se usa la regla del código antes que romper un
    // cálculo de dinero con datos a medias.
    return { id: filas[0].id, regla: parseada.success ? parseada.data : REGLA_INICIAL };
  } catch {
    return { id: filas[0].id, regla: REGLA_INICIAL };
  }
}

/* ---------------------------------------------------------------------------
 * Escritura
 * ------------------------------------------------------------------------- */

/**
 * Guarda una jornada completa, de una pieza.
 *
 * Todo ocurre dentro de una transacción: si el celular se apaga a mitad, la
 * base queda como estaba. La versión de Postgres no podía garantizarlo.
 */
export async function guardarJornada(
  datos: JornadaParaGuardar,
  modo: ModoDeGuardado,
): Promise<{ jornadaId: string }> {
  const entregado = datos.ordenes.filter((o) => o.estado === "Entregado").length;
  const parcial = datos.ordenes.filter((o) => o.estado === "Entrega parcial").length;
  const noEntregado = datos.ordenes.filter((o) => o.estado === "No entregado").length;
  const momento = ahora();

  return enTransaccion(async () => {
    const existentes = await consultar<{ id: string }>(
      `select id from jornadas where fecha = ?`,
      [datos.fecha],
    );
    const jornadaId = existentes[0]?.id ?? nuevoId();

    await ejecutar(
      `insert into jornadas
         (id, fecha, rutas_declaradas, ordenes_declaradas, entregado, parcial,
          no_entregado, validacion_ok, tienda_id, hora_entrada, hora_salida,
          vehiculo, creado_en, actualizado_en, sincronizado)
       values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)
       on conflict (fecha) do update set
         rutas_declaradas   = excluded.rutas_declaradas,
         ordenes_declaradas = excluded.ordenes_declaradas,
         entregado          = excluded.entregado,
         parcial            = excluded.parcial,
         no_entregado       = excluded.no_entregado,
         validacion_ok      = excluded.validacion_ok,
         tienda_id          = excluded.tienda_id,
         hora_entrada       = excluded.hora_entrada,
         hora_salida        = excluded.hora_salida,
         vehiculo           = excluded.vehiculo,
         actualizado_en     = excluded.actualizado_en,
         sincronizado       = 0`,
      [
        jornadaId, datos.fecha, datos.rutasDeclaradas, datos.ordenesDeclaradas,
        entregado, parcial, noEntregado, deBool(datos.validacionOk),
        datos.tiendaId, datos.horaEntrada, datos.horaSalida,
        datos.vehiculo ?? VEHICULO_POR_DEFECTO, momento, momento,
      ],
    );

    if (modo === "reemplazar") {
      // Los pedidos primero: apuntan a rutas con ON DELETE SET NULL, y así no
      // quedan un instante huérfanos apuntando a null.
      await ejecutar(`delete from ordenes where jornada_id = ?`, [jornadaId]);
      await ejecutar(`delete from rutas where jornada_id = ?`, [jornadaId]);
    }

    for (const r of datos.rutas) {
      await ejecutar(
        `insert into rutas (id, jornada_id, numero, estado, hora_inicio, hora_fin)
         values (?, ?, ?, ?, ?, ?)
         on conflict (jornada_id, numero) do update set
           estado = excluded.estado,
           hora_inicio = excluded.hora_inicio,
           hora_fin = excluded.hora_fin`,
        [nuevoId(), jornadaId, r.numero, r.estado, r.horaInicio, r.horaFin],
      );
    }

    const rutasGuardadas = await consultar<{ id: string; numero: number }>(
      `select id, numero from rutas where jornada_id = ?`,
      [jornadaId],
    );
    const idPorNumero = new Map(rutasGuardadas.map((r) => [r.numero, r.id]));

    for (const o of datos.ordenes) {
      await ejecutar(
        `insert into ordenes
           (id, jornada_id, ruta_id, codigo, estado, posicion, tramo, km, monto_centimos)
         values (?, ?, ?, ?, ?, ?, ?, ?, ?)
         on conflict (jornada_id, codigo) do update set
           ruta_id        = excluded.ruta_id,
           estado         = excluded.estado,
           posicion       = excluded.posicion,
           tramo          = excluded.tramo,
           km             = excluded.km,
           monto_centimos = excluded.monto_centimos`,
        [
          nuevoId(), jornadaId,
          o.ruta === null ? null : (idPorNumero.get(o.ruta) ?? null),
          o.codigo, o.estado, o.posicion, o.tramo, o.km, o.montoCentimos,
        ],
      );
    }

    return { jornadaId };
  });
}

/** Borra una jornada. Rutas y pedidos caen en cascada (§7). */
export async function borrarJornada(fecha: FechaISO): Promise<void> {
  await ejecutar(`delete from jornadas where fecha = ?`, [fecha]);
}

/** Cambia el tramo de un pedido y recalcula su monto (§13). */
export async function actualizarTramo(
  ordenId: string,
  tramo: number,
  montoCentimos: number,
  km: number | null,
): Promise<void> {
  await ejecutar(
    `update ordenes set tramo = ?, monto_centimos = ?, km = ? where id = ?`,
    [tramo, montoCentimos, km, ordenId],
  );
  // La jornada cambió aunque la fila tocada sea un pedido: hay que resincronizarla.
  await ejecutar(
    `update jornadas set actualizado_en = ?, sincronizado = 0
      where id = (select jornada_id from ordenes where id = ?)`,
    [ahora(), ordenId],
  );
}

/**
 * Añade un pedido a mano.
 *
 * Hace falta más de lo que parece: una captura puede salir cortada, un pedido
 * puede no aparecer en ninguna, o la app de reparto puede haber fallado ese
 * día. Sin esta salida, el repartidor tendría que elegir entre guardar mal o
 * no guardar, y perdería el pago de un pedido que sí hizo.
 *
 * Si ese día no existía, se crea la jornada: se está registrando trabajo real,
 * y exigir subir una captura primero sería un obstáculo sin motivo.
 *
 * Queda marcado como manual para que, si algún día hay que justificar un pago,
 * se vea de dónde salió cada cifra.
 */
export async function agregarPedidoManual(
  fecha: FechaISO,
  datos: {
    codigo: string;
    ruta: number | null;
    estado: string;
    tramo: number;
    km: number | null;
    montoCentimos: number;
    tiendaId?: string | null;
    vehiculo?: TipoVehiculo;
    horaEntrada?: string | null;
    horaSalida?: string | null;
  },
): Promise<{ ordenId: string }> {
  const momento = ahora();

  return enTransaccion(async () => {
    const existentes = await consultar<{ id: string }>(
      `select id from jornadas where fecha = ?`,
      [fecha],
    );
    let jornadaId = existentes[0]?.id;

    if (!jornadaId) {
      jornadaId = nuevoId();
      await ejecutar(
        `insert into jornadas
           (id, fecha, validacion_ok, tienda_id, vehiculo, hora_entrada, hora_salida,
            creado_en, actualizado_en, sincronizado)
         values (?, ?, 0, ?, ?, ?, ?, ?, ?, 0)`,
        [
          jornadaId, fecha, datos.tiendaId ?? null,
          datos.vehiculo ?? VEHICULO_POR_DEFECTO,
          datos.horaEntrada ?? null, datos.horaSalida ?? null,
          momento, momento,
        ],
      );
    }

    // La posición va al final: es un pedido que se añade, no uno que se intercala.
    const ultimas = await consultar<{ ultima: number | null }>(
      `select max(posicion) as ultima from ordenes where jornada_id = ?`,
      [jornadaId],
    );
    const posicion = (ultimas[0]?.ultima ?? 0) + 1;

    let rutaId: string | null = null;
    if (datos.ruta !== null) {
      const rutas = await consultar<{ id: string }>(
        `select id from rutas where jornada_id = ? and numero = ?`,
        [jornadaId, datos.ruta],
      );
      rutaId = rutas[0]?.id ?? null;
    }

    const ordenId = nuevoId();
    await ejecutar(
      `insert into ordenes
         (id, jornada_id, ruta_id, codigo, estado, posicion, tramo, km, monto_centimos, manual)
       values (?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
       on conflict (jornada_id, codigo) do update set
         ruta_id        = excluded.ruta_id,
         estado         = excluded.estado,
         tramo          = excluded.tramo,
         km             = excluded.km,
         monto_centimos = excluded.monto_centimos,
         manual         = 1`,
      [
        ordenId, jornadaId, rutaId, datos.codigo, datos.estado,
        posicion, datos.tramo, datos.km, datos.montoCentimos,
      ],
    );

    await recontarEstados(jornadaId, momento);
    return { ordenId };
  });
}

/** Borra un pedido. Para cuando se añadió por error o llegó duplicado. */
export async function borrarPedido(ordenId: string): Promise<void> {
  const filas = await consultar<{ jornada_id: string }>(
    `select jornada_id from ordenes where id = ?`,
    [ordenId],
  );
  await ejecutar(`delete from ordenes where id = ?`, [ordenId]);
  if (filas[0]) await recontarEstados(filas[0].jornada_id, ahora());
}

/**
 * Recalcula los contadores de estado de la jornada.
 *
 * Se hace desde la base y no en memoria porque tiene que cuadrar con lo que
 * hay guardado, no con lo que la pantalla creía tener.
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

/** Corrige la permanencia de un día ya guardado (§13 bis). */
export async function actualizarHorario(
  fecha: FechaISO,
  horaEntrada: string | null,
  horaSalida: string | null,
): Promise<void> {
  await ejecutar(
    `update jornadas
        set hora_entrada = ?, hora_salida = ?, actualizado_en = ?, sincronizado = 0
      where fecha = ?`,
    [horaEntrada, horaSalida, ahora(), fecha],
  );
}

/** Deja constancia de la carga, para saber cuánto se gasta en el modelo (§12). */
export async function registrarCarga(datos: {
  jornadaId: string | null;
  modelo: string;
  tokensEntrada: number;
  tokensSalida: number;
}): Promise<void> {
  await ejecutar(
    `insert into cargas (id, jornada_id, modelo, tokens_entrada, tokens_salida, creado_en)
     values (?, ?, ?, ?, ?, ?)`,
    [nuevoId(), datos.jornadaId, datos.modelo, datos.tokensEntrada, datos.tokensSalida, ahora()],
  );
}

/**
 * Busca pedidos por código (§10, utilidades).
 *
 * Es la consulta de "la tienda me pregunta por este pedido": en qué fecha fue,
 * en qué ruta y con qué horario. Busca por coincidencia parcial porque casi
 * nunca se tiene el código entero a mano.
 */
export async function buscarPedidos(texto: string): Promise<PedidoEncontrado[]> {
  const limpio = texto.trim();
  if (limpio.length < 3) return [];

  // `%` y `_` son comodines de LIKE: se escapan para que un código con guion
  // bajo no se convierta en una búsqueda abierta.
  const patron = `%${limpio.replace(/[%_\\]/g, "\\$&")}%`;

  const filas = await consultar<{
    codigo: string;
    fecha: string;
    numero: number | null;
    hora_inicio: string | null;
    hora_fin: string | null;
    estado: string;
    tramo: number;
    monto_centimos: number | null;
  }>(
    `select o.codigo, j.fecha, r.numero, r.hora_inicio, r.hora_fin,
            o.estado, o.tramo, o.monto_centimos
       from ordenes o
       join jornadas j on j.id = o.jornada_id
       left join rutas r on r.id = o.ruta_id
      where o.codigo like ? escape '\\'
      order by j.fecha desc
      limit 50`,
    [patron],
  );

  return filas.map((f) => ({
    codigo: f.codigo,
    fecha: f.fecha as FechaISO,
    ruta: f.numero,
    horaInicio: f.hora_inicio,
    horaFin: f.hora_fin,
    estado: f.estado,
    tramo: f.tramo || 1,
    montoCentimos: f.monto_centimos,
  }));
}
