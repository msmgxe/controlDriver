"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { Alerta, Check, Subir } from "@/components/iconos";
import { MAX_IMAGENES, procesarCapturas } from "@/lib/carga";

/**
 * Carga diaria (§4).
 *
 * La otra puerta de entrada es compartir desde la galería (§8); las dos usan
 * el mismo flujo, que vive en `@/lib/carga`.
 */
export function CargarCapturas({ deshabilitado }: { deshabilitado?: boolean }) {
  const router = useRouter();
  const entrada = useRef<HTMLInputElement>(null);
  const [fase, setFase] = useState<"reposo" | "comprimiendo" | "leyendo" | "error">("reposo");
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

    /* Pase lo que pase dentro, esta pantalla **sale** del estado "leyendo".
       Antes, un error que se escapaba dejaba el botón girando para siempre: la
       app no se había cerrado, pero estaba trabada, que para quien la usa es lo
       mismo. Ahora cualquier fallo termina en un mensaje con el detalle. */
    try {
      const resultado = await procesarCapturas(archivos, (n) => {
        setListas(n);
        if (n === archivos.length) setFase("leyendo");
      });

      if (resultado.ok) {
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
    <div className="flex flex-col gap-3">
      <input
        ref={entrada}
        id="capturas"
        type="file"
        accept="image/jpeg,image/png,image/webp"
        multiple
        className="sr-only"
        onChange={(e) => void alElegir(e)}
      />

      <button
        type="button"
        className="boton-principal"
        disabled={deshabilitado || trabajando}
        onClick={() => entrada.current?.click()}
      >
        <Subir className="size-[22px]" />
        {trabajando ? "Procesando…" : "Cargar capturas"}
      </button>

      {trabajando && <Progreso fase={fase} listas={listas} total={total} />}

      {/* El mensaje entero, en pantalla y copiable. Una captura de este aviso
          no siempre llega a quien da soporte; el texto copiado, sí. */}
      {fase === "error" && error && (
        <div role="alert" className="flex gap-3 rounded-btn bg-mal-suave px-4 py-3 text-sm text-mal">
          <Alerta className="mt-0.5 size-[18px] shrink-0" />
          <div className="flex min-w-0 flex-1 flex-col gap-2">
            <strong className="block font-bold">No se pudo cargar</strong>
            <p className="break-words select-text">{error}</p>
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
              className="self-start rounded-chip border border-current px-3 py-1.5 text-xs font-semibold"
            >
              {copiado ? "Copiado ✓" : "Copiar el mensaje"}
            </button>
          </div>
        </div>
      )}

      <p className="text-xs text-tinta-3">
        También puedes compartir las capturas a Rutas-A desde la galería. Máximo {MAX_IMAGENES} por
        carga.
      </p>
    </div>
  );
}

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
    <div className="tarjeta flex flex-col gap-3" role="status" aria-live="polite">
      <div>
        <h2 className="text-lg">
          {fase === "comprimiendo" ? "Preparando las fotos" : "Leyendo capturas"}
        </h2>
        <p className="text-sm text-tinta-2">
          {fase === "comprimiendo"
            ? `${listas} de ${total} listas`
            : `${total} capturas en camino. Tarda unos segundos.`}
        </p>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-sup-2">
        <span
          className="block h-full rounded-full bg-acento transition-[width] duration-300"
          style={{ width: fase === "leyendo" ? "100%" : `${(listas / Math.max(total, 1)) * 100}%` }}
        />
      </div>
      {fase === "comprimiendo" && (
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
        Las fotos se leen aquí mismo, en tu celular, y se descartan. No salen del teléfono ni hace falta internet.
      </p>
    </div>
  );
}
