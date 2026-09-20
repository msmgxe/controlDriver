"use client";

import { useDatos } from "./useDatos";

/**
 * Qué versión está corriendo, y desde dónde.
 *
 * Se le pregunta al plugin de Capacitor en vez de leer `version.properties`
 * en el momento de compilar, porque lo que importa no es qué versión se
 * generó sino **qué versión tiene instalada esta persona en su teléfono**, y
 * esas dos cosas pueden no coincidir —justo lo que pasó: alguien vio una
 * versión de hace varios cambios sin darse cuenta, porque nada en la propia
 * app se lo decía—.
 */
export function useVersion() {
  return useDatos(async () => {
    const { Capacitor } = await import("@capacitor/core");
    if (!Capacitor.isNativePlatform()) return { version: "navegador", build: "—" };
    const { App } = await import("@capacitor/app");
    const info = await App.getInfo();
    return { version: info.version, build: String(info.build) };
  }, []).datos;
}
