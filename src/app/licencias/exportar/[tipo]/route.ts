import { hoyEnLima } from "@/lib/fechas";
import { auditar, exigirSesion, SinSesion } from "@/lib/licencia/acceso";
import { csvDePagos, csvDeUsuarios } from "@/lib/licencia/panel";
import { listarLicencias, listarPagos } from "@/lib/licencia/repositorio";

export const dynamic = "force-dynamic";

/**
 * Exportar CSV de pagos o de usuarios. Comprueba la sesión aquí mismo (un
 * route handler es un endpoint público si no se protege) y deja constancia
 * en la auditoría.
 */
export async function GET(_req: Request, ctx: { params: Promise<{ tipo: string }> }) {
  let ip: string;
  try {
    ({ ip } = await exigirSesion());
  } catch (e) {
    if (e instanceof SinSesion) return new Response("No autorizado", { status: 401, headers: { "Cache-Control": "no-store" } });
    throw e;
  }

  const { tipo } = await ctx.params;
  if (tipo !== "pagos" && tipo !== "usuarios") return new Response("No existe", { status: 404 });

  const [licencias, pagos] = await Promise.all([listarLicencias(), listarPagos()]);
  const hoy = hoyEnLima();
  const csv =
    tipo === "pagos"
      ? csvDePagos(pagos, new Map(licencias.map((l) => [l.codigo, l.nombre])))
      : csvDeUsuarios(licencias, pagos, hoy);

  await auditar(tipo === "pagos" ? "exportar_pagos" : "exportar_usuarios", null, ip);

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="control-driver-${tipo}-${hoy}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
