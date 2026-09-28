import Link from "next/link";

export const metadata = { title: "Licencias" };

/**
 * Panel de licencias: quién pagó y hasta cuándo, de un vistazo, desde
 * cualquier lado. Reemplaza al `/admin` viejo (ver `Archivos MD/Proximos
 * pasos Web App.md`); usa la misma dirección visual **Profesional** —reglas
 * finas, esquinas rectas, densidad alta— para un monitor, no un celular.
 *
 * No emite licencias: eso lo sigue haciendo `npm run licencia` por la
 * terminal, con la clave privada que nunca sale de esa Mac. Esto solo lee.
 */
export default function LayoutLicencias({ children }: { children: React.ReactNode }) {
  return (
    <div data-superficie="admin" className="min-h-dvh bg-papel">
      <header className="sticky top-0 z-20 border-b border-linea bg-papel/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-[1000px] flex-wrap items-center gap-3 px-6 py-4">
          <Link href="/" className="text-sm text-tinta-2 hover:text-tinta">
            ← Control Driver
          </Link>
          <span className="h-4 w-px bg-linea-fuerte" />
          <h1 className="font-display text-xl">Licencias</h1>
        </div>
      </header>
      <main className="mx-auto max-w-[1000px] px-6 py-6">{children}</main>
    </div>
  );
}
