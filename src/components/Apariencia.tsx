"use client";

import { useEffect, useState } from "react";

import {
  aplicarModo,
  elegirPreferencia,
  leerPreferencia,
  modoDe,
  type Preferencia,
} from "@/lib/apariencia";

/**
 * Mantiene la cara de la app al día con el teléfono.
 *
 * Si la preferencia es «automático» y el teléfono pasa de claro a oscuro —al
 * anochecer, o por un ajuste programado— la app lo sigue sin reiniciarse. Con
 * una preferencia fija no hace nada: lo elegido manda.
 */
export function VigilanteDeApariencia() {
  useEffect(() => {
    const consulta = window.matchMedia("(prefers-color-scheme: dark)");
    const alCambiar = () => {
      const preferencia = leerPreferencia();
      if (preferencia === "auto") aplicarModo(modoDe(preferencia, consulta.matches));
    };
    consulta.addEventListener("change", alCambiar);
    return () => consulta.removeEventListener("change", alCambiar);
  }, []);

  return null;
}

/** La preferencia actual y cómo cambiarla, para la pantalla de Ajustes. */
export function useApariencia() {
  // Empieza en `auto` y se corrige al montar: leer `localStorage` durante el
  // primer pintado haría que el servidor y el cliente no coincidieran.
  const [preferencia, setPreferencia] = useState<Preferencia>("auto");

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- se lee un dato externo tras montar
    setPreferencia(leerPreferencia());
  }, []);

  function cambiar(nueva: Preferencia) {
    elegirPreferencia(nueva);
    setPreferencia(nueva);
  }

  return { preferencia, cambiar };
}
