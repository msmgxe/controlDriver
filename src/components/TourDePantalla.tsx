"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { RecorridoGuiado } from "@/components/RecorridoGuiado";
import { TOURS, type PantallaConTours } from "@/lib/tours";

/**
 * Recoge `?tour=<nombre>` de la dirección y monta el recorrido guiado de esa
 * pantalla (ver `src/lib/tours.ts`). Limpia el parámetro al leerlo, para que no
 * se repita solo al volver a la pantalla.
 *
 * Va dentro de un `Suspense`, porque lee la dirección.
 */
export function TourDePantalla({
  pantalla,
  alAbrir,
}: {
  pantalla: PantallaConTours;
  /** Deja a la vista lo que un paso señala (p. ej. despliega un acordeón). */
  alAbrir?: (clave: string) => void;
}) {
  const params = useSearchParams();
  const ruta = usePathname();
  const router = useRouter();
  const [activo, setActivo] = useState<string | null>(null);

  const pedido = params.get("tour");
  /* eslint-disable react-hooks/set-state-in-effect -- se lee un dato externo (la dirección) tras montar. */
  useEffect(() => {
    if (pedido && TOURS[pantalla][pedido]) {
      setActivo(pedido);
      router.replace(ruta, { scroll: false });
    }
  }, [pedido, pantalla, ruta, router]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const pasos = useMemo(
    () =>
      activo
        ? TOURS[pantalla][activo].map((p) => ({
            selector: p.selector,
            titulo: p.titulo,
            texto: p.texto,
            antes: p.abrir ? () => alAbrir?.(p.abrir as string) : undefined,
          }))
        : [],
    // `alAbrir` cambia en cada render de la pantalla; solo importa qué recorrido está activo.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [activo, pantalla],
  );

  if (!activo) return null;
  return <RecorridoGuiado pasos={pasos} alTerminar={() => setActivo(null)} />;
}
