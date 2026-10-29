/**
 * Piezas de seguridad del panel, puras (sin Next) para poder probarlas:
 * comparación en tiempo constante, token de sesión firmado, IP resumida.
 *
 * Sin `server-only` porque las usan las pruebas; solo importan `node:crypto`.
 */
import { createHash, createHmac, timingSafeEqual } from "node:crypto";

/** Comparación en tiempo constante: no revela cuántos caracteres acertó. */
export function igualesEnTiempoConstante(a: string, b: string): boolean {
  // Se comparan los SHA-256: así tienen el mismo largo y ni siquiera el largo
  // de la contraseña real se filtra por el tiempo de respuesta.
  const ha = createHash("sha256").update(a).digest();
  const hb = createHash("sha256").update(b).digest();
  return timingSafeEqual(ha, hb);
}

/** Cuánto dura una sesión: una jornada de trabajo, no un mes. */
export const DURACION_SESION_SEGUNDOS = 60 * 60 * 12;

/**
 * Token de sesión: `<expira>.<hmac>`. No contiene la contraseña ni nada
 * derivable de ella sin la propia contraseña, caduca solo, y cambiar
 * `LICENCIAS_PASSWORD` invalida todas las sesiones abiertas.
 */
export function crearToken(secreto: string, ahoraMs: number = Date.now()): string {
  const expira = Math.floor(ahoraMs / 1000) + DURACION_SESION_SEGUNDOS;
  return `${expira}.${firmar(secreto, String(expira))}`;
}

export function tokenValido(secreto: string, token: string | undefined, ahoraMs: number = Date.now()): boolean {
  if (!token) return false;
  const [expira, firma, resto] = token.split(".");
  if (resto !== undefined || !expira || !firma || !/^\d{1,12}$/.test(expira)) return false;
  if (Number(expira) < Math.floor(ahoraMs / 1000)) return false;
  return igualesEnTiempoConstante(firma, firmar(secreto, expira));
}

function firmar(secreto: string, datos: string): string {
  return createHmac("sha256", secreto).update(`licencias-sesion:${datos}`).digest("hex");
}

/**
 * IP "resumida" para la auditoría: lo bastante para reconocer desde dónde se
 * entró, sin guardar la dirección completa. IPv4 → `a.b.c.x`; IPv6 → 3 grupos.
 */
export function resumirIp(ip: string | null | undefined): string {
  const t = (ip ?? "").trim();
  if (!t) return "desconocida";
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(t)) return t.split(".").slice(0, 3).join(".") + ".x";
  if (t.includes(":")) return t.split(":").slice(0, 3).join(":") + "::x";
  return "desconocida";
}

/** Clave anónima para contar intentos de login por IP sin guardar la IP. */
export function claveDeIp(ip: string | null | undefined): string {
  return createHash("sha256").update(`licencias-ip:${ip ?? "?"}`).digest("hex").slice(0, 32);
}

/** La IP del cliente según la cabecera que pone Vercel (la primera de la lista). */
export function ipDeCabeceras(cabeceras: { get(nombre: string): string | null }): string {
  const xff = cabeceras.get("x-forwarded-for");
  return (xff?.split(",")[0] ?? cabeceras.get("x-real-ip") ?? "").trim();
}

export const LIMITE_INTENTOS = 5;
export const VENTANA_INTENTOS_MS = 15 * 60 * 1000;
/** Tope global (todas las IP juntas) para frenar ataques distribuidos. */
export const LIMITE_INTENTOS_GLOBAL = 40;
/** Tope de licencias firmadas por hora: si la clave cae en malas manos, el daño tiene techo. */
export const LIMITE_EMISIONES_POR_HORA = 40;
