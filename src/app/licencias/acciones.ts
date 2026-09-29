"use server";

import { revalidatePath } from "next/cache";

import { emitirDesdeElPanel } from "@/lib/licencia/servidor";
import { cerrarSesion, haySesion, iniciarSesion } from "@/lib/licencia/sesion";

export async function entrar(_estado: { error: string | null }, datos: FormData): Promise<{ error: string | null }> {
  const clave = String(datos.get("clave") ?? "");
  const ok = await iniciarSesion(clave);
  if (!ok) return { error: "Contraseña incorrecta." };
  revalidatePath("/licencias");
  return { error: null };
}

export async function salir(): Promise<void> {
  await cerrarSesion();
  revalidatePath("/licencias");
}

export interface EstadoEmision {
  error: string | null;
  certificado: string | null;
  hasta: string | null;
}

/**
 * Server Action detrás del botón "Emitir" del panel (§servidor.ts).
 *
 * `haySesion()` de nuevo aquí, y no solo confiar en que la página ya lo pidió:
 * un Server Action es un endpoint por su cuenta, alcanzable aunque alguien se
 * salte la pantalla que lo muestra.
 */
export async function emitirLicencia(
  _estado: EstadoEmision,
  datos: FormData,
): Promise<EstadoEmision> {
  if (!(await haySesion())) return { error: "Sesión vencida. Vuelve a entrar.", certificado: null, hasta: null };

  const r = await emitirDesdeElPanel({
    codigo: String(datos.get("codigo") ?? ""),
    nombre: String(datos.get("nombre") ?? ""),
    duracionTexto: String(datos.get("duracion") ?? "1"),
  });
  if (!r.ok) return { error: r.error, certificado: null, hasta: null };

  revalidatePath("/licencias");
  return { error: null, certificado: r.certificado, hasta: r.hasta };
}

/**
 * Renovar una fila ya existente en un clic, sin volver a escribir el código:
 * el botón "Renovar" de cada fila de la tabla. Misma validación y misma
 * firma que `emitirLicencia`, solo que no depende de un `<form>`.
 */
export async function renovar(
  codigo: string,
  nombre: string,
  duracionTexto: string,
): Promise<EstadoEmision> {
  if (!(await haySesion())) return { error: "Sesión vencida. Vuelve a entrar.", certificado: null, hasta: null };

  const r = await emitirDesdeElPanel({ codigo, nombre, duracionTexto });
  if (!r.ok) return { error: r.error, certificado: null, hasta: null };

  revalidatePath("/licencias");
  return { error: null, certificado: r.certificado, hasta: r.hasta };
}
