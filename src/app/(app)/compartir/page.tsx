"use client";

import dynamic from "next/dynamic";

/**
 * Destino de compartir de Android (§8).
 *
 * Galería → seleccionar capturas → Compartir → RutaLog → Revisión. Es el camino
 * más rápido y el principal a optimizar, porque evita entrar a la app y buscar
 * el botón.
 *
 * Solo en cliente: las capturas las dejó el service worker en una caché del
 * navegador, así que no hay nada que renderizar en servidor.
 */
const Contenido = dynamic(() => import("./Contenido").then((m) => m.Contenido), {
  ssr: false,
  loading: () => (
    <p className="py-10 text-center text-sm text-tinta-3">Recogiendo las capturas…</p>
  ),
});

export default function PaginaCompartir() {
  return <Contenido />;
}
