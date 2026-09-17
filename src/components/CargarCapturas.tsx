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

  async function alElegir(e: React.ChangeEvent<HTMLInputElement>) {
    const archivos = Array.from(e.target.files ?? []);
    if (archivos.length === 0) return;

    setTotal(archivos.length);
    setListas(0);
    setError(null);
    setFase("comprimiendo");

    const resultado = await procesarCapturas(archivos, (n) => {
      setListas(n);
      if (n === archivos.length) setFase("leyendo");
    });

    if (entrada.current) entrada.current.value = "";

    if (resultado.ok) {
      router.push("/revision");
    } else {
      setFase("error");
      setError(resultado.error);
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

      {fase === "error" && error && (
        <div className="flex gap-3 rounded-btn bg-mal-suave px-4 py-3 text-sm text-mal">
          <Alerta className="mt-0.5 size-[18px] shrink-0" />
          <div>
            <strong className="block font-bold">No se pudo cargar</strong>
            <p>{error}</p>
          </div>
        </div>
      )}

      <p className="text-xs text-tinta-3">
        También puedes compartir las capturas a RutaLog desde la galería. Máximo {MAX_IMAGENES} por
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
        Las fotos se procesan y se descartan. No se guardan en ningún servidor.
      </p>
    </div>
  );
}
