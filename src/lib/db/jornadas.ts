import "server-only";
import { clienteServidor } from "@/lib/supabase/servidor";
import { aCentimos, type ReglaPago, esquemaReglaPago, REGLA_INICIAL } from "@/lib/pagos/reglas";
import type { FechaISO } from "@/lib/fechas";

/**
 * Lectura y escritura de jornadas.
 *
 * Todas las consultas pasan por RLS: el cliente de servidor actúa como el
 * usuario de la petición, así que nunca hace falta filtrar por `user_id` a
 * mano. Si alguna vez se añade ese filtro, es señal de que algo está mal en
 * las políticas, no de que haga falta el filtro.
 *
 * Convención de dinero: la base guarda soles en `numeric(10,2)`; la aplicación
 * trabaja en céntimos enteros. La conversión ocurre aquí, en el borde.
 */

export interface FilaResumenDiario {
  fecha: FechaISO;
  rutas: number;
  pedidos: number;
  minutosEnRuta: number;
  primeraSalida: string | null;
  ultimoRegreso: string | null;
  montoCentimos: number;
  pedidosFueraTramo1: number;
  entregado: number;
  parcial: number;
  noEntregado: number;
  validacionOk: boolean;
  horaEntrada: string | null;
  horaSalida: string | null;
}

export interface RutaFila {
  id: string;
  numero: number;
  estado: string;
  horaInicio: string | null;
  horaFin: string | null;
  duracionMin: number | null;
}

export interface OrdenFila {
  id: string;
  codigo: string;
  estado: string;
  posicion: number;
  ruta: number | null;
  tramo: number;
  km: number | null;
  montoCentimos: number | null;
}

export interface JornadaCompleta {
  id: string;
  fecha: FechaISO;
  rutasDeclaradas: number | null;
  ordenesDeclaradas: number | null;
  entregado: number;
  parcial: number;
  noEntregado: number;
  validacionOk: boolean;
  /** Permanencia en tienda de ese día, `HH:MM` (§13 bis). */
  horaEntrada: string | null;
  horaSalida: string | null;
  tiendaId: string | null;
  rutas: RutaFila[];
  ordenes: OrdenFila[];
}

const aNumero = (v: unknown): number => (v === null || v === undefined ? 0 : Number(v));

/** Postgres devuelve `time` como `HH:MM:SS`; la interfaz trabaja con `HH:MM`. */
const recortarHora = (v: string | null): string | null => (v ? v.slice(0, 5) : null);

/* ---------------------------------------------------------------------------
 * Lectura
 * ------------------------------------------------------------------------- */

/** Resumen por día del rango, para Hoy, Pagos y Estadísticas. */
export async function resumenPorRango(
  desde: FechaISO,
  hasta: FechaISO,
): Promise<FilaResumenDiario[]> {
  const supabase = await clienteServidor();
  const { data, error } = await supabase
    .from("v_resumen_diario")
    .select("*")
    .gte("fecha", desde)
    .lte("fecha", hasta)
    .order("fecha", { ascending: true });

  if (error) throw new Error(`No se pudo leer el resumen diario: ${error.message}`);

  return (data ?? []).map((f: Record<string, unknown>) => ({
    fecha: f.fecha as FechaISO,
    rutas: aNumero(f.rutas),
    pedidos: aNumero(f.pedidos),
    minutosEnRuta: aNumero(f.minutos_en_ruta),
    primeraSalida: (f.primera_salida as string | null) ?? null,
    ultimoRegreso: (f.ultimo_regreso as string | null) ?? null,
    montoCentimos: aCentimos(aNumero(f.monto)),
    pedidosFueraTramo1: aNumero(f.pedidos_fuera_tramo_1),
    entregado: aNumero(f.entregado),
    parcial: aNumero(f.parcial),
    noEntregado: aNumero(f.no_entregado),
    validacionOk: Boolean(f.validacion_ok),
    horaEntrada: recortarHora(f.hora_entrada as string | null),
    horaSalida: recortarHora(f.hora_salida as string | null),
  }));
}

/** Jornadas completas (con rutas y pedidos) del rango, para el listado de §11. */
export async function jornadasPorRango(
  desde: FechaISO,
  hasta: FechaISO,
): Promise<JornadaCompleta[]> {
  const supabase = await clienteServidor();
  const { data, error } = await supabase
    .from("jornadas")
    .select(
      `id, fecha, rutas_declaradas, ordenes_declaradas, entregado, parcial, no_entregado, validacion_ok,
       tienda_id, hora_entrada, hora_salida,
       rutas ( id, numero, estado, hora_inicio, hora_fin, duracion_min ),
       ordenes ( id, codigo, estado, posicion, tramo, km, monto, ruta_id )`,
    )
    .gte("fecha", desde)
    .lte("fecha", hasta)
    .order("fecha", { ascending: true });

  if (error) throw new Error(`No se pudieron leer las jornadas: ${error.message}`);
  return (data ?? []).map(mapearJornada);
}

/** Una jornada concreta, o null si ese día no está cargado. */
export async function jornadaPorFecha(fecha: FechaISO): Promise<JornadaCompleta | null> {
  const jornadas = await jornadasPorRango(fecha, fecha);
  return jornadas[0] ?? null;
}

type FilaCruda = Record<string, unknown>;

function mapearJornada(j: FilaCruda): JornadaCompleta {
  const rutasCrudas = (j.rutas as FilaCruda[] | null) ?? [];
  const ordenesCrudas = (j.ordenes as FilaCruda[] | null) ?? [];

  const rutas: RutaFila[] = rutasCrudas
    .map((r) => ({
      id: r.id as string,
      numero: aNumero(r.numero),
      estado: r.estado as string,
      horaInicio: (r.hora_inicio as string | null) ?? null,
      horaFin: (r.hora_fin as string | null) ?? null,
      duracionMin: r.duracion_min === null ? null : aNumero(r.duracion_min),
    }))
    .sort((a, b) => a.numero - b.numero);

  const numeroPorId = new Map(rutas.map((r) => [r.id, r.numero]));

  const ordenes: OrdenFila[] = ordenesCrudas
    .map((o) => ({
      id: o.id as string,
      codigo: o.codigo as string,
      estado: o.estado as string,
      posicion: aNumero(o.posicion),
      ruta: o.ruta_id ? (numeroPorId.get(o.ruta_id as string) ?? null) : null,
      tramo: aNumero(o.tramo) || 1,
      km: o.km === null || o.km === undefined ? null : Number(o.km),
      montoCentimos:
        o.monto === null || o.monto === undefined ? null : aCentimos(Number(o.monto)),
    }))
    .sort((a, b) => a.posicion - b.posicion);

  return {
    id: j.id as string,
    fecha: j.fecha as FechaISO,
    rutasDeclaradas: j.rutas_declaradas === null ? null : aNumero(j.rutas_declaradas),
    ordenesDeclaradas: j.ordenes_declaradas === null ? null : aNumero(j.ordenes_declaradas),
    entregado: aNumero(j.entregado),
    parcial: aNumero(j.parcial),
    noEntregado: aNumero(j.no_entregado),
    validacionOk: Boolean(j.validacion_ok),
    horaEntrada: recortarHora(j.hora_entrada as string | null),
    horaSalida: recortarHora(j.hora_salida as string | null),
    tiendaId: (j.tienda_id as string | null) ?? null,
    rutas,
    ordenes,
  };
}

/**
 * De los códigos dados, cuáles ya están registrados y en qué fecha.
 * Alimenta el aviso "código ya registrado en otra fecha" de §6.
 */
export async function codigosYaRegistrados(
  codigos: readonly string[],
): Promise<Record<string, FechaISO>> {
  if (codigos.length === 0) return {};
  const supabase = await clienteServidor();
  const { data, error } = await supabase
    .from("ordenes")
    .select("codigo, jornadas!inner ( fecha )")
    .in("codigo", codigos as string[]);

  if (error) return {}; // Es solo un aviso: si falla, no se bloquea la carga.

  const salida: Record<string, FechaISO> = {};
  for (const fila of (data ?? []) as FilaCruda[]) {
    const jornada = fila.jornadas as FilaCruda | FilaCruda[] | null;
    const fecha = Array.isArray(jornada) ? jornada[0]?.fecha : jornada?.fecha;
    if (fecha) salida[fila.codigo as string] = fecha as FechaISO;
  }
  return salida;
}

/**
 * Regla de pago vigente para una tienda en una fecha (§13).
 *
 * Cada tienda tiene las suyas, así que sin tienda no hay regla que aplicar: se
 * cae a la del código, que es la de "Wong - Aldabas". Es un respaldo para que
 * un perfil a medio configurar no rompa un cálculo de dinero, no un valor por
 * defecto legítimo.
 */
export async function reglaVigente(
  fecha: FechaISO,
  tiendaId: string | null,
): Promise<{ id: string | null; regla: ReglaPago }> {
  if (!tiendaId) return { id: null, regla: REGLA_INICIAL };

  const supabase = await clienteServidor();
  const { data, error } = await supabase
    .from("reglas_pago")
    .select("id, parametros")
    .eq("tienda_id", tiendaId)
    .lte("vigente_desde", fecha)
    .order("vigente_desde", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data) return { id: null, regla: REGLA_INICIAL };

  const parseada = esquemaReglaPago.safeParse(data.parametros);
  // Si la fila está corrupta se usa la regla del código antes que romper un
  // cálculo de dinero con datos a medias.
  return { id: data.id as string, regla: parseada.success ? parseada.data : REGLA_INICIAL };
}

/* ---------------------------------------------------------------------------
 * Escritura
 * ------------------------------------------------------------------------- */

export interface RutaParaGuardar {
  numero: number;
  estado: string;
  horaInicio: string | null;
  horaFin: string | null;
}

export interface OrdenParaGuardar {
  codigo: string;
  estado: string;
  posicion: number;
  ruta: number | null;
  tramo: number;
  km: number | null;
  montoCentimos: number;
}

export interface JornadaParaGuardar {
  fecha: FechaISO;
  rutasDeclaradas: number | null;
  ordenesDeclaradas: number | null;
  validacionOk: boolean;
  /** Permanencia en tienda de ese día, `HH:MM`. Hereda del perfil y se corrige. */
  horaEntrada: string | null;
  horaSalida: string | null;
  tiendaId: string | null;
  rutas: RutaParaGuardar[];
  ordenes: OrdenParaGuardar[];
}

/**
 * Guarda una jornada completa.
 *
 * `modo` decide qué pasa si esa fecha ya existía (§4.8):
 *   - `reemplazar`: se borran rutas y pedidos previos y se escriben los nuevos.
 *   - `combinar`: se conservan los pedidos previos que no vengan en esta carga.
 *
 * No es una transacción: Postgrest no expone uno. El orden está pensado para
 * que un fallo a medias deje la jornada incompleta pero nunca duplicada — las
 * claves únicas `(jornada_id, numero)` y `(jornada_id, codigo)` lo garantizan.
 */
export async function guardarJornada(
  datos: JornadaParaGuardar,
  modo: "reemplazar" | "combinar",
): Promise<{ jornadaId: string }> {
  const supabase = await clienteServidor();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("No hay sesión.");

  const entregado = datos.ordenes.filter((o) => o.estado === "Entregado").length;
  const parcial = datos.ordenes.filter((o) => o.estado === "Entrega parcial").length;
  const noEntregado = datos.ordenes.filter((o) => o.estado === "No entregado").length;

  const { data: jornada, error: errorJornada } = await supabase
    .from("jornadas")
    .upsert(
      {
        user_id: user.id,
        fecha: datos.fecha,
        rutas_declaradas: datos.rutasDeclaradas,
        ordenes_declaradas: datos.ordenesDeclaradas,
        entregado,
        parcial,
        no_entregado: noEntregado,
        validacion_ok: datos.validacionOk,
        tienda_id: datos.tiendaId,
        hora_entrada: datos.horaEntrada,
        hora_salida: datos.horaSalida,
      },
      { onConflict: "user_id,fecha" },
    )
    .select("id")
    .single();

  if (errorJornada || !jornada) {
    throw new Error(`No se pudo guardar la jornada: ${errorJornada?.message ?? "sin detalle"}`);
  }
  const jornadaId = jornada.id as string;

  if (modo === "reemplazar") {
    // Las órdenes primero: tienen una FK a rutas con ON DELETE SET NULL, y así
    // no quedan huérfanas apuntando a null durante un instante.
    await supabase.from("ordenes").delete().eq("jornada_id", jornadaId);
    await supabase.from("rutas").delete().eq("jornada_id", jornadaId);
  }

  const { data: rutasGuardadas, error: errorRutas } = await supabase
    .from("rutas")
    .upsert(
      datos.rutas.map((r) => ({
        jornada_id: jornadaId,
        numero: r.numero,
        estado: r.estado,
        hora_inicio: r.horaInicio,
        hora_fin: r.horaFin,
      })),
      { onConflict: "jornada_id,numero" },
    )
    .select("id, numero");

  if (errorRutas) throw new Error(`No se pudieron guardar las rutas: ${errorRutas.message}`);

  const idPorNumero = new Map<number, string>(
    (rutasGuardadas ?? []).map((r) => [aNumero(r.numero), r.id as string]),
  );

  const { error: errorOrdenes } = await supabase.from("ordenes").upsert(
    datos.ordenes.map((o) => ({
      jornada_id: jornadaId,
      ruta_id: o.ruta === null ? null : (idPorNumero.get(o.ruta) ?? null),
      codigo: o.codigo,
      estado: o.estado,
      posicion: o.posicion,
      tramo: o.tramo,
      km: o.km,
      monto: o.montoCentimos / 100,
    })),
    { onConflict: "jornada_id,codigo" },
  );

  if (errorOrdenes) throw new Error(`No se pudieron guardar los pedidos: ${errorOrdenes.message}`);

  return { jornadaId };
}

/** Borra una jornada. Rutas y pedidos caen en cascada (§7). */
export async function borrarJornada(fecha: FechaISO): Promise<void> {
  const supabase = await clienteServidor();
  const { error } = await supabase.from("jornadas").delete().eq("fecha", fecha);
  if (error) throw new Error(`No se pudo borrar la jornada: ${error.message}`);
}

/** Cambia el tramo de un pedido y recalcula su monto (§13). */
export async function actualizarTramo(
  ordenId: string,
  tramo: number,
  montoCentimos: number,
  km: number | null,
): Promise<void> {
  const supabase = await clienteServidor();
  const { error } = await supabase
    .from("ordenes")
    .update({ tramo, monto: montoCentimos / 100, km })
    .eq("id", ordenId);
  if (error) throw new Error(`No se pudo actualizar el tramo: ${error.message}`);
}

/** Registra la carga para auditoría y para medir el costo por driver (§12). */
export async function registrarCarga(datos: {
  jornadaId: string | null;
  modelo: string;
  tokensEntrada: number;
  tokensSalida: number;
  respuestaCruda: unknown;
}): Promise<void> {
  const supabase = await clienteServidor();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  await supabase.from("cargas").insert({
    jornada_id: datos.jornadaId,
    user_id: user.id,
    imagenes: [], // Por defecto no se conservan (§7).
    respuesta_cruda: datos.respuestaCruda,
    modelo: datos.modelo,
    tokens_entrada: datos.tokensEntrada,
    tokens_salida: datos.tokensSalida,
  });
}
