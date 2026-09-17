import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

/**
 * Cliente de Supabase para Server Components, Server Actions y Route Handlers.
 *
 * Se crea uno nuevo por render: nunca se comparte entre peticiones.
 */
export async function clienteServidor() {
  const almacenDeCookies = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return almacenDeCookies.getAll();
        },
        setAll(cookiesPorEscribir) {
          try {
            for (const { name, value, options } of cookiesPorEscribir) {
              almacenDeCookies.set(name, value, options);
            }
          } catch {
            // Los Server Components no pueden escribir cookies. No pasa nada:
            // el refresco de sesión lo hace proxy.ts, que sí puede.
          }
        },
      },
    },
  );
}

export type Rol = "admin" | "driver";

export interface Perfil {
  id: string;
  email: string;
  nombre: string;
  rol: Rol;
  activo: boolean;
  vigente_hasta: string | null;
}

/**
 * Perfil del usuario de la petición, o null si no hay sesión.
 *
 * El rol se lee SIEMPRE de aquí, en servidor. Nunca se confía en un rol que
 * mande el cliente (§7).
 */
export async function perfilActual(): Promise<Perfil | null> {
  const supabase = await clienteServidor();

  // getUser valida el token contra Supabase; getSession solo lee la cookie.
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from("perfiles")
    .select("id, email, nombre, rol, activo, vigente_hasta")
    .eq("id", user.id)
    .single();

  return (data as Perfil) ?? null;
}

/** ¿La suscripción sigue vigente? Sin fecha, no caduca (§12). */
export function suscripcionVigente(perfil: Perfil, hoy: string): boolean {
  return perfil.vigente_hasta === null || perfil.vigente_hasta >= hoy;
}

/**
 * Una cuenta vencida puede seguir consultando y exportando su historial, pero
 * no cargar días nuevos (§12).
 */
export function puedeCargarJornadas(perfil: Perfil, hoy: string): boolean {
  return perfil.activo && suscripcionVigente(perfil, hoy);
}
