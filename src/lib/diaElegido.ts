"use client";

import { useSyncExternalStore } from "react";

import type { FechaISO } from "@/lib/fechas";

/**
 * El día que se está mirando en Inicio.
 *
 * Lo elige Inicio, pero lo necesita el botón «Cargar» de la barra de abajo, que
 * vive fuera de las pantallas: para proponer, al cargar, **el día que se tiene
 * delante** en vez de siempre hoy. Fuera de Inicio no hay ninguno.
 */
let dia: FechaISO | null = null;
const oyentes = new Set<() => void>();

/** Inicio lo publica al cambiar de día, y lo retira (`null`) al salir. */
export function publicarDiaElegido(nuevo: FechaISO | null): void {
  if (nuevo === dia) return;
  dia = nuevo;
  for (const oyente of [...oyentes]) oyente();
}

function suscribir(oyente: () => void): () => void {
  oyentes.add(oyente);
  return () => {
    oyentes.delete(oyente);
  };
}

export function useDiaElegido(): FechaISO | null {
  return useSyncExternalStore(suscribir, () => dia, () => null);
}
