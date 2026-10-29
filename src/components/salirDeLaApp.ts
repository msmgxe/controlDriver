/**
 * Cierra la aplicación instalada (solo en el APK). La pregunta de seguridad la
 * hace quien llama, con `DialogoConfirmar`; aquí solo se cierra.
 * Devuelve `"no-nativo"` en el navegador, donde no hay nada que cerrar.
 */
export async function cerrarAplicacion(): Promise<"ok" | "no-nativo"> {
  const { Capacitor } = await import("@capacitor/core");
  if (!Capacitor.isNativePlatform()) return "no-nativo";
  const { App } = await import("@capacitor/app");
  await App.exitApp();
  return "ok";
}
