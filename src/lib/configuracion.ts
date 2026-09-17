/**
 * Comprobación de que el entorno está configurado.
 *
 * Sin las variables de Supabase la app no puede hacer nada: el cliente lanza al
 * construirse y cada petición acabaría en un 500 sin explicación. Con esto se
 * convierte en una pantalla que dice qué falta, lo que además permite desplegar
 * y abrir la app en el celular antes de tener la base montada.
 *
 * Se puede llamar desde el proxy y desde el servidor, así que no importa nada
 * que sea solo de servidor.
 */

export interface EstadoConfiguracion {
  completa: boolean;
  faltan: string[];
}

/** Lo que hace falta para que la app arranque. */
export function revisarConfiguracion(): EstadoConfiguracion {
  const faltan: string[] = [];

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) faltan.push("NEXT_PUBLIC_SUPABASE_URL");
  if (!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) faltan.push("NEXT_PUBLIC_SUPABASE_ANON_KEY");

  return { completa: faltan.length === 0, faltan };
}

/**
 * Lo que hace falta además para que funcione todo.
 *
 * No bloquean el arranque: se puede entrar y consultar el historial sin poder
 * cargar días nuevos, que es mejor que no poder entrar.
 */
export function revisarConfiguracionCompleta(): EstadoConfiguracion {
  const base = revisarConfiguracion();
  const faltan = [...base.faltan];

  if (!process.env.ANTHROPIC_API_KEY) faltan.push("ANTHROPIC_API_KEY");
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) faltan.push("SUPABASE_SERVICE_ROLE_KEY");

  return { completa: faltan.length === 0, faltan };
}
