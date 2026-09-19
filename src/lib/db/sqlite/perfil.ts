/**
 * El perfil del dueño del celular, y las tiendas con sus reglas.
 *
 * Aquí el perfil es uno solo: no hay lista de usuarios porque no hay con quién
 * compartir la base. La tabla se llama `perfil` en singular por eso, y todas
 * las funciones trabajan sobre la única fila que contiene.
 *
 * Que el perfil tenga `id` propio no es decorativo: es lo que permitirá que el
 * panel del administrador sepa de quién son los datos cuando lleguen. Sin él,
 * sincronizar sería volcar jornadas anónimas.
 */
import {
  REGLA_INICIAL,
  VEHICULO_POR_DEFECTO,
  type ReglaPago,
  type TipoVehiculo,
} from "@/lib/pagos/reglas";
import type { Perfil, Tienda } from "../tipos";
import { aBool, consultar, deBool, ejecutar, nuevoId } from "./conexion";

const ahora = () => new Date().toISOString();

interface FilaPerfil {
  id: string;
  email: string | null;
  nombre: string;
  tienda_id: string | null;
  vehiculo: string;
  hora_entrada: string | null;
  hora_salida: string | null;
}

/** El perfil, o null si la aplicación aún no se ha configurado. */
export async function perfilActual(): Promise<Perfil | null> {
  const filas = await consultar<FilaPerfil>(
    `select id, email, nombre, tienda_id, vehiculo, hora_entrada, hora_salida
       from perfil limit 1`,
  );
  if (filas.length === 0) return null;
  const p = filas[0];
  return {
    id: p.id,
    email: p.email,
    nombre: p.nombre,
    tiendaId: p.tienda_id,
    vehiculo: (p.vehiculo ?? VEHICULO_POR_DEFECTO) as TipoVehiculo,
    horaEntrada: p.hora_entrada,
    horaSalida: p.hora_salida,
  };
}

/**
 * Crea o actualiza el perfil.
 *
 * El id se conserva entre llamadas: cambiarlo haría que el servidor tomara los
 * datos por los de otra persona la próxima vez que se sincronice.
 */
export async function guardarPerfil(datos: {
  nombre: string;
  email?: string | null;
  tiendaId?: string | null;
  vehiculo?: TipoVehiculo;
  horaEntrada?: string | null;
  horaSalida?: string | null;
}): Promise<Perfil> {
  const previo = await perfilActual();
  const id = previo?.id ?? nuevoId();

  await ejecutar(
    `insert into perfil (id, email, nombre, tienda_id, vehiculo, hora_entrada, hora_salida,
                         actualizado_en, sincronizado)
     values (?, ?, ?, ?, ?, ?, ?, ?, 0)
     on conflict (id) do update set
       email          = excluded.email,
       nombre         = excluded.nombre,
       tienda_id      = excluded.tienda_id,
       vehiculo       = excluded.vehiculo,
       hora_entrada   = excluded.hora_entrada,
       hora_salida    = excluded.hora_salida,
       actualizado_en = excluded.actualizado_en,
       sincronizado   = 0`,
    [
      id,
      datos.email ?? previo?.email ?? null,
      datos.nombre,
      datos.tiendaId !== undefined ? datos.tiendaId : (previo?.tiendaId ?? null),
      datos.vehiculo ?? previo?.vehiculo ?? VEHICULO_POR_DEFECTO,
      datos.horaEntrada !== undefined ? datos.horaEntrada : (previo?.horaEntrada ?? null),
      datos.horaSalida !== undefined ? datos.horaSalida : (previo?.horaSalida ?? null),
      ahora(),
    ],
  );

  return (await perfilActual())!;
}

/* --- Tiendas y sus reglas ------------------------------------------------ */

export async function listarTiendas(): Promise<Tienda[]> {
  const filas = await consultar<{ id: string; nombre: string; activa: number }>(
    `select id, nombre, activa from tiendas order by nombre asc`,
  );
  return filas.map((t) => ({ id: t.id, nombre: t.nombre, activa: aBool(t.activa) }));
}

export async function guardarTienda(datos: {
  id?: string;
  nombre: string;
  activa?: boolean;
}): Promise<string> {
  const id = datos.id ?? nuevoId();
  await ejecutar(
    `insert into tiendas (id, nombre, activa, creado_en, actualizado_en, sincronizado)
     values (?, ?, ?, ?, ?, 0)
     on conflict (id) do update set
       nombre = excluded.nombre,
       activa = excluded.activa,
       actualizado_en = excluded.actualizado_en,
       sincronizado = 0`,
    [id, datos.nombre, deBool(datos.activa ?? true), ahora(), ahora()],
  );
  return id;
}

/**
 * Guarda una regla de pago con fecha de entrada en vigor.
 *
 * Nunca se sobrescribe una regla anterior: se añade otra con una fecha nueva.
 * Así una subida de tarifa no cambia retroactivamente lo que se cobró en
 * semanas ya cerradas, que sería un error caro y silencioso.
 */
export async function guardarRegla(
  tiendaId: string,
  vehiculo: TipoVehiculo,
  vigenteDesde: string,
  regla: ReglaPago,
): Promise<string> {
  const id = nuevoId();
  await ejecutar(
    `insert into reglas_pago
       (id, tienda_id, vehiculo, vigente_desde, parametros, actualizado_en, sincronizado)
     values (?, ?, ?, ?, ?, ?, 0)`,
    [id, tiendaId, vehiculo, vigenteDesde, JSON.stringify(regla), ahora()],
  );
  return id;
}

/**
 * Deja la base lista la primera vez que se abre la aplicación.
 *
 * Crea la tienda del código y su regla para que nada quede a medio configurar:
 * un perfil sin tienda no tiene regla de pago que aplicar, y los cálculos
 * caerían al respaldo sin que nadie se entere.
 */
export async function sembrarSiHaceFalta(nombre = "Wong - Aldabas"): Promise<void> {
  const tiendas = await listarTiendas();
  if (tiendas.length > 0) return;

  const tiendaId = await guardarTienda({ nombre });
  await guardarRegla(tiendaId, VEHICULO_POR_DEFECTO, "2000-01-01", REGLA_INICIAL);

  const perfil = await perfilActual();
  if (!perfil) {
    await guardarPerfil({
      nombre: "Mi cuenta",
      tiendaId,
      vehiculo: VEHICULO_POR_DEFECTO,
      horaEntrada: "09:00",
      horaSalida: "22:00",
    });
  }
}
