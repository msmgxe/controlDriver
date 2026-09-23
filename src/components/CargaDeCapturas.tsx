"use client";

import { createContext, useContext, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { Alerta, Check } from "@/components/iconos";
import { MAX_IMAGENES, procesarCapturas } from "@/lib/carga";

/**
 * Cargar capturas desde **cualquier** pantalla.
 *
 * Antes solo se podía desde Inicio, porque el botón, el selector de archivos y
 * el progreso vivían en esa pantalla. Con el botón del auto en la barra de
 * abajo —siempre a un pulgar de distancia— la carga tiene que poder empezar en
 * Pagos, en Historial o donde se esté. Por eso vive aquí, en el armazón: un
 * selector oculto, el progreso y los errores flotando sobre la barra, y un
 * gancho (`useCarga`) para abrirlo.
 *
 * El flujo en sí no cambia: es el mismo `procesarCapturas` de `@/lib/carga`, y
 * al terminar lleva a Revisión.
 */

type Fase = "reposo" | "comprimiendo" | "leyendo" | "error";

interface Carga {
  /** Abre el selector de capturas. Solo desde un toque del usuario. */
  abrir: () => void;
  /** Hay una carga en marcha. */
  trabajando: boolean;
}

const Contexto = createContext<Carga | null>(null);

export function useCarga(): Carga {
  const c = useContext(Contexto);
  if (!c) throw new Error("useCarga va dentro de <ProveedorDeCarga>.");
  return c;
}

export function ProveedorDeCarga({
  children,
  deshabilitado = false,
}: {
  children: React.ReactNode;
  /** Sin licencia no se cargan jornadas nuevas. */
  deshabilitado?: boolean;
}) {
  const router = useRouter();
  const entrada = useRef<HTMLInputElement>(null);
  const [fase, setFase] = useState<Fase>("reposo");
  const [listas, setListas] = useState(0);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [copiado, setCopiado] = useState(false);

  async function alElegir(e: React.ChangeEvent<HTMLInputElement>) {
    const archivos = Array.from(e.target.files ?? []);
    if (archivos.length === 0) return;

    setTotal(archivos.length);
    setListas(0);
    setError(null);
    setCopiado(false);
    setFase("comprimiendo");

    /* Pase lo que pase dentro, esto **sale** del estado "leyendo". Antes, un
       error que se escapaba dejaba el botón girando para siempre: la app no se
       había cerrado, pero estaba trabada, que para quien la usa es lo mismo.
       Ahora cualquier fallo termina en un mensaje con el detalle. */
    try {
      const resultado = await procesarCapturas(
        archivos,
        (n) => {
          setListas(n);
          // Al terminar de preparar se empieza a leer, y la cuenta vuelve a cero.
          if (n === archivos.length) {
            setFase("leyendo");
            setListas(0);
          }
        },
        (n) => setListas(n),
      );

      if (resultado.ok) {
        setFase("reposo");
        router.push("/revision");
      } else {
        setFase("error");
        setError(resultado.error);
      }
    } catch (fallo) {
      setFase("error");
      setError(
        `No se pudieron leer las capturas. Detalle: ${
          fallo instanceof Error ? fallo.message : String(fallo)
        }`,
      );
    } finally {
      if (entrada.current) entrada.current.value = "";
    }
  }

  const trabajando = fase === "comprimiendo" || fase === "leyendo";

  return (
    <Contexto.Provider
      value={{
        abrir: () => {
          if (!deshabilitado && !trabajando) entrada.current?.click();
        },
        trabajando,
      }}
    >
      <input
        ref={entrada}
        id="capturas"
        type="file"
        accept="image/jpeg,image/png,image/webp"
        multiple
        className="sr-only"
        tabIndex={-1}
        onChange={(e) => void alElegir(e)}
      />

      {children}

      {/* Flota sobre la barra de abajo: se ve desde cualquier pantalla. */}
      {(trabajando || (fase === "error" && error)) && (
        <div className="fixed inset-x-3 bottom-[calc(5.75rem+env(safe-area-inset-bottom,0px))] z-50 mx-auto flex max-w-[520px] flex-col gap-2 lg:bottom-6">
          {trabajando && <Progreso fase={fase} listas={listas} total={total} />}

          {/* El mensaje entero, en pantalla y copiable. Una captura de este
              aviso no siempre llega a quien da soporte; el texto copiado, sí. */}
          {fase === "error" && error && (
            <div
              role="alert"
              className="flex gap-3 rounded-btn bg-mal-suave px-4 py-3 text-sm text-mal shadow-alta"
            >
              <Alerta className="mt-0.5 size-[18px] shrink-0" />
              <div className="flex min-w-0 flex-1 flex-col gap-2">
                <strong className="block font-bold">No se pudo cargar</strong>
                <p className="max-h-40 overflow-y-auto break-words select-text">{error}</p>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={async () => {
                      try {
                        await navigator.clipboard.writeText(error);
                        setCopiado(true);
                      } catch {
                        setCopiado(false);
                      }
                    }}
                    className="rounded-chip border border-current px-3 py-1.5 text-xs font-semibold"
                  >
                    {copiado ? "Copiado ✓" : "Copiar el mensaje"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setFase("reposo")}
                    className="rounded-chip border border-current px-3 py-1.5 text-xs font-semibold"
                  >
                    Cerrar
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </Contexto.Provider>
  );
}

/** Máximo de capturas por carga, para el texto de ayuda. */
export const TOPE_DE_CAPTURAS = MAX_IMAGENES;

export function Progreso({
  fase,
  listas,
  total,
}: {
  fase: "comprimiendo" | "leyendo";
  listas: number;
  total: number;
}) {
  return (
    <div className="tarjeta flex flex-col gap-3 shadow-alta" role="status" aria-live="polite">
      <div>
        <h2 className="text-lg">
          {fase === "comprimiendo" ? "Preparando las fotos" : "Leyendo capturas"}
        </h2>
        <p className="text-sm text-tinta-2">
          {fase === "comprimiendo" ? `${listas} de ${total} listas` : `${listas} de ${total} leídas`}
        </p>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-sup-2">
        <span
          className="block h-full rounded-full bg-acento transition-[width] duration-300"
          style={{ width: `${(listas / Math.max(total, 1)) * 100}%` }}
        />
      </div>
      {fase === "comprimiendo" && total <= 8 && (
        <ul className="flex flex-col gap-2">
          {Array.from({ length: total }, (_, i) => (
            <li
              key={i}
              className={`flex items-center gap-2 text-sm ${i < listas ? "text-tinta" : "text-tinta-3"}`}
            >
              {i < listas ? (
                <Check className="size-4 text-bien" />
              ) : (
                <span className="size-4 rounded-full border border-linea-fuerte" />
              )}
              Captura {i + 1}
            </li>
          ))}
        </ul>
      )}
      <p className="text-xs text-tinta-3">
        Las fotos se leen aquí mismo, en tu celular, y se descartan. No salen del teléfono ni hace
        falta internet.
      </p>
    </div>
  );
}
