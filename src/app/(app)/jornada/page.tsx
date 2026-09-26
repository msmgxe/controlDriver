"use client";

import { Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { esFechaISO } from "@/lib/fechas";

/**
 * El detalle de un día ya no es una pantalla aparte: vive en Inicio, en el
 * acordeón «Detalle de lo subido».
 *
 * Esta ruta se conserva solo para no romper enlaces viejos —los que apuntaban a
 * `/jornada?fecha=…`—: lleva a Inicio, abierto en ese mismo día.
 */
export default function PaginaJornada() {
  return (
    <Suspense fallback={null}>
      <Redirigir />
    </Suspense>
  );
}

function Redirigir() {
  const router = useRouter();
  const fecha = useSearchParams().get("fecha");

  useEffect(() => {
    router.replace(esFechaISO(fecha) ? `/?dia=${fecha}` : "/");
  }, [router, fecha]);

  return null;
}
