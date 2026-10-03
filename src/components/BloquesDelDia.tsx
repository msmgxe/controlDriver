import { TarjetaBloqueExtra } from "@/components/TarjetaBloqueExtra";
import type { FechaISO } from "@/lib/fechas";
import type { BloqueExtraFila } from "@/lib/db/tipos";

/**
 * Apoyo y taxi del día, como tarjetas en orden cronológico (§ plan de
 * apoyo/taxi). Nada que mostrar si el día no tiene ninguno —no hace falta un
 * "sin bloques" vacío, la ausencia ya se nota por el hueco que no hay.
 */
export function BloquesDelDia({
  fecha,
  bloques,
  editable,
  alCambiar,
}: {
  fecha: FechaISO;
  bloques: BloqueExtraFila[];
  editable: boolean;
  alCambiar: () => void;
}) {
  if (bloques.length === 0) return null;

  return (
    <div className="flex flex-col gap-2">
      {bloques.map((b) => (
        <TarjetaBloqueExtra key={b.id} bloque={b} fecha={fecha} editable={editable} alCambiar={alCambiar} />
      ))}
    </div>
  );
}
