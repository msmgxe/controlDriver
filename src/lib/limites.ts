import "server-only";
import { clienteServidor } from "@/lib/supabase/servidor";

/**
 * Límite de gasto por usuario (§7).
 *
 * Se cuenta contra la tabla `cargas`, no contra memoria del proceso: en
 * serverless cada petición puede caer en una instancia distinta, así que un
 * contador en memoria no limita nada. La tabla ya existe para auditoría y para
 * medir el costo por driver (§12), así que no hace falta infraestructura nueva.
 */

const CARGAS_POR_HORA = Number(process.env.LIMITE_CARGAS_POR_HORA ?? 10);
const IMAGENES_POR_DIA = Number(process.env.LIMITE_IMAGENES_POR_DIA ?? 40);

export interface ResultadoLimite {
  permitido: boolean;
  mensaje: string;
}

export async function comprobarLimite(userId: string): Promise<ResultadoLimite> {
  const supabase = await clienteServidor();

  const haceUnaHora = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const { count: cargasRecientes } = await supabase
    .from("cargas")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .gte("created_at", haceUnaHora);

  if ((cargasRecientes ?? 0) >= CARGAS_POR_HORA) {
    return {
      permitido: false,
      mensaje: `Has hecho ${cargasRecientes} cargas en la última hora. Espera un rato antes de subir más.`,
    };
  }

  const haceUnDia = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { data: delDia } = await supabase
    .from("cargas")
    .select("tokens_entrada")
    .eq("user_id", userId)
    .gte("created_at", haceUnDia);

  // Una imagen ≈ una llamada; se cuenta por filas de carga como aproximación
  // barata al número de imágenes procesadas hoy.
  const cargasDelDia = (delDia ?? []).length;
  if (cargasDelDia >= IMAGENES_POR_DIA) {
    return {
      permitido: false,
      mensaje: "Llegaste al límite de cargas del día. Vuelve mañana o habla con el administrador.",
    };
  }

  return { permitido: true, mensaje: "" };
}
