"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { Progreso } from "@/components/CargarCapturas";
import { Aviso } from "@/components/ui";
import { procesarCapturas, recogerCompartidas } from "@/lib/carga";

type Estado =
  | { fase: "recogiendo" }
  | { fase: "comprimiendo" | "leyendo"; listas: number; total: number }
  | { fase: "vacio" }
  | { fase: "error"; mensaje: string };

/**
 * Recoge las capturas que dejó el service worker y las mete en el mismo flujo
 * que el botón de Hoy. Si todo va bien, el driver nunca ve esta pantalla más de
 * un segundo: acaba en Revisión.
 */
export function Contenido() {
  const router = useRouter();
  const [estado, setEstado] = useState<Estado>({ fase: "recogiendo" });
  // En React 18+ los efectos se ejecutan dos veces en desarrollo; sin esto la
  // carga se dispararía por duplicado y gastaría el doble de API.
  const yaArrancado = useRef(false);

  useEffect(() => {
    if (yaArrancado.current) return;
    yaArrancado.current = true;

    void (async () => {
      const archivos = await recogerCompartidas();
      if (archivos.length === 0) {
        setEstado({ fase: "vacio" });
        return;
      }

      setEstado({ fase: "comprimiendo", listas: 0, total: archivos.length });

      const resultado = await procesarCapturas(archivos, (n) => {
        setEstado({
          fase: n === archivos.length ? "leyendo" : "comprimiendo",
          listas: n,
          total: archivos.length,
        });
      });

      if (resultado.ok) router.replace("/revision");
      else setEstado({ fase: "error", mensaje: resultado.error });
    })();
  }, [router]);

  return (
    <div className="mx-auto flex max-w-[880px] flex-col gap-4">
      <h2 className="text-[30px] leading-tight">Capturas compartidas</h2>

      {estado.fase === "recogiendo" && (
        <p className="text-sm text-tinta-2">Recogiendo las capturas que compartiste…</p>
      )}

      {(estado.fase === "comprimiendo" || estado.fase === "leyendo") && (
        <Progreso fase={estado.fase} listas={estado.listas} total={estado.total} />
      )}

      {estado.fase === "vacio" && (
        <>
          <Aviso tono="atento" titulo="No llegó ninguna captura">
            <p>
              Abre la galería, selecciona las capturas del día, toca Compartir y elige RutaLog. Si
              acabas de instalar la app, puede que Android tarde un momento en ofrecerla.
            </p>
          </Aviso>
          <button type="button" className="boton-sec self-start" onClick={() => router.push("/")}>
            Ir a Hoy
          </button>
        </>
      )}

      {estado.fase === "error" && (
        <>
          <Aviso tono="mal" titulo="No se pudo procesar">
            <p>{estado.mensaje}</p>
          </Aviso>
          <button type="button" className="boton-sec self-start" onClick={() => router.push("/")}>
            Ir a Hoy
          </button>
        </>
      )}
    </div>
  );
}
