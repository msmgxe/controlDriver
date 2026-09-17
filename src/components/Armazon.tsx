"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { BloqueoApp } from "@/components/BloqueoApp";
import {
  Barras,
  Calendario,
  Candado,
  Cartera,
  Casa,
  Gente,
  Menu,
  Salir,
} from "@/components/iconos";
import { cerrarSesion } from "@/lib/supabase/navegador";
import { cerrarDeNuevo } from "@/lib/bloqueo";
import type { Rol } from "@/lib/supabase/servidor";

/**
 * Armazón de la app del driver.
 *
 * Móvil: cajón lateral oculto que abre el botón hamburguesa.
 * Desde 900 px: el mismo cajón queda fijo como barra lateral y el botón
 * desaparece. Una sola estructura para los dos tamaños (§9).
 */

interface Destino {
  href: string;
  nombre: string;
  Icono: typeof Casa;
  soloAdmin?: boolean;
}

const DESTINOS: Destino[] = [
  { href: "/", nombre: "Hoy", Icono: Casa },
  { href: "/historial", nombre: "Historial", Icono: Calendario },
  { href: "/pagos", nombre: "Pagos", Icono: Cartera },
  { href: "/estadisticas", nombre: "Estadísticas", Icono: Barras },
];

const DESTINOS_ADMIN: Destino[] = [
  { href: "/admin", nombre: "Usuarios", Icono: Gente, soloAdmin: true },
];

export function Armazon({
  children,
  nombre,
  email,
  rol,
}: {
  children: React.ReactNode;
  nombre: string;
  email: string;
  rol: Rol;
}) {
  const ruta = usePathname();
  const router = useRouter();
  const [abierto, setAbierto] = useState(false);

  useEffect(() => {
    function alPulsar(e: KeyboardEvent) {
      if (e.key === "Escape") setAbierto(false);
    }
    document.addEventListener("keydown", alPulsar);
    return () => document.removeEventListener("keydown", alPulsar);
  }, []);

  const actual =
    [...DESTINOS, ...DESTINOS_ADMIN].find((d) =>
      d.href === "/" ? ruta === "/" : ruta.startsWith(d.href),
    ) ?? DESTINOS[0];

  async function salir() {
    cerrarDeNuevo();
    await cerrarSesion();
    router.replace("/acceso");
    router.refresh();
  }

  return (
    <BloqueoApp>
      <div className="grid min-h-dvh lg:grid-cols-[268px_1fr]">
        <aside
          id="cajon"
          aria-label="Menú principal"
          className={`fixed inset-y-0 left-0 z-40 flex w-[min(268px,84vw)] flex-col gap-2 overflow-y-auto bg-papel px-3 pt-[calc(1rem+env(safe-area-inset-top,0px))] pb-[calc(1rem+env(safe-area-inset-bottom,0px))] transition-transform duration-200 lg:sticky lg:top-0 lg:h-dvh lg:w-auto lg:translate-x-0 lg:shadow-none ${
            abierto ? "translate-x-0 shadow-alta" : "-translate-x-full"
          }`}
        >
          <div className="flex items-baseline gap-2 px-3 pt-2 pb-4">
            <strong className="font-display text-3xl font-bold tracking-tight">RutaLog</strong>
          </div>

          <nav className="flex flex-col gap-0.5">
            {DESTINOS.map(({ href, nombre: texto, Icono }) => {
              const activo = actual.href === href;
              return (
                <Link
                  key={href}
                  href={href}
                  onClick={() => setAbierto(false)}
                  aria-current={activo ? "page" : undefined}
                  className={`flex min-h-12 items-center gap-3 rounded-full px-3 text-[15px] ${
                    activo
                      ? "bg-acento-suave font-semibold text-acento-tinta"
                      : "font-medium text-tinta-2 hover:bg-sup-2 hover:text-tinta"
                  }`}
                >
                  <Icono className="size-5 shrink-0" />
                  {texto}
                </Link>
              );
            })}
          </nav>

          {rol === "admin" && (
            <>
              <div className="mx-3 my-3 h-px bg-linea" />
              <span className="rotulo px-3 py-2">Administración</span>
              <nav className="flex flex-col gap-0.5">
                {DESTINOS_ADMIN.map(({ href, nombre: texto, Icono }) => (
                  <Link
                    key={href}
                    href={href}
                    onClick={() => setAbierto(false)}
                    className="flex min-h-12 items-center gap-3 rounded-full px-3 text-[15px] font-medium text-tinta-2 hover:bg-sup-2 hover:text-tinta"
                  >
                    <Icono className="size-5 shrink-0" />
                    {texto}
                  </Link>
                ))}
              </nav>
            </>
          )}

          <div className="mt-auto flex flex-col gap-1">
            <Link
              href="/ajustes"
              onClick={() => setAbierto(false)}
              className="flex min-h-12 items-center gap-3 rounded-full px-3 text-[15px] font-medium text-tinta-2 hover:bg-sup-2 hover:text-tinta"
            >
              <Candado className="size-5 shrink-0" />
              Ajustes
            </Link>

            <div className="flex items-center gap-3 rounded-btn bg-sup-2 p-3">
              <span className="grid size-9 shrink-0 place-items-center rounded-full bg-acento font-display text-lg font-bold text-acento-texto">
                {nombre.slice(0, 1).toUpperCase()}
              </span>
              <span className="flex min-w-0 flex-col">
                <b className="text-sm font-semibold">{nombre}</b>
                <span className="truncate text-xs text-tinta-3">{email}</span>
              </span>
            </div>

            <button
              type="button"
              onClick={() => void salir()}
              className="flex min-h-12 items-center gap-3 rounded-full px-3 text-[15px] font-medium text-tinta-2 hover:bg-sup-2 hover:text-tinta"
            >
              <Salir className="size-5 shrink-0" />
              Salir
            </button>
          </div>
        </aside>

        {abierto && (
          <button
            type="button"
            aria-label="Cerrar menú"
            onClick={() => setAbierto(false)}
            className="fixed inset-0 z-30 bg-black/45 lg:hidden"
          />
        )}

        <div className="flex min-w-0 flex-col">
          <header className="sticky top-[env(safe-area-inset-top,0px)] z-20 flex items-center gap-3 border-b border-linea bg-papel/85 px-4 py-3 backdrop-blur-md lg:border-transparent">
            <button
              type="button"
              aria-label="Abrir menú"
              aria-expanded={abierto}
              aria-controls="cajon"
              onClick={() => setAbierto((v) => !v)}
              className="-ml-1.5 grid size-11 place-items-center rounded-btn hover:bg-sup-2 lg:hidden"
            >
              <Menu className="size-6" />
            </button>
            <h1 className="text-[22px]">{actual.nombre}</h1>
          </header>

          <main className="flex-1 px-4 pt-4 pb-16">{children}</main>
        </div>
      </div>
    </BloqueoApp>
  );
}
