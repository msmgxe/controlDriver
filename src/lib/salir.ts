/**
 * Cerrar la app del todo, desde donde sea que lo pidan.
 *
 * Solo tiene sentido en el APK: en el navegador no hay proceso que cerrar, así
 * que se avisa de eso en vez de hacer nada. `confirm()` es el mismo patrón que
 * ya usa el resto de la app para preguntas de sí/no antes de un cambio que no
 * se puede deshacer.
 */
export type ResultadoSalir = { ok: true } | { ok: false; motivo: "no-nativo" | "cancelado" };

export async function intentarSalir(pregunta: string): Promise<ResultadoSalir> {
  const { Capacitor } = await import("@capacitor/core");
  if (!Capacitor.isNativePlatform()) return { ok: false, motivo: "no-nativo" };
  if (!confirm(pregunta)) return { ok: false, motivo: "cancelado" };
  const { App } = await import("@capacitor/app");
  await App.exitApp();
  return { ok: true }; // En la práctica no se llega aquí: exitApp() termina el proceso.
}
