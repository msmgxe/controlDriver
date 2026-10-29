import Link from "next/link";

import { FiguraDeAccion } from "@/components/Acciones";
import { Flecha } from "@/components/iconos";
import { Reintentar } from "./Reintentar";

export const metadata = { title: "Sin conexión" };

/**
 * Pantalla que sirve el service worker cuando no hay red y la página pedida no
 * estaba en caché (§8).
 *
 * Vive fuera del layout autenticado a propósito: sin red no se puede comprobar
 * la sesión, y mandar a /acceso a alguien que ya tiene sesión solo porque está
 * en un sótano sin cobertura sería peor que esto.
 */
export default function PaginaSinConexion() {
  return (
    <div className="grid min-h-dvh place-items-center px-4 py-6">
      <div className="aju-cent w-full max-w-sm rise-v2">
        <svg viewBox="0 0 200 160" width="220" aria-hidden="true">
          <circle className="aju-onda" cx="100" cy="86" r="40" style={{ fill: "var(--aviso-suave)" }} />
          <circle className="aju-onda d" cx="100" cy="86" r="40" style={{ fill: "var(--aviso-suave)" }} />
          <g className="aju-nube">
            <path d="M62 112a22 22 0 010-44 32 32 0 0161 8 19 19 0 013 36z" style={{ fill: "var(--aviso)" }} />
            <path d="M82 82l36 30M118 82l-36 30" stroke="#fff" strokeWidth="7" strokeLinecap="round" />
          </g>
        </svg>

        <h1 className="text-2xl">Sin conexión</h1>
        <p className="text-sm text-tinta-2">
          Tu historial y tus estadísticas siguen disponibles. Para cargar capturas necesitas internet: tus fotos
          siguen en la galería y no se pierden.
        </p>

        <div className="flex w-full flex-col gap-2.5">
          <Reintentar />
          <Link href="/historial" className="fila-color">
            <FiguraDeAccion k="historial" />
            <span className="min-w-0 text-left">
              <b className="block leading-tight">Ver el historial</b>
              <small className="block text-tinta-2">Tus pedidos guardados</small>
            </span>
            <Flecha className="ml-auto size-[18px] text-tinta-3" />
          </Link>
          <Link href="/estadisticas" className="fila-color">
            <FiguraDeAccion k="stats" />
            <span className="min-w-0 text-left">
              <b className="block leading-tight">Ver estadísticas</b>
              <small className="block text-tinta-2">Tu semana y tu mes</small>
            </span>
            <Flecha className="ml-auto size-[18px] text-tinta-3" />
          </Link>
        </div>

        <p className="rounded-2xl bg-aviso-suave p-3 text-sm font-semibold text-aviso">
          Cuando vuelva la señal, todo seguirá como lo dejaste.
        </p>
      </div>
    </div>
  );
}
