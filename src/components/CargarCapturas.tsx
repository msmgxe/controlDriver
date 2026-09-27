"use client";

import { Subir } from "@/components/iconos";
import { TOPE_DE_CAPTURAS, useCarga } from "@/components/CargaDeCapturas";
import { nombreDelDia, type FechaISO } from "@/lib/fechas";

// El progreso lo comparte la pantalla de «compartir desde la galería».
export { Progreso } from "@/components/CargaDeCapturas";

/**
 * Carga diaria (§4): el botón grande de Inicio.
 *
 * Las otras puertas de entrada son el auto de la barra de abajo y compartir
 * desde la galería (§8). Las tres hacen lo mismo, y el flujo vive en
 * `@/components/CargaDeCapturas` y en `@/lib/carga`; aquí solo está el botón.
 */
export function CargarCapturas({
  deshabilitado,
  dia,
}: {
  deshabilitado?: boolean;
  /** El día que se está mirando: a él van las capturas que no traen su fecha. */
  dia?: FechaISO;
}) {
  const { abrir, trabajando } = useCarga();

  return (
    <div className="flex flex-col gap-3">
      <button
        type="button"
        className="boton-principal"
        disabled={deshabilitado || trabajando}
        onClick={() => abrir({ fechaPorDefecto: dia })}
      >
        <Subir className="size-[22px]" />
        {trabajando ? "Procesando…" : "Cargar capturas"}
      </button>

      <p className="text-xs text-tinta-3">
        Son las capturas de la app de la tienda, con tus rutas y pedidos. Cada una se guarda en el
        día que dice{dia ? `; las que no lo digan, el ${nombreDelDia(dia)} ${Number(dia.slice(8))}` : ""}.
        También puedes compartirlas a Control Driver desde la galería. Máximo {TOPE_DE_CAPTURAS} por carga.
      </p>
    </div>
  );
}
