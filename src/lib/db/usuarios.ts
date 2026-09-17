import "server-only";
import { clienteAdmin } from "@/lib/supabase/admin";
import type { FechaISO } from "@/lib/fechas";
import type { Rol } from "@/lib/supabase/servidor";

/**
 * Listado de cuentas para el panel de administración (§12).
 *
 * Trae **métricas de uso**, no datos de trabajo: última carga, número de cargas
 * del mes e imágenes leídas, que es lo que hace falta para gestionar cuentas y
 * conocer el costo real de API por driver.
 *
 * Deliberadamente NO trae jornadas, pedidos ni montos de otros drivers. §12 lo
 * vende como argumento: los ingresos de cada uno son privados. Si algún día se
 * decide lo contrario, hay que cambiarlo aquí Y en las políticas RLS, y
 * avisarles antes.
 */

export interface UsuarioAdmin {
  id: string;
  email: string;
  nombre: string;
  rol: Rol;
  activo: boolean;
  vigenteHasta: FechaISO | null;
  ultimaCarga: string | null;
  cargasDelMes: number;
  imagenesDelMes: number;
}

/** Costo estimado por imagen leída, para la columna de gasto. */
export const COSTO_POR_IMAGEN_SOLES = Number(process.env.COSTO_POR_IMAGEN_SOLES ?? 0.042);

export async function listarUsuarios(): Promise<UsuarioAdmin[]> {
  const admin = clienteAdmin();

  const { data: perfiles, error } = await admin
    .from("perfiles")
    .select("id, email, nombre, rol, activo, vigente_hasta")
    .order("nombre", { ascending: true });

  if (error) throw new Error(`No se pudieron leer las cuentas: ${error.message}`);

  const inicioDeMes = new Date();
  inicioDeMes.setUTCDate(1);
  inicioDeMes.setUTCHours(0, 0, 0, 0);

  const { data: cargas } = await admin
    .from("cargas")
    .select("user_id, created_at, tokens_entrada")
    .gte("created_at", inicioDeMes.toISOString());

  const porUsuario = new Map<string, { cargas: number; ultima: string | null }>();
  for (const carga of cargas ?? []) {
    const actual = porUsuario.get(carga.user_id as string) ?? { cargas: 0, ultima: null };
    actual.cargas += 1;
    const fecha = carga.created_at as string;
    if (!actual.ultima || fecha > actual.ultima) actual.ultima = fecha;
    porUsuario.set(carga.user_id as string, actual);
  }

  return (perfiles ?? []).map((p) => {
    const uso = porUsuario.get(p.id as string);
    return {
      id: p.id as string,
      email: p.email as string,
      nombre: p.nombre as string,
      rol: p.rol as Rol,
      activo: Boolean(p.activo),
      vigenteHasta: (p.vigente_hasta as FechaISO | null) ?? null,
      ultimaCarga: uso?.ultima ?? null,
      cargasDelMes: uso?.cargas ?? 0,
      // Una llamada por imagen: el número de cargas es el de imágenes leídas.
      imagenesDelMes: uso?.cargas ?? 0,
    };
  });
}
