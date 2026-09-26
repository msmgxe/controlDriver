"use client";

import { useState } from "react";

import { Check, Ojo } from "@/components/iconos";
import {
  compartirArchivo,
  guardarArchivo,
  verArchivo,
  type ArchivoListo,
} from "@/lib/exportar/entregar";

/**
 * «Tu archivo está listo»: dónde está y qué se puede hacer con él.
 *
 * Es lo que faltaba tras exportar. El archivo se generaba y no se veía por
 * ningún lado; ahora se dice cómo se llama y se ofrecen tres cosas, cada una
 * con lo que hace: **Ver** lo abre en el teléfono, **Guardar** lo deja en la
 * carpeta Descargas y **Compartir** abre el selector de Android.
 */
export function ArchivoGenerado({
  archivo,
  alCerrar,
}: {
  archivo: ArchivoListo;
  alCerrar: () => void;
}) {
  const [aviso, setAviso] = useState<{ ok: boolean; texto: string } | null>(null);
  const [ocupado, setOcupado] = useState(false);

  async function hacer(accion: () => Promise<string | void>) {
    setOcupado(true);
    setAviso(null);
    try {
      const texto = await accion();
      if (texto) setAviso({ ok: true, texto });
    } catch (e) {
      setAviso({ ok: false, texto: e instanceof Error ? e.message : "No se pudo completar." });
    } finally {
      setOcupado(false);
    }
  }

  return (
    <section
      role="status"
      aria-label="Archivo generado"
      className="flex flex-col gap-3 rounded-card border-2 border-acento bg-acento-suave p-3.5"
    >
      <div className="flex items-start gap-2.5">
        <span className="mt-0.5 grid size-6 shrink-0 place-items-center rounded-full bg-acento text-acento-texto">
          <Check className="size-4" />
        </span>
        <div className="flex min-w-0 flex-1 flex-col">
          <b className="text-sm font-bold text-acento-tinta">Tu archivo está listo</b>
          <span className="font-mono text-xs break-all text-tinta-2">{archivo.nombre}</span>
        </div>
        <button type="button" onClick={alCerrar} className="px-1 text-xs font-semibold text-tinta-2 underline">
          Cerrar
        </button>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <button
          type="button"
          className="boton-sec flex-col !gap-1 !px-1 text-[13px]"
          disabled={ocupado}
          onClick={() => void hacer(() => verArchivo(archivo))}
        >
          <Ojo className="size-4" />
          Ver
        </button>
        <button
          type="button"
          className="boton-sec flex-col !gap-1 !px-1 text-[13px]"
          disabled={ocupado}
          onClick={() => void hacer(async () => `Guardado en ${await guardarArchivo(archivo)}. Búscalo en el gestor de archivos.`)}
        >
          Guardar
          <span className="text-[10px] font-medium text-tinta-3">en Descargas</span>
        </button>
        <button
          type="button"
          className="boton-sec flex-col !gap-1 !px-1 text-[13px]"
          disabled={ocupado}
          onClick={() => void hacer(() => compartirArchivo(archivo))}
        >
          Compartir
          <span className="text-[10px] font-medium text-tinta-3">WhatsApp, correo…</span>
        </button>
      </div>

      {aviso && (
        <p className={`text-sm font-semibold ${aviso.ok ? "text-bien" : "text-mal"}`}>{aviso.texto}</p>
      )}
    </section>
  );
}
