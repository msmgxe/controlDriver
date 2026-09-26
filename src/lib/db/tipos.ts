/**
 * Los tipos con los que habla la aplicación.
 *
 * No describen filas de ninguna base: describen el dominio. Por eso viven
 * aquí y no junto a una implementación concreta —hay dos, y tienen que
 * devolver exactamente lo mismo:
 *
 *   · `sqlite/`   la base del celular, que funciona sin señal
 *   · `postgres/` la base compartida, que alimenta el panel del administrador
 *
 * Mientras ambas cumplan estos tipos, las pantallas no saben ni les importa
 * de dónde salen los datos. Ese es todo el truco.
 *
 * Convención de dinero: **céntimos enteros, siempre**. Nunca decimales. La
 * conversión ocurre solo en el borde de cada base y al formatear para mostrar.
 */
import type { Liquidacion } from "@/lib/pagos/calcular-liquidacion";
import type { TipoVehiculo } from "@/lib/pagos/reglas";
import type { FechaISO } from "@/lib/fechas";

/* --- Lectura ------------------------------------------------------------- */

/** Una fila por día: lo que pintan Hoy, Pagos y Estadísticas. */
export interface FilaResumenDiario {
  fecha: FechaISO;
  rutas: number;
  pedidos: number;
  minutosEnRuta: number;
  primeraSalida: string | null;
  ultimoRegreso: string | null;
  /** Lo que se cobra ese día: el mayor entre pedidos y permanencia. */
  montoCentimos: number;
  /** Lo que suman solo los pedidos, sin el piso. */
  montoPedidosCentimos: number;
  pagaPor: "pedidos" | "permanencia";
  pedidosFueraTramo1: number;
  entregado: number;
  parcial: number;
  noEntregado: number;
  validacionOk: boolean;
  horaEntrada: string | null;
  horaSalida: string | null;
  vehiculo: TipoVehiculo;
}

export interface RutaFila {
  id: string;
  numero: number;
  estado: string;
  horaInicio: string | null;
  horaFin: string | null;
  duracionMin: number | null;
}

/**
 * Lo que se sabe del cliente de un pedido.
 *
 * Son datos de una tercera persona: todo es opcional y solo se guarda lo que
 * la persona decide guardar (ver Ajustes › Comandas). Viven solo en el
 * teléfono y no entran al respaldo salvo que se pida.
 */
export interface DatosDeCliente {
  nombre: string | null;
  telefono: string | null;
  direccion: string | null;
  /** Dónde está el cliente, si se pudo ubicar su dirección. */
  lat: number | null;
  lng: number | null;
}

/**
 * De dónde salió la distancia de un pedido:
 *
 *   · `recta`    en línea recta desde la tienda;
 *   · `ruta`     la pidió a un servicio de rutas, por calles;
 *   · `estimado` por calles pero sin señal: la línea recta por el factor;
 *   · `manual`   la escribió la persona, por ejemplo la que dice Waze o Maps.
 */
export type FuenteDeKm = "recta" | "ruta" | "estimado" | "manual";

export interface OrdenFila {
  id: string;
  codigo: string;
  estado: string;
  posicion: number;
  /** Número de ruta, no su id: es lo que se enseña. */
  ruta: number | null;
  tramo: number;
  km: number | null;
  kmFuente: FuenteDeKm | null;
  montoCentimos: number | null;
  /** Añadido a mano, no leído de una captura. */
  manual: boolean;
  /** null si no se guardó ningún dato del cliente. */
  cliente: DatosDeCliente | null;
  /** El tramo lo calculó la distancia; si la persona lo cambia, deja de serlo. */
  tramoAuto: boolean;
  /** Cuántas fotos de comanda tiene este pedido (una como mucho, hoy). */
  fotos: number;
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
  /** Con qué se repartió ese día: decide qué tarifa aplica (§13). */
  vehiculo: TipoVehiculo;
  rutas: RutaFila[];
  ordenes: OrdenFila[];
}

/** Resultado de buscar un pedido (§10). */
export interface PedidoEncontrado {
  ordenId: string;
  codigo: string;
  fecha: FechaISO;
  ruta: number | null;
  horaInicio: string | null;
  horaFin: string | null;
  estado: string;
  tramo: number;
  km: number | null;
  montoCentimos: number | null;
  cliente: DatosDeCliente | null;
}

/** En qué dato de un pedido se busca. */
export type CampoDeBusqueda = "codigo" | "cliente" | "telefono" | "direccion";

/* --- Escritura ----------------------------------------------------------- */

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
  vehiculo: TipoVehiculo;
  rutas: RutaParaGuardar[];
  ordenes: OrdenParaGuardar[];
}

/**
 * Qué hacer si esa fecha ya estaba cargada (§4.8).
 *
 *   · `reemplazar` borra rutas y pedidos previos y escribe los nuevos.
 *   · `combinar`   conserva los pedidos previos que no vengan en esta carga.
 */
export type ModoDeGuardado = "reemplazar" | "combinar";

/* --- Liquidaciones ------------------------------------------------------- */

export type EstadoSemana = "abierta" | "cerrada" | "pagada";

export interface SemanaLiquidada {
  liquidacion: Liquidacion;
  estado: EstadoSemana;
  montoRecibidoCentimos: number | null;
  /** null mientras la semana no se haya cerrado. */
  id: string | null;
}

/* --- Perfil -------------------------------------------------------------- */

/** El dueño del celular. En el panel web, cada repartidor. */
export interface Perfil {
  id: string;
  email: string | null;
  nombre: string;
  tiendaId: string | null;
  /** El de siempre. Cada jornada guarda además el suyo. */
  vehiculo: TipoVehiculo;
  horaEntrada: string | null;
  horaSalida: string | null;
}

/** Cómo mide una tienda la distancia de sus tramos. */
export type MetodoDeDistancia = "recta" | "calles";

export interface Tienda {
  id: string;
  nombre: string;
  activa: boolean;
  /** El punto de partida de los repartos; null hasta que se elige en Ajustes. */
  lat: number | null;
  lng: number | null;
  direccion: string | null;
  metodoDistancia: MetodoDeDistancia;
  /** Línea recta × este número = distancia por calles estimada, sin señal. */
  factorCalles: number;
}
