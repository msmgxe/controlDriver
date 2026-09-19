/**
 * Certificados de licencia: qué son y por qué están firmados.
 *
 * Un certificado es un papelito que dice "este usuario tiene pagado hasta el
 * 31 de octubre". El problema evidente: si fuera un texto normal, cualquiera
 * editaría la fecha. Por eso va **firmado criptográficamente**.
 *
 * Cómo funciona, en corto:
 *
 *   · El servidor tiene una **clave privada** y firma con ella. Esa clave no
 *     sale nunca del servidor.
 *   · La app lleva la **clave pública** incrustada. Sirve para comprobar
 *     firmas, no para crearlas.
 *   · Si alguien cambia un solo carácter del certificado, la firma deja de
 *     cuadrar y la app lo rechaza.
 *
 * Lo importante de este diseño: **la comprobación no necesita internet**. La
 * app verifica el certificado que ya tiene guardado, en el sótano de un
 * edificio y sin señal. Solo hace falta conexión para *renovarlo*.
 *
 * Una honestidad que conviene dejar escrita: esto no es inviolable. El APK
 * está en el teléfono del usuario y alguien con conocimientos puede modificarlo
 * para saltarse la comprobación. Lo que consigue una licencia firmada es que
 * hacerlo sea bastante más trabajoso que pagar la cuota. Para el tamaño de este
 * negocio, eso es exactamente lo que hace falta.
 */

/** Lo que dice un certificado. */
export interface Certificado {
  /** Id del usuario en el servidor. Ata el certificado a una persona. */
  usuario: string;
  nombre: string;
  /** Último día pagado, inclusive. `YYYY-MM-DD`. */
  vigenteHasta: string;
  /**
   * A qué teléfono pertenece.
   *
   * Sin esto el modelo de negocio no se sostiene: veinte compañeros de la
   * misma tienda se ven a diario, y bastaría con que uno pagara y pasara su
   * certificado a los demás. Atado al aparato, un certificado copiado no
   * sirve en otro teléfono.
   *
   * Vacío significa "sirve en cualquiera". Solo se usa para certificados de
   * prueba y para el periodo de demostración.
   */
  dispositivo: string;
  /** Cuándo se emitió. Sirve para detectar relojes manipulados. */
  emitidoEn: string;
  /** Días que la app sigue funcionando tras vencer, por si estuvo sin señal. */
  diasDeGracia: number;
}

/**
 * Se firma con ECDSA sobre la curva P-256.
 *
 * Se eligió esta y no Ed25519 —que es más moderna y más corta— por una razón
 * práctica: P-256 lleva más de una década en todos los navegadores, y el
 * navegador que va dentro del APK depende de la versión de Android del usuario.
 * Una firma más elegante que falle en un teléfono de hace tres años no sirve
 * de nada.
 */
const ALGORITMO = { name: "ECDSA", namedCurve: "P-256" } as const;
const FIRMA = { name: "ECDSA", hash: "SHA-256" } as const;

/* --- Codificación ---------------------------------------------------------
 * Un certificado viaja como  <datos>.<firma>,  ambos en base64url. Se usa
 * base64url y no base64 normal para que se pueda pegar en una URL o en un
 * mensaje de WhatsApp sin que nada lo destroce. */

export function aBase64Url(datos: ArrayBuffer | Uint8Array): string {
  const bytes = datos instanceof Uint8Array ? datos : new Uint8Array(datos);
  let binario = "";
  for (const b of bytes) binario += String.fromCharCode(b);
  return btoa(binario).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function deBase64Url(texto: string): Uint8Array {
  const normalizado = texto.replace(/-/g, "+").replace(/_/g, "/");
  const relleno = normalizado + "=".repeat((4 - (normalizado.length % 4)) % 4);
  const binario = atob(relleno);
  return Uint8Array.from(binario, (c) => c.charCodeAt(0));
}

/** La clave pública se distribuye como JWK, que es texto y entra en una variable de entorno. */
export async function importarClavePublica(jwk: JsonWebKey): Promise<CryptoKey> {
  return crypto.subtle.importKey("jwk", jwk, ALGORITMO, false, ["verify"]);
}

/**
 * Comprueba un certificado y devuelve lo que dice, o null si no es de fiar.
 *
 * Devuelve null —y no lanza— a propósito: para quien llama, un certificado
 * falsificado y uno corrupto son la misma situación, y no hay nada que
 * distinguir ni que explicarle al usuario.
 */
export async function verificarCertificado(
  texto: string,
  clavePublica: CryptoKey,
): Promise<Certificado | null> {
  try {
    const [datos, firma] = texto.split(".");
    if (!datos || !firma) return null;

    const valida = await crypto.subtle.verify(
      FIRMA,
      clavePublica,
      deBase64Url(firma) as unknown as BufferSource,
      new TextEncoder().encode(datos) as unknown as BufferSource,
    );
    if (!valida) return null;

    const contenido = JSON.parse(new TextDecoder().decode(deBase64Url(datos)));

    // Un certificado sin estos campos no es utilizable aunque la firma cuadre.
    if (
      typeof contenido?.usuario !== "string" ||
      typeof contenido?.vigenteHasta !== "string" ||
      !/^\d{4}-\d{2}-\d{2}$/.test(contenido.vigenteHasta)
    ) {
      return null;
    }

    return {
      usuario: contenido.usuario,
      nombre: typeof contenido.nombre === "string" ? contenido.nombre : "",
      dispositivo: typeof contenido.dispositivo === "string" ? contenido.dispositivo : "",
      vigenteHasta: contenido.vigenteHasta,
      emitidoEn: typeof contenido.emitidoEn === "string" ? contenido.emitidoEn : "",
      diasDeGracia:
        typeof contenido.diasDeGracia === "number" && contenido.diasDeGracia >= 0
          ? contenido.diasDeGracia
          : 7,
    };
  } catch {
    return null;
  }
}
