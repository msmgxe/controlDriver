"use client";

import Link from "next/link";
import { useState } from "react";

import { FiguraDeAccion } from "@/components/Acciones";
import { Armazon } from "@/components/Armazon";
import { BotonAtras } from "@/components/BotonAtras";
import { RedDeSeguridad } from "@/components/RedDeSeguridad";
import { ProveedorLicencia, useLicencia } from "@/components/Licencia";
import { Alerta, Equis, Llave } from "@/components/iconos";
import { useDatos } from "@/hooks/useDatos";
import { mensajeDeLicencia } from "@/lib/licencia/estado";
import { repararMontosDeMoto } from "@/lib/db/sqlite/jornadas";
import { perfilActual, sembrarSiHaceFalta } from "@/lib/db/sqlite/perfil";

/**
 * Armazón de las pantallas del repartidor.
 *
 * Ya no comprueba sesión ni rol: dentro del APK no hay con quién compartir la
 * base, así que no hay nadie de quien proteger los datos. Lo que sí decide
 * aquí es si la licencia permite cargar jornadas nuevas (§ licencias).
 */
/**
 * Una «x» para cerrar el aviso de licencia y ver la pantalla con sus datos.
 * Se cierra mientras la app esté abierta; al abrirla otra vez vuelve a salir,
 * porque la licencia sigue pendiente.
 */
function CerrarAviso({ alCerrar }: { alCerrar: () => void }) {
  return (
    <button
      type="button"
      onClick={alCerrar}
      aria-label="Cerrar el aviso"
      className="absolute top-2 right-2 grid size-11 place-items-center rounded-full bg-black/10 text-current active:scale-95"
    >
      <Equis className="size-5" />
    </button>
  );
}

export default function LayoutApp({ children }: { children: React.ReactNode }) {
  return (
    <ProveedorLicencia>
      <Contenido>{children}</Contenido>
    </ProveedorLicencia>
  );
}

function Contenido({ children }: { children: React.ReactNode }) {
  const licencia = useLicencia();
  const [avisoCerrado, setAvisoCerrado] = useState(false);

  /* La primera vez que se abre la app no hay ni tienda ni perfil, y sin tienda
     no hay regla de pago que aplicar. Sembrar aquí evita que la primera
     pantalla salga a medio configurar. */
  const { datos: perfil, error, recargar } = useDatos(async () => {
    await sembrarSiHaceFalta();
    // Corrige los días de moto guardados con montos de auto (error de v33 y
    // anteriores). Si algo falla, no debe impedir abrir la aplicación.
    await repararMontosDeMoto().catch(() => 0);
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
            Tus datos siguen ahí; lo que falló fue abrirlos. Casi siempre basta con volver a
            intentarlo.
          </p>
          <button type="button" onClick={recargar} className="boton-principal">
            Volver a intentar
          </button>
          <p className="text-xs text-tinta-3">
            Si sigue fallando, cierra la aplicación del todo y vuelve a entrar.
          </p>
          <p className="rounded-btn bg-sup-2 px-3 py-2 font-mono text-xs text-tinta-3 select-text">
            {error}
          </p>
        </div>
      </div>
    );
  }

  return (
    <Armazon nombre={perfil?.nombre ?? ""} email={perfil?.email ?? null} rol="driver">
      {licencia && !licencia.puedeEscribir && !avisoCerrado && (
        <div className="ini-lic ini-rise relative mx-auto mb-4 max-w-[880px]">
          <CerrarAviso alCerrar={() => setAvisoCerrado(true)} />
          <div className="flex items-center gap-3 pr-11">
            <FiguraDeAccion k="licencia" />
            <div className="min-w-0">
              <strong className="block leading-tight font-bold">
                {licencia.estado === "sin_licencia" ? "Tu prueba terminó" : "Tu mes venció"}
              </strong>
              <p className="text-sm font-semibold">{mensajeDeLicencia(licencia)}</p>
            </div>
          </div>
          <Link
            href="/ajustes"
            className="boton-accion"
            style={{ "--c": "var(--c-licencia)", "--c-texto": "#fff" } as React.CSSProperties}
          >
            <Llave className="size-5" />
            Activar mi licencia
          </Link>
        </div>
      )}
      {/* Recordatorio suave cuando quedan pocos días: no bloquea nada, solo
          avisa a tiempo para renovar sin quedarse un día sin poder cargar. */}
      {licencia && licencia.puedeEscribir && licencia.debeAvisar && !avisoCerrado && (
        <div className="ini-lic ini-lic--suave ini-rise relative mx-auto mb-4 max-w-[880px]">
          <CerrarAviso alCerrar={() => setAvisoCerrado(true)} />
          <div className="flex items-center gap-3 pr-11">
            <FiguraDeAccion k="licencia" />
            <p className="min-w-0 flex-1 text-sm font-semibold">{mensajeDeLicencia(licencia)}</p>
            <Link
              href="/ajustes"
              className="boton-accion !w-auto shrink-0 !px-4 !text-base"
              style={{ "--c": "var(--c-licencia)", "--c-texto": "#fff" } as React.CSSProperties}
            >
              Renovar
            </Link>
          </div>
        </div>
      )}
      <BotonAtras />
      <RedDeSeguridad />
      {children}
    </Armazon>
  );
}
