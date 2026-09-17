import "server-only";
import { createClient } from "@supabase/supabase-js";

/**
 * Cliente con service role.
 *
 * **Salta la RLS por completo.** Solo puede usarse dentro de un Server Action
 * o Route Handler que ya haya comprobado el rol con `perfilActual()` (§12). El
 * import de `server-only` hace que el build falle si este módulo llega a un
 * componente de cliente, que es la forma más fácil de filtrar la clave.
 */
export function clienteAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const clave = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !clave) {
    throw new Error(
      "Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY para las tareas de administración.",
    );
  }

  return createClient(url, clave, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
