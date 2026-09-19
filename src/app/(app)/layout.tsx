"use client";

import Link from "next/link";

import { Armazon } from "@/components/Armazon";
import { BotonAtras } from "@/components/BotonAtras";
import { RedDeSeguridad } from "@/components/RedDeSeguridad";
import { ProveedorLicencia, useLicencia } from "@/components/Licencia";
import { Alerta } from "@/components/iconos";
import { useDatos } from "@/hooks/useDatos";
import { mensajeDeLicencia } from "@/lib/licencia/estado";
import { perfilActual, sembrarSiHaceFalta } from "@/lib/db/sqlite/perfil";

/**
 * Armazón de las pantallas del repartidor.
 *
 * Ya no comprueba sesión ni rol: dentro del APK no hay con quién compartir la
 * base, así que no hay nadie de quien proteger los datos. Lo que sí decide
 * aquí es si la licencia permite cargar jornadas nuevas (§ licencias).
 */
export default function LayoutApp({ children }: { children: React.ReactNode }) {
  return (
    <ProveedorLicencia>
      <Contenido>{children}</Contenido>
    </ProveedorLicencia>
  );
}

function Contenido({ children }: { children: React.ReactNode }) {
  const licencia = useLicencia();

  /* La primera vez que se abre la app no hay ni tienda ni perfil, y sin tienda
     no hay regla de pago que aplicar. Sembrar aquí evita que la primera
     pantalla salga a medio configurar. */
  const { datos: perfil, error } = useDatos(async () => {
    await sembrarSiHaceFalta();
    return perfilActual();
  }, []);

  /* Si la base no arranca, la aplicación entera queda inservible. Sin esto se
     vería una pantalla en blanco, que es la peor forma de fallar: no dice qué
     pasa ni qué hacer, y parece que la app se colgó. */
  if (error) {
    return (
      <div className="grid min-h-dvh place-items-center px-4">
        <div className="flex max-w-sm flex-col items-center gap-4 text-center">
          <span className="grid size-14 place-items-center rounded-full bg-mal-suave text-mal">
            <Alerta className="size-7" />
          </span>
          <h1 className="text-2xl">No se pudo abrir la base de datos</h1>
          <p className="text-sm text-tinta-2">
            Tus datos siguen ahí; lo que falló fue abrirlos. Cierra la aplicación del todo y
            vuelve a entrar.
          </p>
          <p className="rounded-btn bg-sup-2 px-3 py-2 font-mono text-xs text-tinta-3">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <Armazon nombre={perfil?.nombre ?? ""} email={perfil?.email ?? null} rol="driver">
      {licencia && !licencia.puedeEscribir && (
        <div className="mx-auto mb-4 flex max-w-[880px] gap-3 rounded-btn bg-aviso-suave px-4 py-3 text-sm text-aviso">
          <Alerta className="mt-0.5 size-[18px] shrink-0" />
          <div>
            <strong className="block font-bold">
              {licencia.estado === "sin_licencia" ? "Tu prueba terminó" : "Tu mes venció"}
            </strong>
            <p>{mensajeDeLicencia(licencia)}</p>
            <Link href="/ajustes" className="mt-1 inline-block font-semibold underline">
              Activar mi licencia
            </Link>
          </div>
        </div>
      )}
      {/* Recordatorio suave cuando quedan pocos días: no bloquea nada, solo
          avisa a tiempo para renovar sin quedarse un día sin poder cargar. */}
      {licencia && licencia.puedeEscribir && licencia.debeAvisar && (
        <Link
          href="/ajustes"
          className="mx-auto mb-4 flex max-w-[880px] items-center justify-between gap-3 rounded-btn bg-acento-suave px-4 py-2.5 text-sm text-acento-tinta"
        >
          <span>{mensajeDeLicencia(licencia)}</span>
          <b className="shrink-0">Renovar</b>
        </Link>
      )}
      <BotonAtras />
      <RedDeSeguridad />
      {children}
    </Armazon>
  );
}
