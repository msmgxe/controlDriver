import Link from "next/link";
import { redirect } from "next/navigation";

import { Alerta, Flecha } from "@/components/iconos";
import { perfilActual } from "@/lib/supabase/servidor";

export const metadata = { title: "Administración" };

/**
 * Panel de administración.
 *
 * Vive fuera de la PWA a propósito: es la única parte de RutaLog que se usa en
 * un monitor y no en un celular, así que usa la dirección visual **Profesional**
 * —reglas finas, esquinas rectas, densidad alta— que activa
 * `data-superficie="admin"` sobre los tokens de `globals.css`.
 */
export default async function LayoutAdmin({ children }: { children: React.ReactNode }) {
  const perfil = await perfilActual();
  if (!perfil) redirect("/acceso");

  if (perfil.rol !== "admin" || !perfil.activo) {
    return (
      <div data-superficie="admin" className="grid min-h-dvh place-items-center bg-papel px-4">
        <div className="flex max-w-sm flex-col items-center gap-4 text-center">
          <span className="grid size-14 place-items-center rounded-chip bg-mal-suave text-mal">
            <Alerta className="size-7" />
          </span>
          <h1 className="text-2xl">Esta sección es solo para el administrador</h1>
          <Link href="/" className="boton-sec">
            Volver a RutaLog
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div data-superficie="admin" className="min-h-dvh bg-papel">
      <header className="sticky top-0 z-20 border-b border-linea bg-papel/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-[1280px] flex-wrap items-center gap-3 px-6 py-4">
          <Link href="/" className="flex items-center gap-2 text-sm text-tinta-2 hover:text-tinta">
            <Flecha className="size-4 rotate-180" />
            RutaLog
          </Link>
          <span className="h-4 w-px bg-linea-fuerte" />
          <h1 className="font-display text-xl">Administración</h1>
          <span className="ml-auto text-xs text-tinta-3">{perfil.email}</span>
        </div>
      </header>
      <main className="mx-auto max-w-[1280px] px-6 py-6">{children}</main>
    </div>
  );
}
