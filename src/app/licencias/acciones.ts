"use server";

import { revalidatePath } from "next/cache";

import { cerrarSesion, iniciarSesion } from "@/lib/licencia/sesion";

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
