import { createBrowserClient } from "@supabase/ssr";

/**
 * Cliente de Supabase para el navegador.
 *
 * Solo usa la URL y la anon key, las dos únicas variables con prefijo
 * NEXT_PUBLIC_ del proyecto. La service role key y la clave de Anthropic no
 * salen nunca del servidor (§7).
 */
export function clienteNavegador() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}

/* ---------------------------------------------------------------------------
 * Acceso con correo y código de 6 dígitos
 *
 * Sustituye el usuario + contraseña de §12. Ver NOTAS-DE-IMPLEMENTACION.md.
 * Requiere que en Supabase la plantilla de Magic Link use {{ .Token }}, que es
 * lo que hace que llegue un código en vez de un enlace.
 * ------------------------------------------------------------------------- */

/**
 * Paso 1: pedir el código.
 *
 * `shouldCreateUser: false` es lo que mantiene cerrado el registro público
 * (§7): si el correo no tiene cuenta, no se crea ninguna.
 */
export async function pedirCodigo(email: string) {
  const supabase = clienteNavegador();
  return supabase.auth.signInWithOtp({
    email: email.trim().toLowerCase(),
    options: { shouldCreateUser: false },
  });
}

/** Paso 2: canjear el código de 6 dígitos por una sesión. */
export async function verificarCodigo(email: string, codigo: string) {
  const supabase = clienteNavegador();
  return supabase.auth.verifyOtp({
    email: email.trim().toLowerCase(),
    token: codigo.replace(/\D/g, ""),
    type: "email",
  });
}

export async function cerrarSesion() {
  const supabase = clienteNavegador();
  return supabase.auth.signOut();
}
