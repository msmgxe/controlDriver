"use client";

import { useState } from "react";

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
      <div className="flex flex-col gap-2">
        <span className="rotulo">Algo falló</span>
        <h1 className="text-[28px] leading-tight">Esta pantalla no se pudo mostrar</h1>
        <p className="text-sm text-tinta-2">
          Tus jornadas guardadas están bien: lo que falló es esta pantalla, no tus datos.
        </p>
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

      <details className="rounded-btn bg-sup-2 p-3 text-sm">
        <summary className="cursor-pointer font-semibold">Detalle para soporte</summary>
        <pre className="mt-2 max-h-48 overflow-auto font-mono text-xs whitespace-pre-wrap">{detalle}</pre>
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
          className="boton-secundario mt-2"
        >
          {copiado ? "Copiado ✓" : "Copiar el detalle"}
        </button>
      </details>
    </div>
  );
}
