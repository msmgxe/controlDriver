"use client";

import { createContext, useContext, useState, type ReactNode } from "react";

/**
 * Qué opción de «Subir más» está abierta, de a una.
 *
 * Antes cada formulario se abría en el sitio de su botón y los demás seguían
 * ahí: con tres o cuatro filas iguales, una tarjeta abierta no decía de qué
 * botón venía. Ahora, al abrir una, las demás se esconden y la abierta se pinta
 * con el borde del tema (`tarjeta-activa`); arriba queda un «‹ Otras formas»
 * para volver a la lista de un toque.
 *
 * Fuera de este contexto (cualquier otra pantalla que use esos formularios) el
 * hook se comporta como un `useState` de siempre.
 */
interface Estado {
  activa: string | null;
  fijar: (id: string | null) => void;
}

const Contexto = createContext<Estado | null>(null);

export function ProveedorDeOpcion({
  activa,
  fijar,
  children,
}: Estado & { children: ReactNode }) {
  return <Contexto.Provider value={{ activa, fijar }}>{children}</Contexto.Provider>;
}

/** `[abierta, fijarAbierta, oculta]`: oculta es «hay otra abierta y esta no toca enseñarla». */
export function useOpcion(id: string): [boolean, (v: boolean) => void, boolean] {
  const contexto = useContext(Contexto);
  const [local, setLocal] = useState(false);
  if (!contexto) return [local, setLocal, false];
  return [
    contexto.activa === id,
    (v) => contexto.fijar(v ? id : contexto.activa === id ? null : contexto.activa),
    contexto.activa !== null && contexto.activa !== id,
  ];
}
