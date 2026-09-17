import { redirect } from "next/navigation";

import { Armazon } from "@/components/Armazon";
import { ServicioPWA } from "@/components/ServicioPWA";
import { Alerta } from "@/components/iconos";
import { hoyEnLima } from "@/lib/fechas";
import { perfilActual, suscripcionVigente } from "@/lib/supabase/servidor";

/**
 * Layout autenticado.
 *
 * `proxy.ts` ya rechazó a quien no tiene sesión; aquí se comprueban las cosas
 * que dependen del perfil y que no conviene consultar en cada petición del
 * proxy: rol, cuenta activa y vigencia de la suscripción (§7, §12).
 */
export default async function LayoutApp({ children }: { children: React.ReactNode }) {
  const perfil = await perfilActual();
  if (!perfil) redirect("/acceso");

  if (!perfil.activo) {
    return (
      <div className="grid min-h-dvh place-items-center px-4">
        <div className="flex max-w-sm flex-col items-center gap-4 text-center">
          <span className="grid size-14 place-items-center rounded-full bg-mal-suave text-mal">
            <Alerta className="size-7" />
          </span>
          <h1 className="text-2xl">Tu cuenta está desactivada</h1>
          <p className="text-sm text-tinta-2">
            Tu historial se conserva completo. Habla con el administrador para volver a entrar.
          </p>
        </div>
      </div>
    );
  }

  const hoy = hoyEnLima();

  return (
    <Armazon nombre={perfil.nombre} email={perfil.email} rol={perfil.rol}>
      {!suscripcionVigente(perfil, hoy) && (
        <div className="mx-auto mb-4 flex max-w-[880px] gap-3 rounded-btn bg-aviso-suave px-4 py-3 text-sm text-aviso">
          <Alerta className="mt-0.5 size-[18px] shrink-0" />
          <div>
            <strong className="block font-bold">Tu suscripción venció</strong>
            <p>
              Puedes consultar y exportar todo tu historial, pero no cargar días nuevos hasta
              renovarla.
            </p>
          </div>
        </div>
      )}
      {children}
      <ServicioPWA />
    </Armazon>
  );
}
