/**
 * La sesión del panel de licencias: una sola contraseña, guardada como
 * variable de entorno (`LICENCIAS_PASSWORD`), sin usuarios ni Supabase.
 *
 * La cookie no guarda la contraseña: guarda el hash de la contraseña
 * correcta. Quien la puso ahí demostró conocerla en el momento de entrar, y
 * comparar hashes en cada visita evita mandar el secreto de un lado a otro
 * en cada pedido.
 */
import "server-only";
import { cookies } from "next/headers";

const COOKIE = "licencias_sesion";
const UN_MES_EN_SEGUNDOS = 60 * 60 * 24 * 30;

async function hashDe(texto: string): Promise<string> {
  const datos = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(texto));
  return Array.from(new Uint8Array(datos))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** Si no hay contraseña puesta en el servidor, el panel no se puede usar —no se cae a "sin clave". */
export function panelConfigurado(): boolean {
  return Boolean(process.env.LICENCIAS_PASSWORD);
}

export async function haySesion(): Promise<boolean> {
  if (!panelConfigurado()) return false;
  const jar = await cookies();
  const valor = jar.get(COOKIE)?.value;
  if (!valor) return false;
  return valor === (await hashDe(process.env.LICENCIAS_PASSWORD as string));
}

/** Devuelve si la contraseña era correcta, y pone la cookie si lo era. */
export async function iniciarSesion(clave: string): Promise<boolean> {
  if (!panelConfigurado() || clave !== process.env.LICENCIAS_PASSWORD) return false;
  const jar = await cookies();
  jar.set(COOKIE, await hashDe(clave), {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/licencias",
    maxAge: UN_MES_EN_SEGUNDOS,
  });
  return true;
}

export async function cerrarSesion(): Promise<void> {
  const jar = await cookies();
  jar.delete(COOKIE);
}
