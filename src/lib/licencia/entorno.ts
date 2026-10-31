/**
 * Una variable de entorno, limpia.
 *
 * Al copiar un valor de `.env.local` a Vercel es muy fácil llevarse las
 * comillas («"Papucho123"») o un salto de línea al final. Con eso la
 * contraseña no coincide y el token de Turso no vale, y el fallo sale lejos
 * de su causa. Aquí se quitan los espacios de los bordes y un par de comillas
 * que envuelvan todo el valor.
 */
export function entorno(nombre: string): string | undefined {
  const crudo = process.env[nombre];
  if (crudo === undefined) return undefined;
  const limpio = crudo.trim().replace(/^(["'])([\s\S]*)\1$/, "$2").trim();
  return limpio === "" ? undefined : limpio;
}
