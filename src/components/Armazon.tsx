"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useSyncExternalStore, useState } from "react";

import { Auto } from "@/components/Auto";
import { BloqueoApp } from "@/components/BloqueoApp";
import { ProveedorDeCarga, useCarga } from "@/components/CargaDeCapturas";
import { HojaDeCarga } from "@/components/HojaDeCarga";
import { usePuedeEscribir } from "@/components/Licencia";
import {
  Barras,
  Buscar,
  Calendario,
  Candado,
  Cartera,
  Casa,
  Equis,
  Gente,
  Mas,
  Salir,
  Tutorial,
} from "@/components/iconos";
import { useCapa } from "@/hooks/useCapa";
import { useVehiculo } from "@/hooks/useVehiculo";
import {
  cerrarDeNuevo,
  instantaneaAjustes,
  instantaneaAjustesServidor,
  suscribirBloqueo,
} from "@/lib/bloqueo";
import { useDiaElegido } from "@/lib/diaElegido";
import { hoyEnLima } from "@/lib/fechas";
import { PUERTAS, PUERTAS_PRINCIPALES, puertaDe, tituloDe, type Puerta } from "@/lib/navegacion";
/** Dentro del APK solo existe el repartidor; el administrador vive en la web. */
type Rol = "admin" | "driver";

/**
 * Armazón de la app del driver.
 *
 * **Móvil**: una barra de abajo con las puertas principales —Inicio, Cargar,
 * Pagos, Estadísticas, `PUERTAS_PRINCIPALES` de ellas—, más grandes que antes
 * para llegar a un pulgar sin fijarse, y un quinto botón «Más» que abre las
 * demás (Buscar, Historial, Tutoriales, Ajustes) en una hoja. La que se está
 * mirando lleva la pastilla de color detrás del icono —o detrás de «Más», si
 * vive en su menú—; «Cargar» no es una pantalla, abre una hoja que pregunta
 * qué se carga y para qué día (ver `HojaDeCarga`).
 *
 * **Desde 900 px**: la barra lateral fija sí enseña `PUERTAS` entera —hay
 * espacio de sobra— y la de abajo desaparece.
 */

/** El icono de cada puerta. «Cargar» no lleva: dibuja el vehículo del perfil. */
const ICONOS: Record<string, typeof Casa | undefined> = {
  inicio: Casa,
  pagos: Cartera,
  historial: Calendario,
  buscar: Buscar,
  estadisticas: Barras,
  tutoriales: Tutorial,
  ajustes: Candado,
};

const DESTINOS_ADMIN: Array<{ href: string; nombre: string; Icono: typeof Casa }> = [
  { href: "/admin", nombre: "Usuarios", Icono: Gente },
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
  const [cargando, setCargando] = useState(false);
  const [masAbierto, setMasAbierto] = useState(false);
  const { abrir, trabajando, deshabilitado } = useCarga();
  const vehiculo = useVehiculo();
  const diaElegido = useDiaElegido();

  // El botón de bloquear solo tiene sentido si hay un PIN puesto.
  const [conPin] = useSyncExternalStore(
    suscribirBloqueo,
    instantaneaAjustes,
    instantaneaAjustesServidor,
  )
    .split(",")
    .map((v) => v === "true");

  const activa = puertaDe(ruta);
  const titulo = tituloDe(ruta);

  /* En el móvil, la barra de abajo no cabe entera: las primeras se quedan a la
     vista, más grandes, y el resto vive detrás de «Más». Cierra el menú solo
     al cambiar de pantalla, no al abrirlo de nuevo sobre la misma. */
  const principales = PUERTAS.slice(0, PUERTAS_PRINCIPALES);
  const resto = PUERTAS.slice(PUERTAS_PRINCIPALES);
  const masEncendido = resto.some((p) => p.id === activa);

  /* «Cargar» propone el día que se tiene delante: el de Inicio, si se está en
     Inicio; en cualquier otra pantalla, hoy. Cambiarlo es un toque en la hoja. */
  const diaInicial = ruta === "/" && diaElegido ? diaElegido : hoyEnLima();

  /* En el APK no hay sesión que cerrar: los datos son del dueño del teléfono
     y no viajan a ningún lado. Lo equivalente es echar el cerrojo, que es lo
     que de verdad protege la pantalla si alguien coge el aparato. */
  function bloquear() {
    cerrarDeNuevo();
    router.replace("/");
  }

  return (
    <BloqueoApp>
      <div className="grid min-h-dvh lg:grid-cols-[268px_1fr]">
        {/* Barra lateral: solo desde 900 px. En el móvil manda la de abajo. */}
        <aside
          aria-label="Menú principal"
          className="sticky top-0 hidden h-dvh flex-col gap-2 overflow-y-auto bg-papel px-3 pt-4 pb-4 lg:flex"
        >
          <div className="flex items-center gap-2 px-3 pt-2 pb-4">
            <Auto vehiculo={vehiculo} animado className="w-14 shrink-0" />
            <strong className="font-display text-2xl font-bold tracking-tight">Control Driver</strong>
          </div>

          <nav className="flex flex-col gap-0.5">
            {PUERTAS.map((p) => {
              const encendida = activa === p.id || (p.id === "cargar" && cargando);
              const clases = `flex min-h-12 items-center gap-3 rounded-full px-3 text-[15px] ${
                encendida
                  ? "bg-acento-suave font-semibold text-acento-tinta"
                  : "font-medium text-tinta-2 hover:bg-sup-2 hover:text-tinta"
              }`;
              const Icono = ICONOS[p.id];
              const icono = Icono ? (
                <Icono className="size-5 shrink-0" />
              ) : (
                <Auto vehiculo={vehiculo} mono icono className="shrink-0" />
              );
              return p.href ? (
                <Link
                  key={p.id}
                  href={p.href}
                  aria-current={activa === p.id ? "page" : undefined}
                  className={clases}
                >
                  {icono}
                  {p.nombre === "Hoy" ? "Inicio" : p.nombre}
                </Link>
              ) : (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setCargando(true)}
                  disabled={trabajando}
                  className={`${clases} disabled:opacity-60`}
                >
                  {icono}
                  {p.nombre}
                </button>
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
              onClick={bloquear}
              className="flex min-h-12 items-center gap-3 rounded-full px-3 text-[15px] font-medium text-tinta-2 hover:bg-sup-2 hover:text-tinta"
            >
              <Salir className="size-5 shrink-0" />
              Salir
            </button>
          </div>
        </aside>

        <div className="flex min-w-0 flex-col">
          <header className="sticky top-[env(safe-area-inset-top,0px)] z-20 flex items-center gap-3 border-b border-linea bg-papel/85 px-4 py-3 backdrop-blur-md lg:border-transparent">
            {/* La marca, en el móvil: el vehículo y el nombre de la pantalla. En
                escritorio la marca ya está en la barra lateral. */}
            <Auto vehiculo={vehiculo} className="w-11 shrink-0 lg:hidden" />
            <h1 className="min-w-0 flex-1 truncate text-[22px]">{titulo}</h1>
            {conPin && (
              <button
                type="button"
                onClick={bloquear}
                aria-label="Bloquear la app ahora"
                className="grid size-11 shrink-0 place-items-center rounded-full text-tinta-2 hover:bg-sup-2 lg:hidden"
              >
                <Candado className="size-5" />
              </button>
            )}
          </header>

          {/* `overflow-x-clip` y no `hidden`: la tira de semanas asoma la vecina al
              arrastrar y no debe crear una barra de desplazamiento, pero `hidden`
              haría de esto un contenedor de scroll y rompería los `sticky`. */}
          <main className="flex-1 overflow-x-clip px-4 pt-4 pb-[calc(7rem+env(safe-area-inset-bottom,0px))] lg:pb-16">
            {children}
          </main>
        </div>
      </div>

      {/* La barra de abajo: las puertas principales, más grandes, y «Más» al
          final para las demás. La encendida lleva una pastilla de color
          detrás del icono; «Cargar» se enciende mientras su hoja está
          abierta, y «Más» si la pantalla activa vive dentro de su menú. */}
      <nav
        aria-label="Navegación principal"
        className="fixed inset-x-0 bottom-0 z-30 grid items-end rounded-t-[20px] border-t border-linea bg-sup px-0.5 pt-2 pb-[calc(0.5rem+env(safe-area-inset-bottom,0px))] shadow-[0_-10px_24px_-16px_rgb(10_34_96/0.5)] lg:hidden"
        style={{ gridTemplateColumns: `repeat(${principales.length + 1}, minmax(0, 1fr))` }}
      >
        {principales.map((p) => {
          const encendida = activa === p.id || (p.id === "cargar" && cargando);
          const Icono = ICONOS[p.id];
          const icono = Icono ? <Icono className="size-7" /> : <Auto vehiculo={vehiculo} mono icono />;
          return p.href ? (
            <PuertaDeLaBarra
              key={p.id}
              nombre={p.corto ?? p.nombre}
              href={p.href}
              activa={encendida}
              icono={icono}
            />
          ) : (
            <PuertaDeLaBarra
              key={p.id}
              nombre={p.nombre}
              activa={encendida}
              icono={icono}
              deshabilitada={trabajando}
              alTocar={() => setCargando(true)}
            />
          );
        })}
        <PuertaDeLaBarra
          nombre="Más"
          activa={masEncendido}
          icono={<Mas className="size-7" />}
          alTocar={() => setMasAbierto(true)}
        />
      </nav>

      {masAbierto && (
        <MenuMas
          resto={resto}
          activa={activa}
          alCerrar={() => setMasAbierto(false)}
        />
      )}

      {cargando && (
        <HojaDeCarga
          diaInicial={diaInicial}
          deshabilitado={deshabilitado}
          alElegirCapturas={(dia) => {
            setCargando(false);
            abrir({ fechaPorDefecto: dia });
          }}
          alCerrar={() => setCargando(false)}
        />
      )}
    </BloqueoApp>
  );
}

/**
 * La hoja de «Más»: las puertas que no caben a la vista en el móvil. Es una
 * lista de enlaces sencilla, no un formulario, así que no hace falta el peso
 * de `Acordeon`; solo una hoja como las demás de la app.
 */
function MenuMas({
  resto,
  activa,
  alCerrar,
}: {
  resto: readonly Puerta[];
  activa: string;
  alCerrar: () => void;
}) {
  useCapa(alCerrar);
  return (
    <div
      className="fixed inset-0 z-40 flex items-end justify-center bg-black/50 lg:hidden"
      onClick={(e) => e.target === e.currentTarget && alCerrar()}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Más"
        className="flex w-full max-w-md flex-col gap-1 rounded-t-hoja bg-sup p-3 pb-[calc(0.75rem+env(safe-area-inset-bottom,0px))] shadow-alta"
      >
        <div className="relative mb-1 flex items-center justify-center px-1">
          <span className="block h-1 w-9 rounded-full bg-linea-fuerte" />
          <button
            type="button"
            onClick={alCerrar}
            aria-label="Cerrar"
            className="absolute right-1 grid size-11 shrink-0 place-items-center rounded-full text-tinta-2"
          >
            <Equis className="size-5" />
          </button>
        </div>
        {resto.map((p) => {
          const Icono = ICONOS[p.id];
          const encendida = activa === p.id;
          return (
            <Link
              key={p.id}
              href={p.href ?? "#"}
              onClick={alCerrar}
              aria-current={encendida ? "page" : undefined}
              className={`flex min-h-14 items-center gap-3 rounded-btn px-3 text-[16px] ${
                encendida ? "bg-acento-suave font-semibold text-acento-tinta" : "font-medium text-tinta"
              }`}
            >
              {Icono && <Icono className="size-6 shrink-0" />}
              {p.nombre}
            </Link>
          );
        })}
      </div>
    </div>
  );
}

/**
 * Una puerta de la barra de abajo: el icono —con su pastilla si es la que se
 * está mirando— y su nombre. Es un enlace, o un botón si es «Cargar».
 */
function PuertaDeLaBarra({
  nombre,
  href,
  activa,
  icono,
  alTocar,
  deshabilitada = false,
}: {
  nombre: string;
  href?: string;
  activa: boolean;
  icono: React.ReactNode;
  alTocar?: () => void;
  deshabilitada?: boolean;
}) {
  const clases = `flex min-h-14 min-w-0 flex-col items-center justify-end gap-1 text-[10px] leading-none tracking-[-0.01em] ${
    activa ? "font-bold text-tinta" : "font-semibold text-tinta-2"
  }`;
  const contenido = (
    <>
      <span className={`puerta-icono ${activa ? "puerta-icono--activa" : ""}`}>{icono}</span>
      <span className="max-w-full truncate">{nombre}</span>
    </>
  );

  return href ? (
    <Link href={href} aria-current={activa ? "page" : undefined} className={clases}>
      {contenido}
    </Link>
  ) : (
    <button
      type="button"
      onClick={alTocar}
      disabled={deshabilitada}
      aria-haspopup="dialog"
      className={`${clases} disabled:opacity-60`}
    >
      {contenido}
    </button>
  );
}
