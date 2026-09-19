/**
 * Emisión de certificados. **Esto vive en el servidor y nunca en el APK.**
 *
 * Aquí está la mitad privada del asunto: la clave con la que se firma. Si esa
 * clave se filtra, cualquiera puede fabricarse licencias de por vida y el
 * negocio se acaba. De ahí que este archivo esté separado del de verificación
 * —que sí va dentro de la app— en vez de ser dos funciones del mismo módulo.
 *
 * La regla, sin matices: la clave privada existe en el servidor y en la copia
 * de seguridad que guardes tú. En ningún otro sitio. No en el repositorio, no
 * en el APK, no en una variable con prefijo NEXT_PUBLIC_.
 */
import { aBase64Url, type Certificado } from "./token";

const ALGORITMO = { name: "ECDSA", namedCurve: "P-256" } as const;
const FIRMA = { name: "ECDSA", hash: "SHA-256" } as const;

/**
 * Crea un par de claves nuevo. Se hace **una sola vez** en la vida del negocio.
 *
 * Cambiarlas después invalida de golpe todos los certificados emitidos, y
 * todos tus usuarios se quedarían fuera a la vez. Guarda la privada como
 * guardarías la llave de tu casa.
 */
export async function crearParDeClaves(): Promise<{
  publica: JsonWebKey;
  privada: JsonWebKey;
}> {
  const par = await crypto.subtle.generateKey(ALGORITMO, true, ["sign", "verify"]);
  return {
    publica: await crypto.subtle.exportKey("jwk", par.publicKey),
    privada: await crypto.subtle.exportKey("jwk", par.privateKey),
  };
}

export async function importarClavePrivada(jwk: JsonWebKey): Promise<CryptoKey> {
  return crypto.subtle.importKey("jwk", jwk, ALGORITMO, false, ["sign"]);
}

/** Firma un certificado. El resultado es el texto que se le manda al usuario. */
export async function emitirCertificado(
  datos: Certificado,
  clavePrivada: CryptoKey,
): Promise<string> {
  const cuerpo = aBase64Url(new TextEncoder().encode(JSON.stringify(datos)));
  const firma = await crypto.subtle.sign(
    FIRMA,
    clavePrivada,
    new TextEncoder().encode(cuerpo) as unknown as BufferSource,
  );
  return `${cuerpo}.${aBase64Url(firma)}`;
}

/**
 * Calcula hasta cuándo queda pagado al añadir meses.
 *
 * Se cuenta desde la fecha de vencimiento actual si todavía no ha pasado, y
 * desde hoy si ya venció. Así, quien renueva antes de tiempo no pierde los días
 * que le quedaban, y quien paga tarde no obtiene los días que estuvo sin pagar.
 *
 * El día 31 merece un cuidado aparte: sumar un mes al 31 de enero daría el 31
 * de febrero, que no existe, y JavaScript lo convertiría en el 3 de marzo
 * regalando dos días. Se ajusta al último día del mes destino.
 */
export function sumarMeses(vigenteHasta: string | null, meses: number, hoy: string): string {
  const partida = vigenteHasta && vigenteHasta >= hoy ? vigenteHasta : hoy;
  const [a, m, d] = partida.split("-").map(Number);

  const mesDestino = m - 1 + meses;
  const anioDestino = a + Math.floor(mesDestino / 12);
  const mesNormalizado = ((mesDestino % 12) + 12) % 12;

  const ultimoDia = new Date(Date.UTC(anioDestino, mesNormalizado + 1, 0)).getUTCDate();
  const dia = Math.min(d, ultimoDia);

  return [
    String(anioDestino),
    String(mesNormalizado + 1).padStart(2, "0"),
    String(dia).padStart(2, "0"),
  ].join("-");
}
