"use client";

import { useRef, useState } from "react";

import {
  anotarRespaldoCreado,
  crearRespaldo,
  leerRespaldo,
  restaurarRespaldo,
  type ResumenRespaldo,
} from "@/lib/db/sqlite/respaldo";
import { hoyEnLima } from "@/lib/fechas";

/**
 * Respaldar y restaurar los datos del teléfono.
 *
 * Es la red de seguridad real mientras no exista la copia en la nube: si el
 * teléfono se pierde, se rompe, o alguien desinstala la app sin querer, esto
 * es lo único que salva meses de jornadas cargadas.
 *
 * Crear un respaldo genera un archivo y lo entrega al selector de "compartir"
 * de Android —a Google Drive, a uno mismo por WhatsApp, por correo—, porque
 * guardarlo solo dentro del teléfono no protege de nada: es el mismo
 * teléfono el que se puede perder.
 */
export function SeccionRespaldo() {
  return (
    <section className="tarjeta flex flex-col gap-5">
      <div>
        <h3 className="text-lg">Respaldo de tus datos</h3>
        <p className="text-sm text-tinta-2">
          Tus jornadas, rutas, pedidos y liquidaciones. No incluye las fotos de tus capturas ni tu
          licencia —esa está atada a este teléfono.
        </p>
      </div>
      <BloqueCrear />
      <div className="border-t border-linea pt-5">
        <BloqueRestaurar />
      </div>
    </section>
  );
}

function BloqueCrear() {
  const [estado, setEstado] = useState<"reposo" | "generando" | "error">("reposo");
  const [error, setError] = useState<string | null>(null);

  async function crear() {
    setEstado("generando");
    setError(null);
    try {
      const { Capacitor } = await import("@capacitor/core");
      const respaldo = await crearRespaldo();
      const contenido = JSON.stringify(respaldo, null, 2);
      const archivo = `rutas-a-respaldo-${hoyEnLima()}.json`;

      if (!Capacitor.isNativePlatform()) {
        throw new Error("Crear y compartir el respaldo solo funciona en la app instalada.");
      }

      const { Filesystem, Directory, Encoding } = await import("@capacitor/filesystem");
      const { Share } = await import("@capacitor/share");

      await Filesystem.writeFile({
        path: archivo,
        data: contenido,
        directory: Directory.Cache,
        encoding: Encoding.UTF8,
      });
      const { uri } = await Filesystem.getUri({ path: archivo, directory: Directory.Cache });

      await Share.share({ title: "Respaldo de Rutas-A", url: uri });
      await anotarRespaldoCreado();
      setEstado("reposo");
    } catch (fallo) {
      setEstado("error");
      setError(fallo instanceof Error ? fallo.message : "No se pudo crear el respaldo.");
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <span className="text-sm font-semibold">Crear un respaldo</span>
      <button
        type="button"
        onClick={() => void crear()}
        disabled={estado === "generando"}
        className="boton-secundario self-start"
      >
        {estado === "generando" ? "Generando…" : "Crear y compartir"}
      </button>
      <p className="text-xs text-tinta-3">
        Se abre el selector de Android: guárdalo en Google Drive, o mándatelo por WhatsApp o
        correo. Hazlo de vez en cuando, y siempre antes de cambiar de teléfono.
      </p>
      {error && <p className="text-xs text-mal">{error}</p>}
    </div>
  );
}

type EstadoRestaurar =
  | { paso: "reposo" }
  | { paso: "error"; mensaje: string }
  | { paso: "confirmar"; texto: string; resumen: ResumenRespaldo }
  | { paso: "restaurando" }
  | { paso: "listo" };

function BloqueRestaurar() {
  const entrada = useRef<HTMLInputElement>(null);
  const [estado, setEstado] = useState<EstadoRestaurar>({ paso: "reposo" });

  async function alElegir(e: React.ChangeEvent<HTMLInputElement>) {
    const archivo = e.target.files?.[0];
    if (entrada.current) entrada.current.value = "";
    if (!archivo) return;

    const texto = await archivo.text();
    const leido = leerRespaldo(texto);
    if (!leido.ok) {
      setEstado({ paso: "error", mensaje: leido.error });
      return;
    }
    setEstado({ paso: "confirmar", texto, resumen: leido.resumen });
  }

  async function restaurar() {
    if (estado.paso !== "confirmar") return;
    setEstado({ paso: "restaurando" });
    try {
      const leido = leerRespaldo(estado.texto);
      if (!leido.ok) throw new Error(leido.error);
      await restaurarRespaldo(leido.respaldo);
      setEstado({ paso: "listo" });
      // El estado de toda la app —lo que ya se había leído de la base—
      // quedó desactualizado por la restauración: se recarga entera.
      setTimeout(() => window.location.reload(), 1200);
    } catch (fallo) {
      setEstado({
        paso: "error",
        mensaje: fallo instanceof Error ? fallo.message : "No se pudo restaurar el respaldo.",
      });
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <span className="text-sm font-semibold">Restaurar desde un respaldo</span>

      {estado.paso === "reposo" || estado.paso === "error" ? (
        <>
          <input
            ref={entrada}
            type="file"
            accept="application/json,.json"
            onChange={(e) => void alElegir(e)}
            className="text-sm"
          />
          <p className="text-xs text-tinta-3">
            Elige el archivo que creaste antes. Reemplaza todo lo que tengas ahora por lo que trae
            el respaldo.
          </p>
          {estado.paso === "error" && <p className="text-xs text-mal">{estado.mensaje}</p>}
        </>
      ) : estado.paso === "confirmar" ? (
        <div className="flex flex-col gap-3 rounded-btn bg-mal-suave p-3">
          <div className="text-sm text-mal">
            <p className="font-semibold">
              Este respaldo tiene {estado.resumen.jornadas}{" "}
              {estado.resumen.jornadas === 1 ? "jornada" : "jornadas"}
              {estado.resumen.desde && estado.resumen.hasta && (
                <>
                  , del {formatearCorto(estado.resumen.desde)} al{" "}
                  {formatearCorto(estado.resumen.hasta)}
                </>
              )}
              {estado.resumen.nombre && <> · de {estado.resumen.nombre}</>}.
            </p>
            <p className="mt-1">
              Va a <b>reemplazar todo</b> lo que tienes guardado ahora en este teléfono. Si has
              cargado días desde que hiciste este respaldo, se perderán.
            </p>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => void restaurar()}
              className="min-h-11 flex-1 rounded-btn bg-mal px-4 text-sm font-semibold text-white"
            >
              Sí, reemplazar todo
            </button>
            <button
              type="button"
              onClick={() => setEstado({ paso: "reposo" })}
              className="boton-secundario flex-1"
            >
              No
            </button>
          </div>
        </div>
      ) : estado.paso === "restaurando" ? (
        <p className="text-sm text-tinta-2">Restaurando…</p>
      ) : (
        <p className="text-sm text-bien">Listo. La aplicación se va a reiniciar sola.</p>
      )}
    </div>
  );
}

function formatearCorto(fecha: string): string {
  const [, m, d] = fecha.split("-");
  return `${d}/${m}`;
}
