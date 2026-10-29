"use client";

import { useState } from "react";

import { Acordeon } from "@/components/Acordeon";

/**
 * Lo que se ve cuando algo falla, en lugar de una pantalla en blanco.
 *
 * Tres cosas, en este orden de importancia:
 *
 *   1. **Tranquilizar**: los datos guardados están bien. Casi siempre es verdad
 *      —lo que falla es una pantalla, no la base— y es lo primero que se teme.
 *   2. **Una salida**: volver a intentar, o ir al inicio. Nunca un callejón.
 *   3. **El detalle, copiable**: el texto del error, para mandarlo. Una captura
 *      de pantalla no siempre llega; un texto sí.
 */
export function PantallaDeFallo({
  error,
  alReintentar,
}: {
  error: Error & { digest?: string };
  alReintentar: () => void;
}) {
  const [copiado, setCopiado] = useState(false);
  const detalle = [error.name, error.message, error.stack?.split("\n").slice(0, 4).join("\n")]
    .filter(Boolean)
    .join("\n");

  return (
    <div className="mx-auto flex min-h-[60dvh] max-w-md flex-col justify-center gap-5 px-4 py-10">
      <div className="aju-cent rise-v2">
        <svg viewBox="0 0 120 110" width="150" aria-hidden="true">
          <g className="aju-wob">
            <path
              d="M60 8l52 92H8z"
              style={{ fill: "var(--aviso)", stroke: "var(--aviso)" }}
              strokeWidth="8"
              strokeLinejoin="round"
            />
            <path d="M60 40v28M60 80v.01" stroke="#fff" strokeWidth="9" strokeLinecap="round" />
          </g>
        </svg>
        <h1 className="text-[26px] leading-tight">Esta pantalla no se pudo mostrar</h1>
        <p className="text-sm text-tinta-2">No perdiste nada: lo que falló es esta pantalla, no tus datos.</p>
      </div>

      <div className="flex flex-col gap-2">
        <button type="button" onClick={alReintentar} className="boton-principal">
          Volver a intentar
        </button>
        {/* Recarga completa, no navegación interna: tras un fallo, lo que se
            rompió puede seguir en memoria, y empezar de cero lo limpia. */}
        <button
          type="button"
          // Excepción deliberada a la regla: aquí se quiere recargar la página
          // entera, que es lo que limpia el estado roto. `router.push` no lo haría.
          // eslint-disable-next-line @next/next/no-location-assign-relative-destination
          onClick={() => window.location.assign("/")}
          className="boton-secundario w-full"
        >
          Ir al inicio
        </button>
      </div>

      <Acordeon titulo="Detalle para soporte" resumen="Para mandarlo a quien lo arregla">
        <pre className="aju-caja">{detalle}</pre>
        <button
          type="button"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(detalle);
              setCopiado(true);
            } catch {
              setCopiado(false);
            }
          }}
          className="boton-sec"
        >
          {copiado ? "Copiado ✓" : "Copiar el detalle"}
        </button>
      </Acordeon>
    </div>
  );
}
