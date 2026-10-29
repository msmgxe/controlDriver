import Link from "next/link";

import { haySesion } from "@/lib/licencia/sesion";

import { BotonSalir } from "./BotonSalir";

export const metadata = {
  title: "Licencias",
  robots: { index: false, follow: false },
};

/** Marco del panel de licencias: cabecera y ancho. La puerta (contraseña) está en cada página y en cada action. */
export default async function LayoutLicencias({ children }: { children: React.ReactNode }) {
  const dentro = await haySesion();
  return (
    <div data-superficie="admin" className="min-h-dvh bg-papel">
      <header className="sticky top-0 z-20 border-b border-linea bg-papel/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-[1100px] flex-wrap items-center gap-3 px-4 py-3">
          <Link href="/licencias" className="font-display text-xl">
            Licencias
          </Link>
          {dentro && <BotonSalir />}
        </div>
      </header>
      <main className="mx-auto max-w-[1100px] px-4 py-5">{children}</main>
    </div>
  );
}
