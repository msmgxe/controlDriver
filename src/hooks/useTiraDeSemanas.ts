"use client";

import type { DatosDelDia } from "@/components/TiraDeSemanas";
import { useDatos } from "@/hooks/useDatos";
import { descansosPorRango } from "@/lib/db/sqlite/descansos";
import { resumenPorRango } from "@/lib/db/sqlite/jornadas";
import { sumarDias, type FechaISO } from "@/lib/fechas";

/**
 * Lo que necesita la barra de semanas: qué días están cargados, cuáles son de
 * descanso y cuánto se cobró cada uno.
 *
 * Trae **las tres semanas visibles** —la anterior, la de ahora y la siguiente—
 * para que, al arrastrar, las vecinas ya lleguen con sus puntos. Y conserva lo
 * de antes entre semana y semana: si la barra se vaciara a mitad de un
 * arrastre, perdería el gesto.
 */
export function useTiraDeSemanas(semanaInicio: FechaISO, hoy: FechaISO) {
  return useDatos(
    async () => {
      const desde = sumarDias(semanaInicio, -7);
      const hasta = sumarDias(semanaInicio, 13);
      const tope = hasta > hoy ? hoy : hasta;
      const [filas, descansos] = await Promise.all([resumenPorRango(desde, tope), descansosPorRango(desde, tope)]);

      const mapa = new Map<FechaISO, DatosDelDia>();
      for (const f of filas) mapa.set(f.fecha, { cargado: true, descanso: false, centimos: f.montoCentimos });
      for (const d of descansos) if (!mapa.has(d)) mapa.set(d, { cargado: false, descanso: true });
      return mapa;
    },
    [semanaInicio],
    { conservar: true, entreCambios: true },
  );
}
