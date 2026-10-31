/**
 * La sesión del panel de licencias: una sola contraseña, guardada como
 * variable de entorno (`LICENCIAS_PASSWORD`), sin usuarios ni Supabase.
 *
 * La cookie no guarda la contraseña ni su hash: guarda un token firmado con
 * HMAC que caduca a las 12 horas (ver `seguridad.ts`). Si la cookie se
 * filtrara, deja de servir sola; y cambiar la contraseña la invalida.
 */
import "server-only";
import { cookies, headers } from "next/headers";

import { entorno } from "./entorno";
import { crearToken, DURACION_SESION_SEGUNDOS, igualesEnTiempoConstante, ipDeCabeceras, tokenValido } from "./seguridad";

const COOKIE = "licencias_sesion";

/** Si no hay contraseña puesta en el servidor, el panel no se puede usar —no se cae a "sin clave". */
export function panelConfigurado(): boolean {
  return Boolean(entorno("LICENCIAS_PASSWORD"));
}

export async function haySesion(): Promise<boolean> {
  const secreto = entorno("LICENCIAS_PASSWORD");
  if (!secreto) return false;
  const jar = await cookies();
  return tokenValido(secreto, jar.get(COOKIE)?.value);
}

/** La IP de quien llama, según Vercel. */
export async function ipDelCliente(): Promise<string> {
  return ipDeCabeceras(await headers());
}

/** Comprueba la contraseña en tiempo constante y pone la cookie si era correcta. */
export async function iniciarSesion(clave: string): Promise<boolean> {
  const secreto = entorno("LICENCIAS_PASSWORD");
  if (!secreto || !igualesEnTiempoConstante(clave, secreto)) return false;
  const jar = await cookies();
  jar.set(COOKIE, crearToken(secreto), {
    httpOnly: true,
    // En desarrollo local por http la cookie "secure" no se guardaría.
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/licencias",
    maxAge: DURACION_SESION_SEGUNDOS,
  });
  return true;
}

export async function cerrarSesion(): Promise<void> {
  const jar = await cookies();
  jar.delete({ name: COOKIE, path: "/licencias" });
}
