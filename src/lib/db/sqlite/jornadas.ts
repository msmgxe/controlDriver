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
  pagoDelTramo,
  type ReglaPago,
  type TipoVehiculo,
} from "@/lib/pagos/reglas";
import type { FechaISO } from "@/lib/fechas";
import { montoDelDia } from "@/lib/pagos/calcular-liquidacion";
import { perfilActual } from "./perfil";
import type {
  CampoDeBusqueda,
  DatosDeCliente,
  FilaResumenDiario,
  FuenteDeKm,
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

  /* Lo que se cobra cada día, piso de permanencia incluido, con la misma
     función que la liquidación. Antes aquí iba solo la suma de pedidos, e
     Inicio enseñaba S/ 20 de un día que en el detalle salía S/ 130. */
  const perfil = await perfilActual();
  const cobros = await Promise.all(
    filas.map(async (f) => {
      const { regla } = await reglaVigente(
        f.fecha as FechaISO,
        perfil?.tiendaId ?? null,
        (f.vehiculo ?? VEHICULO_POR_DEFECTO) as TipoVehiculo,
      );
      return montoDelDia(f.monto_centimos ?? 0, regla, f.hora_entrada, f.hora_salida);
    }),
  );

  return filas.map((f, i) => ({
    fecha: f.fecha as FechaISO,
    rutas: f.rutas ?? 0,
    pedidos: f.pedidos ?? 0,
    minutosEnRuta: f.minutos_en_ruta ?? 0,
    primeraSalida: f.primera_salida,
    ultimoRegreso: f.ultimo_regreso,
    montoCentimos: cobros[i].pagadoCentimos,
    montoPedidosCentimos: cobros[i].pedidosCentimos,
    pagaPor: cobros[i].pagaPor,
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
    cliente_nombre: string | null;
    cliente_telefono: string | null;
    direccion: string | null;
    lat: number | null;
    lng: number | null;
    km_fuente: string | null;
    tramo_auto: number;
    fotos: number;
  }>(
    `select id, jornada_id, ruta_id, codigo, estado, posicion, tramo, km, monto_centimos, manual,
            cliente_nombre, cliente_telefono, direccion, lat, lng, km_fuente, tramo_auto,
            (select count(*) from pruebas p where p.orden_id = ordenes.id) as fotos
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
    const inicioPorNumero = new Map(misRutas.map((r) => [r.numero, r.horaInicio ?? "99:99"]));

    const misOrdenes: OrdenFila[] = (ordenesPorJornada.get(j.id) ?? [])
      .map((o) => ({
        id: o.id,
        codigo: o.codigo,
        estado: o.estado,
        posicion: o.posicion,
        ruta: o.ruta_id ? (numeroPorId.get(o.ruta_id) ?? null) : null,
        tramo: o.tramo || 1,
        km: o.km,
        kmFuente: (o.km_fuente as FuenteDeKm | null) ?? null,
        montoCentimos: o.monto_centimos,
        manual: aBool(o.manual),
        cliente: aCliente(o),
        tramoAuto: aBool(o.tramo_auto),
        fotos: o.fotos ?? 0,
      }))
      /* En el orden en que se hicieron: por la hora de salida de su ruta, y
         dentro de cada ruta en el orden de la lista. Ordenar solo por la
         posición de lectura dejaba el historial saltando de la tarde a la
         mañana, porque las capturas no se suben necesariamente en orden. Los
         pedidos sin ruta van al final, donde se ven y se pueden corregir. */
      .sort((a, b) => {
        const ha = a.ruta === null ? "99:99" : (inicioPorNumero.get(a.ruta) ?? "99:99");
        const hb = b.ruta === null ? "99:99" : (inicioPorNumero.get(b.ruta) ?? "99:99");
        return ha.localeCompare(hb) || a.posicion - b.posicion;
      });

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

/**
 * Los datos del cliente de una fila de pedidos, o null si no hay ninguno.
 *
 * Un cliente vacío y ningún cliente son lo mismo: así la pantalla no tiene que
 * distinguir «null» de «un objeto con todo en null» para saber si enseñar algo.
 */
export function aCliente(fila: {
  cliente_nombre: string | null;
  cliente_telefono: string | null;
  direccion: string | null;
  lat: number | null;
  lng: number | null;
}): DatosDeCliente | null {
  const { cliente_nombre: nombre, cliente_telefono: telefono, direccion, lat, lng } = fila;
  if (!nombre && !telefono && !direccion && lat === null && lng === null) return null;
  return { nombre, telefono, direccion, lat, lng };
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

    /* Si ese día estaba marcado como descanso y ahora llega una jornada, se
       trabajó: el descanso sobra, y dejarlo haría que el día figurara como
       trabajado y libre a la vez. */
    await ejecutar(`delete from dias_descanso where fecha = ?`, [datos.fecha]);

    if (modo === "reemplazar") {
      /* Los pedidos primero: apuntan a rutas con ON DELETE SET NULL, y así no
         quedan un instante huérfanos apuntando a null.

         Solo se borran los que **ya no vienen** en esta carga. Los que siguen
         se actualizan más abajo, y con ellos se conserva lo que la persona ya
         guardó de cada uno —su cliente, su distancia, la foto de su comanda—:
         volver a subir las capturas de un día no puede borrar ese trabajo. */
      if (datos.ordenes.length > 0) {
        const huecosCodigos = datos.ordenes.map(() => "?").join(", ");
        await ejecutar(
          `delete from ordenes where jornada_id = ? and codigo not in (${huecosCodigos})`,
          [jornadaId, ...datos.ordenes.map((o) => o.codigo)],
        );
      } else {
        await ejecutar(`delete from ordenes where jornada_id = ?`, [jornadaId]);
      }
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
           /* Un pedido con distancia ya calculada —de su comanda— conserva su
              tramo, su distancia y su monto: la captura los trae siempre en
              tramo 1, y pisarlos borraría lo que la distancia ya decidió. */
           tramo          = case when ordenes.km is not null then ordenes.tramo else excluded.tramo end,
           km             = case when ordenes.km is not null then ordenes.km else excluded.km end,
           monto_centimos = case when ordenes.km is not null then ordenes.monto_centimos else excluded.monto_centimos end`,
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

/**
 * Cambia el tramo de un pedido y recalcula su monto (§13).
 *
 * `conservarKm` deja intacta la distancia que el pedido ya tenía: elegir el
 * tramo a mano no debe borrar los kilómetros calculados, que siguen siendo un
 * dato del pedido aunque la persona haya decidido otra cosa. `auto` marca que
 * el tramo lo puso el cálculo por distancia; cambiado a mano vuelve a falso.
 */
export async function actualizarTramo(
  ordenId: string,
  tramo: number,
  montoCentimos: number,
  km: number | null,
  opciones: { auto?: boolean; kmFuente?: FuenteDeKm | null; conservarKm?: boolean } = {},
): Promise<void> {
  const columnas = ["tramo = ?", "monto_centimos = ?", "tramo_auto = ?"];
  const valores: unknown[] = [tramo, montoCentimos, deBool(opciones.auto ?? false)];
  if (!opciones.conservarKm) {
    columnas.push("km = ?", "km_fuente = ?");
    valores.push(km, km === null ? null : (opciones.kmFuente ?? null));
  }
  await ejecutar(`update ordenes set ${columnas.join(", ")} where id = ?`, [...valores, ordenId]);
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

/** Un pedido tal como salió de una captura: el tramo y el monto los pone quien lo guarda. */
export interface PedidoLeido {
  codigo: string;
  ruta: number | null;
  estado: string;
}

/**
 * Añade a un día los pedidos leídos de una foto, **solo los que no estaban**.
 *
 * Un pedido se cobra una vez: si su código ya está guardado —en este día o en
 * cualquier otro— se deja fuera y se devuelve aparte, con la fecha en que está,
 * para que la pantalla pueda decirlo. Así se puede subir una captura que se
 * solapa con lo ya cargado sin miedo a duplicar nada.
 *
 * La comprobación va dentro de la misma transacción que la escritura, y a
 * propósito no reutiliza `codigosYaRegistrados`: aquel se traga los errores
 * porque solo alimenta un aviso, y aquí un fallo silencioso acabaría
 * duplicando pedidos.
 *
 * Todos nacen en tramo 1, como en la carga normal; el repartidor corrige las
 * excepciones. Si su ruta no existe ese día, el pedido entra sin ruta —igual
 * que en Revisión— y se puede asignar después. Si el día no existía, se crea,
 * pero solo si hay algo nuevo que guardar: una foto de puros repetidos no
 * deja una jornada vacía detrás.
 */
export async function agregarPedidosLeidos(
  fecha: FechaISO,
  pedidos: readonly PedidoLeido[],
): Promise<{ nuevos: number; repetidos: Array<{ codigo: string; fecha: FechaISO }> }> {
  // Un mismo código dos veces en la lista entra una sola.
  const unicos = [...new Map(pedidos.map((p) => [p.codigo, p])).values()];
  if (unicos.length === 0) return { nuevos: 0, repetidos: [] };

  const perfil = await perfilActual();
  const { regla } = await reglaVigente(fecha, perfil?.tiendaId ?? null, perfil?.vehiculo);
  const monto = pagoDelTramo(regla, 1) ?? 1000;
  const momento = ahora();

  return enTransaccion(async () => {
    const huecos = unicos.map(() => "?").join(", ");
    const yaEstan = await consultar<{ codigo: string; fecha: string }>(
      `select o.codigo as codigo, j.fecha as fecha
         from ordenes o join jornadas j on j.id = o.jornada_id
        where o.codigo in (${huecos})`,
      unicos.map((p) => p.codigo),
    );
    const dondeEsta = new Map(yaEstan.map((f) => [f.codigo, f.fecha as FechaISO]));

    const nuevos = unicos.filter((p) => !dondeEsta.has(p.codigo));
    const repetidos = unicos
      .filter((p) => dondeEsta.has(p.codigo))
      .map((p) => ({ codigo: p.codigo, fecha: dondeEsta.get(p.codigo) as FechaISO }));
    if (nuevos.length === 0) return { nuevos: 0, repetidos };

    const existentes = await consultar<{ id: string }>(
      `select id from jornadas where fecha = ?`,
      [fecha],
    );
    let jornadaId = existentes[0]?.id;
    if (!jornadaId) {
      jornadaId = nuevoId();
      await ejecutar(
        `insert into jornadas
           (id, fecha, validacion_ok, tienda_id, vehiculo, creado_en, actualizado_en, sincronizado)
         values (?, ?, 0, ?, ?, ?, ?, 0)`,
        [
          jornadaId, fecha, perfil?.tiendaId ?? null,
          perfil?.vehiculo ?? VEHICULO_POR_DEFECTO, momento, momento,
        ],
      );
    }

    const rutas = await consultar<{ id: string; numero: number }>(
      `select id, numero from rutas where jornada_id = ?`,
      [jornadaId],
    );
    const idPorNumero = new Map(rutas.map((r) => [r.numero, r.id]));

    // Al final de lo que ya hay: se añaden, no se intercalan.
    const ultimas = await consultar<{ ultima: number | null }>(
      `select max(posicion) as ultima from ordenes where jornada_id = ?`,
      [jornadaId],
    );
    let posicion = ultimas[0]?.ultima ?? 0;

    for (const p of nuevos) {
      posicion += 1;
      await ejecutar(
        `insert into ordenes
           (id, jornada_id, ruta_id, codigo, estado, posicion, tramo, km, monto_centimos)
         values (?, ?, ?, ?, ?, ?, 1, null, ?)`,
        [
          nuevoId(), jornadaId,
          p.ruta === null ? null : (idPorNumero.get(p.ruta) ?? null),
          p.codigo, p.estado, posicion, monto,
        ],
      );
    }

    await recontarEstados(jornadaId, momento);
    return { nuevos: nuevos.length, repetidos };
  });
}

/**
 * El prefijo con el que nace un pedido añadido "solo por cantidad", antes de
 * que nadie le ponga su código de verdad. Se usa para reconocerlos en pantalla
 * —y pedir que se completen— sin necesitar una columna aparte: es un código
 * que nunca podría venir de una captura real, porque no tiene la forma
 * `v########wofp-##`.
 */
const PREFIJO_PENDIENTE = "pendiente-";

/** ¿Este código es de un pedido que todavía no tiene el suyo de verdad? */
export function esCodigoPendiente(codigo: string): boolean {
  return codigo.startsWith(PREFIJO_PENDIENTE);
}

/**
 * Anota **cuántos** pedidos se hicieron hoy, sin necesitar el código de
 * ninguno todavía.
 *
 * Para el día en que la captura se perdió, la app de reparto falló, o
 * simplemente no hay cómo leerla: en vez de elegir entre no cobrar esos
 * pedidos o inventarles un código, se anota el número ahora —"hice 14
 * pedidos"— y se completa cada uno después, a su ritmo, igual que se corrige
 * cualquier otro pedido ya guardado (código, ruta, estado). Mientras tanto
 * cuentan para el pago de la semana con la tarifa de hoy.
 *
 * Cada uno nace con:
 *   · un código provisional (`esCodigoPendiente` lo reconoce), único siempre
 *     —no puede chocar ni con un código real ni con otro provisional—;
 *   · el tramo 1 de la tarifa vigente: S/10 para el auto de siempre, o la
 *     tarifa única de la moto eléctrica, sea cual sea —el tramo 1 es siempre
 *     el que se aplica a un pedido del que no se sabe nada más—;
 *   · el estado "Entregado", el más frecuente con diferencia.
 *
 * Si el día no existía, se crea —igual que con un pedido a mano—: registrar
 * trabajo real no puede exigir haber subido una captura primero.
 *
 * **No entra si ese día ya tiene pedidos de una foto.** Existe para rellenar
 * la contabilidad de un día que se quedó sin captura a tiempo —de ahí que se
 * pueda elegir cualquier fecha pasada, no solo la de hoy—, y mezclar un
 * conteo a ojo con datos ya leídos de verdad los dejaría a los dos
 * sospechosos: ni se sabría cuáles de los leídos ya estaban contados en el
 * número a mano, ni el número a mano tendría con qué compararse. Un pedido
 * añadido a mano o por cantidad, en cambio, no estorba: es de la misma
 * familia —alguien anotando lo que hizo, no una lectura— y se puede seguir
 * completando el día con más de lo mismo.
 */
export async function agregarPedidosPorCantidad(
  fecha: FechaISO,
  cantidad: number,
): Promise<{ ordenIds: string[] }> {
  if (!Number.isInteger(cantidad) || cantidad <= 0) {
    throw new Error("La cantidad de pedidos tiene que ser un número entero mayor que cero.");
  }

  const conCaptura = await consultar<{ n: number }>(
    `select count(*) as n from ordenes o
       join jornadas j on j.id = o.jornada_id
      where j.fecha = ? and o.manual = 0`,
    [fecha],
  );
  if ((conCaptura[0]?.n ?? 0) > 0) {
    throw new Error(
      "Ese día ya tiene pedidos leídos de una foto. Para no duplicar, anota la cantidad en un día que todavía no tenga capturas cargadas.",
    );
  }

  const perfil = await perfilActual();
  const { regla } = await reglaVigente(fecha, perfil?.tiendaId ?? null, perfil?.vehiculo);
  const monto = pagoDelTramo(regla, 1) ?? 1000;
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
           (id, fecha, validacion_ok, tienda_id, vehiculo, creado_en, actualizado_en, sincronizado)
         values (?, ?, 0, ?, ?, ?, ?, 0)`,
        [
          jornadaId, fecha, perfil?.tiendaId ?? null,
          perfil?.vehiculo ?? VEHICULO_POR_DEFECTO, momento, momento,
        ],
      );
    }

    // Al final de lo que ya hay: se añaden, no se intercalan.
    const ultimas = await consultar<{ ultima: number | null }>(
      `select max(posicion) as ultima from ordenes where jornada_id = ?`,
      [jornadaId],
    );
    let posicion = ultimas[0]?.ultima ?? 0;

    const ordenIds: string[] = [];
    for (let i = 0; i < cantidad; i++) {
      posicion += 1;
      const ordenId = nuevoId();
      // El propio id, que ya es único, alcanza como sufijo: no hace falta
      // comprobar nada más para saber que este código no existe todavía.
      const codigo = `${PREFIJO_PENDIENTE}${ordenId.replace(/-/g, "").slice(0, 8)}`;
      await ejecutar(
        `insert into ordenes
           (id, jornada_id, ruta_id, codigo, estado, posicion, tramo, km, monto_centimos, manual)
         values (?, ?, null, ?, 'Entregado', ?, 1, null, ?, 1)`,
        [ordenId, jornadaId, codigo, posicion, monto],
      );
      ordenIds.push(ordenId);
    }

    await recontarEstados(jornadaId, momento);
    return { ordenIds };
  });
}

/**
 * Quita de los días **posteriores** los pedidos que acaban de guardarse en
 * `fecha`. Devuelve de dónde se quitó cada uno.
 *
 * Un pedido vive en el día más antiguo en que aparece, que es el día en que
 * se hizo. La app de reparto enseña al principio de cada día las rutas de la
 * noche anterior, así que si se carga el 18 antes que el 17, el 18 se queda
 * con pedidos que son del 17. Al guardar el 17, esos pedidos se le quitan al
 * 18: si no, se cobrarían dos veces.
 */
export async function quitarDeDiasPosteriores(
  fecha: FechaISO,
  codigos: readonly string[],
): Promise<Array<{ codigo: string; fecha: FechaISO }>> {
  if (codigos.length === 0) return [];
  const huecos = codigos.map(() => "?").join(", ");

  const encontrados = await consultar<{ id: string; codigo: string; jornada_id: string; fecha: string }>(
    `select o.id, o.codigo, o.jornada_id, j.fecha
       from ordenes o join jornadas j on j.id = o.jornada_id
      where j.fecha > ? and o.codigo in (${huecos})`,
    [fecha, ...codigos],
  );
  if (encontrados.length === 0) return [];

  const momento = ahora();
  await enTransaccion(async () => {
    for (const e of encontrados) {
      await ejecutar(`delete from ordenes where id = ?`, [e.id]);
    }
    for (const jornadaId of new Set(encontrados.map((e) => e.jornada_id))) {
      await recontarEstados(jornadaId, momento);
    }
  });

  return encontrados.map((e) => ({ codigo: e.codigo, fecha: e.fecha as FechaISO }));
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

/** Sin tildes ni mayúsculas: «José» y «jose» tienen que encontrarse. */
const sinTildes = (t: string): string =>
  t.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

/**
 * Busca pedidos por código (§10, utilidades), y opcionalmente **en un rango de
 * días**, y por **el dato del cliente** que se guardó.
 *
 * Es la consulta de "la tienda me pregunta por este pedido": en qué fecha fue,
 * en qué ruta y con qué horario. Busca por coincidencia parcial porque casi
 * nunca se tiene el código entero a mano. Y desde las comandas también sirve
 * para lo contrario: "¿qué pedido era el de la señora Rosa?", buscando por su
 * nombre, su teléfono o su calle.
 *
 * Sin rango, se exigen al menos tres caracteres —con menos, todo coincide y la
 * lista no dice nada—. **Con rango**, el propio rango ya acota la búsqueda, así
 * que el texto puede ser corto o faltar del todo: «todos los pedidos del 14 al
 * 20» es una pregunta legítima.
 *
 * Por cliente, teléfono y dirección se compara en memoria y sin tildes: SQLite
 * solo ignora mayúsculas en las letras sin acento, y quien busca «jose» quiere
 * encontrar a «José». Son cientos de filas como mucho —solo entran los pedidos
 * que guardaron ese dato—, así que no pesa.
 */
export async function buscarPedidos(
  texto: string,
  opciones: { desde?: FechaISO; hasta?: FechaISO; limite?: number; campo?: CampoDeBusqueda } = {},
): Promise<PedidoEncontrado[]> {
  const limpio = texto.trim();
  const { desde, hasta } = opciones;
  const campo = opciones.campo ?? "codigo";
  const hayRango = Boolean(desde || hasta);
  if (!hayRango && limpio.length < 3) return [];

  const condiciones: string[] = [];
  const valores: unknown[] = [];

  if (campo === "codigo") {
    if (limpio) {
      // `%` y `_` son comodines de LIKE: se escapan para que un código con guion
      // bajo no se convierta en una búsqueda abierta.
      condiciones.push(`o.codigo like ? escape '\\'`);
      valores.push(`%${limpio.replace(/[%_\\]/g, "\\$&")}%`);
    }
  } else {
    const columna = { cliente: "cliente_nombre", telefono: "cliente_telefono", direccion: "direccion" }[campo];
    condiciones.push(`o.${columna} is not null and o.${columna} <> ''`);
  }
  if (desde) {
    condiciones.push(`j.fecha >= ?`);
    valores.push(desde);
  }
  if (hasta) {
    condiciones.push(`j.fecha <= ?`);
    valores.push(hasta);
  }
  const limite = opciones.limite ?? (hayRango ? 300 : 50);
  // Filtrando en memoria, el tope de SQL tiene que dejar pasar bastante más.
  valores.push(campo === "codigo" ? limite : 5000);

  const filas = await consultar<{
    id: string;
    codigo: string;
    fecha: string;
    numero: number | null;
    hora_inicio: string | null;
    hora_fin: string | null;
    estado: string;
    tramo: number;
    km: number | null;
    monto_centimos: number | null;
    cliente_nombre: string | null;
    cliente_telefono: string | null;
    direccion: string | null;
    lat: number | null;
    lng: number | null;
  }>(
    `select o.id, o.codigo, j.fecha, r.numero, r.hora_inicio, r.hora_fin,
            o.estado, o.tramo, o.km, o.monto_centimos,
            o.cliente_nombre, o.cliente_telefono, o.direccion, o.lat, o.lng
       from ordenes o
       join jornadas j on j.id = o.jornada_id
       left join rutas r on r.id = o.ruta_id
      ${condiciones.length ? `where ${condiciones.join(" and ")}` : ""}
      order by j.fecha desc, o.posicion asc
      limit ?`,
    valores,
  );

  const buscado = sinTildes(limpio);
  const soloDigitos = limpio.replace(/\D/g, "");
  const coincide = (f: (typeof filas)[number]): boolean => {
    if (campo === "codigo" || (!limpio && hayRango)) return true;
    if (campo === "cliente") return sinTildes(f.cliente_nombre ?? "").includes(buscado);
    if (campo === "direccion") return sinTildes(f.direccion ?? "").includes(buscado);
    // Teléfono: solo dígitos, así «987 654» y «987-654» encuentran lo mismo.
    return soloDigitos.length >= 3 && (f.cliente_telefono ?? "").replace(/\D/g, "").includes(soloDigitos);
  };

  return filas
    .filter(coincide)
    .slice(0, limite)
    .map((f) => ({
      ordenId: f.id,
      codigo: f.codigo,
      fecha: f.fecha as FechaISO,
      ruta: f.numero,
      horaInicio: f.hora_inicio,
      horaFin: f.hora_fin,
      estado: f.estado,
      tramo: f.tramo || 1,
      km: f.km,
      montoCentimos: f.monto_centimos,
      cliente: aCliente(f),
    }));
}
