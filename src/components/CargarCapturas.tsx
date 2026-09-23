"use client";

import { Subir } from "@/components/iconos";
import { TOPE_DE_CAPTURAS, useCarga } from "@/components/CargaDeCapturas";

// El progreso lo comparte la pantalla de «compartir desde la galería».
export { Progreso } from "@/components/CargaDeCapturas";

/**
 * Carga diaria (§4): el botón grande de Inicio.
 *
 * Las otras puertas de entrada son el auto de la barra de abajo y compartir
 * desde la galería (§8). Las tres hacen lo mismo, y el flujo vive en
 * `@/components/CargaDeCapturas` y en `@/lib/carga`; aquí solo está el botón.
 */
export function CargarCapturas({ deshabilitado }: { deshabilitado?: boolean }) {
  const { abrir, trabajando } = useCarga();

  return (
    <div className="flex flex-col gap-3">
      <button
        type="button"
        className="boton-principal"
        disabled={deshabilitado || trabajando}
        onClick={abrir}
      >
        <Subir className="size-[22px]" />
        {trabajando ? "Procesando…" : "Cargar capturas"}
      </button>

      <p className="text-xs text-tinta-3">
        También puedes compartir las capturas a Rutas-A desde la galería. Máximo{" "}
        {TOPE_DE_CAPTURAS} por carga.
      </p>
    </div>
  );
}
