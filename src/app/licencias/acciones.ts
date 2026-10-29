"use server";

import { revalidatePath } from "next/cache";

import { hoyEnLima } from "@/lib/fechas";
import {
  anotarLoginFallido,
  auditar,
  conSesion,
  limpiarLogin,
  loginBloqueado,
} from "@/lib/licencia/acceso";
import { anularPago, guardarContacto } from "@/lib/licencia/repositorio";
import { resumirIp } from "@/lib/licencia/seguridad";
import { cerrarSesion, ipDelCliente, iniciarSesion } from "@/lib/licencia/sesion";
import { CAMPOS_EMISION, emitirDesdeElPanel, reenviarCertificado } from "@/lib/licencia/servidor";
import { esquemaCodigo, esquemaContacto, primerError, textoDe } from "@/lib/licencia/validar";

import type { Estado } from "./tipos";

const SIN_SESION: Estado = { error: "Sesión vencida. Vuelve a entrar." };

/**
 * Entrar. Máximo 5 intentos fallidos por IP en 15 minutos; la contraseña se
 * compara en tiempo constante. Esta es la única action que no pide sesión.
 */
export async function entrar(_estado: { error: string | null }, datos: FormData): Promise<{ error: string | null }> {
  const ip = await ipDelCliente();
  if (await loginBloqueado(ip)) {
    return { error: "Demasiados intentos. Espera 15 minutos antes de volver a probar." };
  }
  const clave = String(datos.get("clave") ?? "").slice(0, 200);
  if (!(await iniciarSesion(clave))) {
    await anotarLoginFallido(ip);
    return { error: "Contraseña incorrecta." };
  }
  await limpiarLogin(ip);
  await auditar("login", null, resumirIp(ip));
  revalidatePath("/licencias");
  return { error: null };
}

export async function salir(): Promise<void> {
  await cerrarSesion();
  revalidatePath("/licencias");
}

/** Emitir licencia nueva (código + nombre + meses + monto + método). */
export async function emitirLicencia(_estado: Estado, datos: FormData): Promise<Estado> {
  return conSesion(async ({ ip }) => {
    const r = await emitirDesdeElPanel(textoDe(datos, CAMPOS_EMISION), ip, "emitir");
    if (!r.ok) return { error: r.error };
    revalidatePath("/licencias");
    return { error: null, resultado: r };
  }, SIN_SESION);
}

/** Renovar desde la ficha: mismos campos, el código viene oculto. */
export async function renovarLicencia(_estado: Estado, datos: FormData): Promise<Estado> {
  return conSesion(async ({ ip }) => {
    const r = await emitirDesdeElPanel(textoDe(datos, CAMPOS_EMISION), ip, "renovar");
    if (!r.ok) return { error: r.error };
    revalidatePath("/licencias");
    revalidatePath(`/licencias/${r.codigo}`);
    return { error: null, resultado: r };
  }, SIN_SESION);
}

/** «Copiar mensaje para WhatsApp» sin pago nuevo: vuelve a firmar la vigencia actual. */
export async function mensajeDeWhatsApp(codigo: string): Promise<Estado> {
  return conSesion(async ({ ip }) => {
    const r = await reenviarCertificado(codigo, ip);
    return r.ok ? { error: null, resultado: r } : { error: r.error };
  }, SIN_SESION);
}

/** Segundo paso de la anulación: el cliente manda el id del pago que vio. */
export async function anularUltimoPago(codigo: string, pagoId: number): Promise<Estado> {
  return conSesion(async ({ ip }) => {
    const c = esquemaCodigo.safeParse(codigo);
    if (!c.success) return { error: primerError(c.error) };
    if (!Number.isInteger(pagoId) || pagoId < 1) return { error: "Pago inválido." };
    const r = await anularPago(c.data, pagoId, hoyEnLima());
    if (!r.ok) return { error: r.error };
    await auditar("anular", c.data, ip);
    revalidatePath("/licencias");
    revalidatePath(`/licencias/${c.data}`);
    return { error: null, aviso: "Pago anulado. Ojo: el mensaje que ya enviaste sigue funcionando en su teléfono." };
  }, SIN_SESION);
}

export async function actualizarContacto(_estado: Estado, datos: FormData): Promise<Estado> {
  return conSesion(async ({ ip }) => {
    const v = esquemaContacto.safeParse(textoDe(datos, ["codigo", "nombre", "telefono", "notas"]));
    if (!v.success) return { error: primerError(v.error) };
    if (!(await guardarContacto(v.data))) return { error: "No existe esa licencia." };
    await auditar("contacto", v.data.codigo, ip);
    revalidatePath(`/licencias/${v.data.codigo}`);
    revalidatePath("/licencias");
    return { error: null, aviso: "Guardado." };
  }, SIN_SESION);
}
