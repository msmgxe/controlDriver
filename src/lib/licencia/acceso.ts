/**
 * La puerta de TODO lo que cambia o exporta datos: server actions y route
 * handlers llaman a `exigirSesion()` como primera línea. No basta con que la
 * página no muestre el botón: cada action es un endpoint por su cuenta.
 *
 * También el límite de intentos de login (5 por 15 min por IP, guardado en
 * Turso para que valga entre instancias serverless; en memoria si no hay Turso).
 */
import "server-only";

import { anotarIntento, borrarIntentos, intentosRecientes, registrarAuditoria } from "./repositorio";
import {
  claveDeIp,
  LIMITE_INTENTOS,
  LIMITE_INTENTOS_GLOBAL,
  resumirIp,
  VENTANA_INTENTOS_MS,
} from "./seguridad";
import { haySesion, ipDelCliente } from "./sesion";
import { tursoConfigurado } from "./turso";

export class SinSesion extends Error {
  constructor() {
    super("Sesión vencida. Vuelve a entrar.");
  }
}

/** Lanza `SinSesion` si no hay sesión válida; si la hay, devuelve la IP resumida para la auditoría. */
export async function exigirSesion(): Promise<{ ip: string }> {
  if (!(await haySesion())) throw new SinSesion();
  return { ip: resumirIp(await ipDelCliente()) };
}

/** Para actions: ejecuta `f` con la sesión comprobada o devuelve `alFallar`. */
export async function conSesion<T>(f: (ctx: { ip: string }) => Promise<T>, alFallar: T): Promise<T> {
  try {
    return await f(await exigirSesion());
  } catch (e) {
    if (e instanceof SinSesion) return alFallar;
    throw e;
  }
}

/* --------------------------------------------- intentos de login */

const enMemoria = new Map<string, number[]>();
const GLOBAL = "*global*";

async function contar(clave: string, desde: number): Promise<number> {
  if (tursoConfigurado()) return intentosRecientes(clave, desde);
  return (enMemoria.get(clave) ?? []).filter((t) => t >= desde).length;
}

async function anotar(clave: string, ahora: number): Promise<void> {
  if (tursoConfigurado()) return anotarIntento(clave, ahora);
  enMemoria.set(clave, [...(enMemoria.get(clave) ?? []).filter((t) => t >= ahora - VENTANA_INTENTOS_MS), ahora]);
}

/** ¿Esta IP (o el panel entero) agotó los intentos de la ventana? */
export async function loginBloqueado(ip: string, ahora = Date.now()): Promise<boolean> {
  const desde = ahora - VENTANA_INTENTOS_MS;
  if ((await contar(claveDeIp(ip), desde)) >= LIMITE_INTENTOS) return true;
  return (await contar(GLOBAL, desde)) >= LIMITE_INTENTOS_GLOBAL;
}

export async function anotarLoginFallido(ip: string, ahora = Date.now()): Promise<void> {
  await anotar(claveDeIp(ip), ahora);
  await anotar(GLOBAL, ahora);
  await auditar("login_fallido", null, resumirIp(ip));
}

export async function limpiarLogin(ip: string): Promise<void> {
  if (tursoConfigurado()) await borrarIntentos(claveDeIp(ip));
  else enMemoria.delete(claveDeIp(ip));
}

/** La auditoría nunca debe tumbar la operación que registra. */
export async function auditar(accion: string, codigo: string | null, ipResumida: string): Promise<void> {
  try {
    await registrarAuditoria(accion, codigo, ipResumida);
  } catch {
    console.error(`[licencias] no se pudo registrar la auditoría de "${accion}"`);
  }
}
