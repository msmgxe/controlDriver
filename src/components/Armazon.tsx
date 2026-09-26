"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { Auto } from "@/components/Auto";
import { BloqueoApp } from "@/components/BloqueoApp";
import { ProveedorDeCarga, useCarga } from "@/components/CargaDeCapturas";
import { usePuedeEscribir } from "@/components/Licencia";
import {
  Barras,
  Buscar,
  Calendario,
  Candado,
  Cartera,
  Casa,
  Gente,
  Mas,
  Salir,
} from "@/components/iconos";
import { useVehiculo } from "@/hooks/useVehiculo";
import { cerrarDeNuevo } from "@/lib/bloqueo";
/** Dentro del APK solo existe el repartidor; el administrador vive en la web. */
type Rol = "admin" | "driver";

/**
 * Armazón de la app del driver.
 *
 * **Móvil**: una barra de abajo con cinco puertas —Inicio, Pagos, el auto que
 * carga capturas, Ajustes y «Más»—, siempre a un pulgar. Son las cinco cosas
 * que se tocan todos los días; «Buscar» y «Historial» no se usan a diario y
 * viven en «Más», que abre el mismo cajón lateral de siempre.
 *
 * **Desde 900 px**: el cajón queda fijo como barra lateral y la de abajo
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
  { href: "/buscar", nombre: "Buscar", Icono: Buscar },
  { href: "/historial", nombre: "Historial", Icono: Calendario },
  { href: "/pagos", nombre: "Pagos", Icono: Cartera },
  { href: "/estadisticas", nombre: "Estadísticas", Icono: Barras },
];

const DESTINOS_ADMIN: Destino[] = [
  { href: "/admin", nombre: "Usuarios", Icono: Gente, soloAdmin: true },
];

/**
 * La barra de abajo: Inicio y Pagos a la izquierda del auto, Ajustes a la
 * derecha. «Buscar» se usa poco —solo cuando se te pierde un pedido— y se
 * quedó mejor guardado en «Más», junto con Historial y Estadísticas.
 */
const PUERTAS: Array<{ href: string; nombre: string; Icono: typeof Casa }> = [
  { href: "/", nombre: "Inicio", Icono: Casa },
  { href: "/pagos", nombre: "Pagos", Icono: Cartera },
  { href: "/ajustes", nombre: "Ajustes", Icono: Candado },
];

export function Armazon(props: {
  children: React.ReactNode;
  nombre: string;
  email: string | null;
  rol: Rol;
}) {
  // La carga vive aquí, por encima de las pantallas, para que el auto de la
  // barra de abajo pueda abrirla desde cualquiera de ellas.
  const puedeEscribir = usePuedeEscribir();
  return (
    <ProveedorDeCarga deshabilitado={!puedeEscribir}>
      <ArmazonInterno {...props} />
    </ProveedorDeCarga>
  );
}

function ArmazonInterno({
  children,
  nombre,
  email,
  rol,
}: {
  children: React.ReactNode;
  nombre: string;
  email: string | null;
  rol: Rol;
}) {
  const ruta = usePathname();
  const router = useRouter();
  const [abierto, setAbierto] = useState(false);
  const { abrir, trabajando } = useCarga();
  const vehiculo = useVehiculo();

  useEffect(() => {
    function alPulsar(e: KeyboardEvent) {
      if (e.key === "Escape") setAbierto(false);
    }
    document.addEventListener("keydown", alPulsar);
    return () => document.removeEventListener("keydown", alPulsar);
  }, []);

  // Ajustes solo vive en la barra de abajo, pero su título tiene que salir arriba
  // igual: sin esto la cabecera decía «Hoy» estando en Ajustes.
  const actual =
    [...DESTINOS, ...DESTINOS_ADMIN, ...PUERTAS.filter((p) => p.href === "/ajustes")].find((d) =>
      d.href === "/" ? ruta === "/" : ruta.startsWith(d.href),
    ) ?? DESTINOS[0];

  /* Qué puerta de la barra de abajo está encendida. Todo lo que no tiene puerta
     propia —Historial, Estadísticas, Ajustes— cuelga de «Más». */
  const puertaActiva =
    PUERTAS.find((p) => (p.href === "/" ? ruta === "/" : ruta.startsWith(p.href)))?.href ?? "mas";

  /* En el APK no hay sesión que cerrar: los datos son del dueño del teléfono
     y no viajan a ningún lado. Lo equivalente es echar el cerrojo, que es lo
     que de verdad protege la pantalla si alguien coge el aparato. */
  function salir() {
    cerrarDeNuevo();
    router.replace("/");
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
          <div className="flex items-center gap-2 px-3 pt-2 pb-4">
            <Auto vehiculo={vehiculo} animado className="w-14 shrink-0" />
            <strong className="font-display text-2xl font-bold tracking-tight">Rutas-A</strong>
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
              aria-current={ruta.startsWith("/ajustes") ? "page" : undefined}
              className={`flex min-h-12 items-center gap-3 rounded-full px-3 text-[15px] ${
                ruta.startsWith("/ajustes")
                  ? "bg-acento-suave font-semibold text-acento-tinta"
                  : "font-medium text-tinta-2 hover:bg-sup-2 hover:text-tinta"
              }`}
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
                {email && <span className="truncate text-xs text-tinta-3">{email}</span>}
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
            {/* La marca, en el móvil: el auto y el nombre de la pantalla. En
                escritorio la marca ya está en la barra lateral. */}
            <Auto vehiculo={vehiculo} className="w-11 shrink-0 lg:hidden" />
            <h1 className="min-w-0 flex-1 truncate text-[22px]">{actual.nombre}</h1>
          </header>

          {/* `overflow-x-clip` y no `hidden`: la tira de semanas asoma la vecina al
              arrastrar y no debe crear una barra de desplazamiento, pero `hidden`
              haría de esto un contenedor de scroll y rompería los `sticky`. */}
          <main className="flex-1 overflow-x-clip px-4 pt-4 pb-[calc(7rem+env(safe-area-inset-bottom,0px))] lg:pb-16">
            {children}
          </main>
        </div>
      </div>

      {/* La barra de abajo: cinco puertas, la del medio es el auto. */}
      <nav
        aria-label="Navegación principal"
        className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 items-end rounded-t-[20px] border-t border-linea bg-sup px-1 pt-2 pb-[calc(0.5rem+env(safe-area-inset-bottom,0px))] shadow-[0_-10px_24px_-16px_rgb(10_34_96/0.5)] lg:hidden"
      >
        {PUERTAS.slice(0, 2).map((p) => (
          <PuertaDeLaBarra key={p.href} {...p} activa={puertaActiva === p.href} />
        ))}

        <button
          type="button"
          onClick={abrir}
          disabled={trabajando}
          aria-label="Cargar capturas"
          className="group flex min-h-14 flex-col items-center justify-end gap-1 text-[11px] font-semibold text-tinta-2 disabled:opacity-60"
        >
          <span className="boton-auto">
            <Auto vehiculo={vehiculo} mono animado={false} className="w-9" />
          </span>
          Cargar
        </button>

        {PUERTAS.slice(2).map((p) => (
          <PuertaDeLaBarra key={p.href} {...p} activa={puertaActiva === p.href} />
        ))}

        <button
          type="button"
          aria-label="Más: buscar, historial y estadísticas"
          aria-expanded={abierto}
          aria-controls="cajon"
          onClick={() => setAbierto((v) => !v)}
          className={`flex min-h-14 flex-col items-center justify-end gap-1 text-[11px] font-semibold ${
            puertaActiva === "mas" || abierto ? "text-acento" : "text-tinta-2"
          }`}
        >
          <Mas className="size-6" />
          Más
        </button>
      </nav>
    </BloqueoApp>
  );
}

function PuertaDeLaBarra({
  href,
  nombre,
  Icono,
  activa,
}: {
  href: string;
  nombre: string;
  Icono: typeof Casa;
  activa: boolean;
}) {
  return (
    <Link
      href={href}
      aria-current={activa ? "page" : undefined}
      className={`flex min-h-14 flex-col items-center justify-end gap-1 text-[11px] font-semibold ${
        activa ? "text-acento" : "text-tinta-2"
      }`}
    >
      <Icono className="size-6" />
      {nombre}
    </Link>
  );
}
