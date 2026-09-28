"use client";

import { IconoApp } from "@/components/IconoApp";
import { LineaCopyright } from "@/components/TextoLegal";
import { useVersion } from "@/hooks/useVersion";

/**
 * Acerca de: quién hizo la app, qué versión es, y cómo contactar. La última
 * puerta del menú «Más» —no hace falta encontrarla rápido, solo que exista—.
 */
export default function PaginaAcercaDe() {
  const datos = useVersion();

  return (
    <div className="mx-auto flex max-w-[420px] flex-col items-center gap-6 px-4 py-10 text-center">
      <IconoApp className="size-20 shrink-0" />

      <div>
        <h2 className="font-display text-2xl font-bold">Control Driver</h2>
        <p className="mt-1 text-sm text-tinta-2">
          {datos ? `Versión ${datos.version} · v${datos.build}` : "…"}
        </p>
      </div>

      <div className="w-full border-t border-linea" />

      <div className="flex flex-col gap-1.5 text-sm text-tinta-2">
        <LineaCopyright />
        <a href="tel:+51984368710" className="font-semibold text-acento-tinta underline underline-offset-2">
          Tel.: 984 368 710
        </a>
      </div>
    </div>
  );
}
