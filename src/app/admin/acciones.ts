"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { clienteAdmin } from "@/lib/supabase/admin";
import { perfilActual } from "@/lib/supabase/servidor";

/**
 * Gestión de cuentas (§12).
 *
 * Todo lo de aquí usa la service role key, que salta la RLS, así que cada
 * acción empieza comprobando el rol **en servidor**. Nunca se confía en que el
 * cliente diga que es admin.
 *
 * Con el acceso por correo y código no hay contraseñas: no existe "contraseña
 * temporal", ni "restablecer clave", ni `debe_cambiar_clave`. Lo que el admin
 * puede hacer es dar de alta, corregir un correo, desactivar y dar vigencia.
 */

type Resultado = { ok: true; mensaje: string } | { ok: false; error: string };

async function soloAdmin(): Promise<{ ok: true } | { ok: false; error: string }> {
  const perfil = await perfilActual();
  if (!perfil) return { ok: false, error: "No hay sesión." };
  if (perfil.rol !== "admin" || !perfil.activo) {
    return { ok: false, error: "Esta acción es solo para administradores." };
  }
  return { ok: true };
}

const esquemaAlta = z.object({
  nombre: z.string().min(2).max(80),
  email: z.string().email().max(160),
  vigenteHasta: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable(),
});

/**
 * Alta de un driver.
 *
 * Se crea la cuenta ya confirmada; el driver entra pidiendo su código desde la
 * pantalla de acceso. No hay ningún secreto que entregar en mano.
 */
export async function crearDriver(datos: unknown): Promise<Resultado> {
  const permiso = await soloAdmin();
  if (!permiso.ok) return { ok: false, error: permiso.error };

  const parseado = esquemaAlta.safeParse(datos);
  if (!parseado.success) return { ok: false, error: "Nombre o correo no válidos." };
  const { nombre, email, vigenteHasta } = parseado.data;
  const correo = email.trim().toLowerCase();

  try {
    const admin = clienteAdmin();

    const { data: creado, error: fallo } = await admin.auth.admin.createUser({
      email: correo,
      email_confirm: true,
    });
    if (fallo || !creado.user) {
      return {
        ok: false,
        error:
          fallo?.message.includes("already") === true
            ? "Ese correo ya tiene una cuenta."
            : (fallo?.message ?? "No se pudo crear la cuenta."),
      };
    }

    const { error: falloPerfil } = await admin.from("perfiles").insert({
      id: creado.user.id,
      email: correo,
      nombre,
      rol: "driver",
      activo: true,
      vigente_hasta: vigenteHasta,
    });

    if (falloPerfil) {
      // Sin perfil la cuenta no sirve para nada y dejaría un usuario huérfano
      // en auth: se deshace el alta.
      await admin.auth.admin.deleteUser(creado.user.id);
      return { ok: false, error: `No se pudo crear el perfil: ${falloPerfil.message}` };
    }

    revalidatePath("/admin");
    return {
      ok: true,
      mensaje: `${nombre} ya puede entrar. Dile que abra RutaLog y escriba ${correo}; le llegará su código.`,
    };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "No se pudo crear la cuenta.",
    };
  }
}

/** Activa o desactiva una cuenta. El historial se conserva siempre (§12). */
export async function cambiarActivo(userId: string, activo: boolean): Promise<Resultado> {
  const permiso = await soloAdmin();
  if (!permiso.ok) return { ok: false, error: permiso.error };

  try {
    const admin = clienteAdmin();
    const { error } = await admin.from("perfiles").update({ activo }).eq("id", userId);
    if (error) return { ok: false, error: error.message };

    revalidatePath("/admin");
    return { ok: true, mensaje: activo ? "Cuenta reactivada." : "Cuenta desactivada." };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "No se pudo cambiar el estado.",
    };
  }
}

/**
 * Cambia el correo de un driver.
 *
 * Es la operación de recuperación del sistema: si alguien pierde el acceso a su
 * buzón, pierde el acceso a la app, y esto es lo que lo arregla.
 */
export async function cambiarCorreo(userId: string, nuevoCorreo: string): Promise<Resultado> {
  const permiso = await soloAdmin();
  if (!permiso.ok) return { ok: false, error: permiso.error };

  const correo = nuevoCorreo.trim().toLowerCase();
  if (!z.string().email().safeParse(correo).success) {
    return { ok: false, error: "Ese correo no es válido." };
  }

  try {
    const admin = clienteAdmin();
    const { error: falloAuth } = await admin.auth.admin.updateUserById(userId, {
      email: correo,
      email_confirm: true,
    });
    if (falloAuth) return { ok: false, error: falloAuth.message };

    const { error } = await admin.from("perfiles").update({ email: correo }).eq("id", userId);
    if (error) return { ok: false, error: error.message };

    revalidatePath("/admin");
    return { ok: true, mensaje: `Ahora entra con ${correo}.` };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "No se pudo cambiar el correo.",
    };
  }
}

/** Amplía (o quita) la vigencia de la suscripción (§12). */
export async function cambiarVigencia(
  userId: string,
  vigenteHasta: string | null,
): Promise<Resultado> {
  const permiso = await soloAdmin();
  if (!permiso.ok) return { ok: false, error: permiso.error };

  if (vigenteHasta !== null && !/^\d{4}-\d{2}-\d{2}$/.test(vigenteHasta)) {
    return { ok: false, error: "Fecha no válida." };
  }

  try {
    const admin = clienteAdmin();
    const { error } = await admin
      .from("perfiles")
      .update({ vigente_hasta: vigenteHasta })
      .eq("id", userId);
    if (error) return { ok: false, error: error.message };

    revalidatePath("/admin");
    return {
      ok: true,
      mensaje: vigenteHasta ? `Vigente hasta ${vigenteHasta}.` : "Sin límite de vigencia.",
    };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "No se pudo cambiar la vigencia.",
    };
  }
}
