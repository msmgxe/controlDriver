/**
 * Bloqueo local de la app: PIN de 4 dígitos y, si el equipo lo permite, huella.
 *
 * QUÉ ES Y QUÉ NO ES. Esto **no** es un factor de autenticación: el servidor no
 * lo comprueba y no protege nada frente a alguien que llame a la API por su
 * cuenta. La frontera de seguridad real sigue siendo la sesión de Supabase más
 * las políticas RLS (§7).
 *
 * Lo que sí hace, y es la razón de existir: si el driver presta el celular o lo
 * pierde desbloqueado, sus ingresos y los códigos de sus pedidos no quedan a la
 * vista de cualquiera. Es el mismo bloqueo que ponen las apps de banca encima
 * de una sesión que ya está abierta.
 *
 * Todo vive en el navegador de ese dispositivo. Nada de esto viaja al servidor.
 */

const CLAVE_PIN = "rutalog.bloqueo.pin";
const CLAVE_HUELLA = "rutalog.bloqueo.huella";
const CLAVE_ABIERTO = "rutalog.bloqueo.abierto";

interface PinGuardado {
  sal: string;
  hash: string;
  iteraciones: number;
}

/* ---------------------------------------------------------------------------
 * Almacenamiento, siempre tolerante a fallo
 *
 * En una ventana privada o con los datos del sitio bloqueados, cualquiera de
 * estos accesos lanza. El bloqueo es una comodidad: si no se puede guardar, la
 * app funciona igual, sin bloqueo.
 * ------------------------------------------------------------------------- */

/* Almacén suscribible, para poder leerlo con `useSyncExternalStore`.
   Es la forma correcta de que un componente lea algo que vive fuera de React
   —aquí, el almacenamiento del navegador— sin sincronizarlo a mano con un
   efecto y sin romper la hidratación. */
const oyentes = new Set<() => void>();

export function suscribirBloqueo(alCambiar: () => void): () => void {
  oyentes.add(alCambiar);
  return () => {
    oyentes.delete(alCambiar);
  };
}

function avisar(): void {
  for (const oyente of oyentes) oyente();
}

function leer(clave: string): string | null {
  try {
    return localStorage.getItem(clave);
  } catch {
    return null;
  }
}

function escribir(clave: string, valor: string): void {
  try {
    localStorage.setItem(clave, valor);
  } catch {
    /* sin almacenamiento: el bloqueo simplemente no queda puesto */
  }
}

function borrar(clave: string): void {
  try {
    localStorage.removeItem(clave);
  } catch {
    /* nada que hacer */
  }
}

/* ---------------------------------------------------------------------------
 * PIN
 * ------------------------------------------------------------------------- */

const ITERACIONES = 210_000;

function aHex(datos: ArrayBuffer): string {
  return Array.from(new Uint8Array(datos))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function derivar(pin: string, sal: Uint8Array, iteraciones: number): Promise<string> {
  const material = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(pin),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt: sal as BufferSource, iterations: iteraciones, hash: "SHA-256" },
    material,
    256,
  );
  return aHex(bits);
}

/** ¿Este dispositivo tiene bloqueo puesto? */
export function bloqueoConfigurado(): boolean {
  return leer(CLAVE_PIN) !== null;
}

export async function fijarPin(pin: string): Promise<void> {
  const sal = crypto.getRandomValues(new Uint8Array(16));
  const hash = await derivar(pin, sal, ITERACIONES);
  const guardado: PinGuardado = { sal: aHex(sal.buffer), hash, iteraciones: ITERACIONES };
  escribir(CLAVE_PIN, JSON.stringify(guardado));
  avisar();
}

export async function verificarPin(pin: string): Promise<boolean> {
  const crudo = leer(CLAVE_PIN);
  if (!crudo) return true; // Sin bloqueo puesto, no hay nada que verificar.
  try {
    const guardado = JSON.parse(crudo) as PinGuardado;
    const sal = new Uint8Array(
      (guardado.sal.match(/.{2}/g) ?? []).map((par) => parseInt(par, 16)),
    );
    const hash = await derivar(pin, sal, guardado.iteraciones);
    return hash === guardado.hash;
  } catch {
    return false;
  }
}

export function quitarBloqueo(): void {
  borrar(CLAVE_PIN);
  borrar(CLAVE_HUELLA);
  marcarAbierto();
  avisar();
}

/* ---------------------------------------------------------------------------
 * Huella (WebAuthn con autenticador de la plataforma)
 *
 * Se usa como puerta local: basta con que el dispositivo confirme al dueño. No
 * se verifica ninguna firma en servidor, porque no es un factor de sesión.
 * ------------------------------------------------------------------------- */

export function huellaDisponible(): boolean {
  return typeof window !== "undefined" && Boolean(window.PublicKeyCredential);
}

export function huellaConfigurada(): boolean {
  return leer(CLAVE_HUELLA) !== null;
}

function aBase64Url(datos: ArrayBuffer): string {
  return btoa(String.fromCharCode(...new Uint8Array(datos)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function desdeBase64Url(texto: string): Uint8Array {
  const base = texto.replace(/-/g, "+").replace(/_/g, "/");
  const relleno = base.padEnd(base.length + ((4 - (base.length % 4)) % 4), "=");
  return Uint8Array.from(atob(relleno), (c) => c.charCodeAt(0));
}

export async function activarHuella(nombreUsuario: string): Promise<boolean> {
  if (!huellaDisponible()) return false;
  try {
    const credencial = (await navigator.credentials.create({
      publicKey: {
        challenge: crypto.getRandomValues(new Uint8Array(32)),
        rp: { name: "RutaLog" },
        user: {
          id: crypto.getRandomValues(new Uint8Array(16)),
          name: nombreUsuario,
          displayName: nombreUsuario,
        },
        pubKeyCredParams: [
          { type: "public-key", alg: -7 },
          { type: "public-key", alg: -257 },
        ],
        authenticatorSelection: {
          authenticatorAttachment: "platform",
          userVerification: "required",
        },
        timeout: 60_000,
      },
    })) as PublicKeyCredential | null;

    if (!credencial) return false;
    escribir(CLAVE_HUELLA, aBase64Url(credencial.rawId));
    avisar();
    return true;
  } catch {
    return false;
  }
}

export async function pedirHuella(): Promise<boolean> {
  const id = leer(CLAVE_HUELLA);
  if (!id || !huellaDisponible()) return false;
  try {
    const credencial = await navigator.credentials.get({
      publicKey: {
        challenge: crypto.getRandomValues(new Uint8Array(32)),
        allowCredentials: [{ type: "public-key", id: desdeBase64Url(id) as BufferSource }],
        userVerification: "required",
        timeout: 60_000,
      },
    });
    return credencial !== null;
  } catch {
    return false;
  }
}

/* ---------------------------------------------------------------------------
 * Estado de la sesión de pantalla
 *
 * Vive en sessionStorage: al cerrar la pestaña o relanzar la PWA vuelve a pedir
 * el PIN, que es justo el momento en que interesa pedirlo.
 * ------------------------------------------------------------------------- */

export function estaAbierto(): boolean {
  try {
    return sessionStorage.getItem(CLAVE_ABIERTO) === "1";
  } catch {
    return true; // Sin almacenamiento no se puede recordar: no se bloquea.
  }
}

export function marcarAbierto(): void {
  try {
    sessionStorage.setItem(CLAVE_ABIERTO, "1");
  } catch {
    /* nada que hacer */
  }
  avisar();
}

export function cerrarDeNuevo(): void {
  try {
    sessionStorage.removeItem(CLAVE_ABIERTO);
  } catch {
    /* nada que hacer */
  }
  avisar();
}

/* ---------------------------------------------------------------------------
 * Instantáneas para useSyncExternalStore
 *
 * En servidor no se puede saber nada del dispositivo, así que la instantánea
 * de servidor es "desconocido" y se pinta un hueco. React vuelve a leer al
 * hidratar y ahí ya sale el estado real: ni parpadeo de la app bajo el
 * candado, ni error de hidratación.
 * ------------------------------------------------------------------------- */

export type EstadoBloqueo = "desconocido" | "abierto" | "cerrado";

/** Cadena estable: sin ella, useSyncExternalStore entraría en bucle. */
export function instantaneaBloqueo(): EstadoBloqueo {
  return !bloqueoConfigurado() || estaAbierto() ? "abierto" : "cerrado";
}

export function instantaneaBloqueoServidor(): EstadoBloqueo {
  return "desconocido";
}

/** Para Ajustes: "pin,huella,huella-disponible" como una sola cadena estable. */
export function instantaneaAjustes(): string {
  return [bloqueoConfigurado(), huellaConfigurada(), huellaDisponible()].join(",");
}

export function instantaneaAjustesServidor(): string {
  return "false,false,false";
}
