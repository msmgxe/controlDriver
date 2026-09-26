/**
 * Dónde vive la licencia en el teléfono.
 *
 * Tres cosas se guardan aquí, y las tres en la base de datos y no en el
 * almacenamiento del navegador:
 *
 *   · **el identificador de este teléfono** — si se perdiera, la licencia
 *     dejaría de reconocer el aparato y el usuario se quedaría fuera;
 *   · **el certificado** — perderlo sería una llamada de soporte;
 *   · **la fecha más alta vista** — perderla regalaría el truco del reloj.
 *
 * "Borrar datos de navegación" se lleva localStorage por delante; la base de
 * la aplicación no la toca.
 */
import { consultar, ejecutar, nuevoId } from "@/lib/db/sqlite/conexion";

const CLAVE_DISPOSITIVO = "licencia.dispositivo";
const CLAVE_CERTIFICADO = "licencia.certificado";
const CLAVE_FECHA_MAXIMA = "licencia.fecha_maxima";
const CLAVE_PRUEBA = "licencia.prueba_desde";

async function leer(clave: string): Promise<string | null> {
  const filas = await consultar<{ valor: string }>(
    `select valor from ajustes where clave = ?`,
    [clave],
  );
  return filas[0]?.valor ?? null;
}

async function escribir(clave: string, valor: string): Promise<void> {
  await ejecutar(
    `insert into ajustes (clave, valor) values (?, ?)
     on conflict (clave) do update set valor = excluded.valor`,
    [clave, valor],
  );
}

/**
 * El identificador de este teléfono. Se crea la primera vez y no cambia jamás.
 *
 * No se usa nada del aparato —ni IMEI ni número de serie— a propósito: son
 * datos personales, Android los restringe cada vez más, y un número aleatorio
 * cumple exactamente la misma función. Lo único que hace falta es que sea
 * distinto en cada teléfono y estable en el tiempo.
 */
export async function identificadorDelDispositivo(): Promise<string> {
  const guardado = await leer(CLAVE_DISPOSITIVO);
  if (guardado) return guardado;

  const nuevo = nuevoId();
  await escribir(CLAVE_DISPOSITIVO, nuevo);
  return nuevo;
}

export async function certificadoGuardado(): Promise<string | null> {
  return leer(CLAVE_CERTIFICADO);
}

async function guardarCertificado(texto: string): Promise<void> {
  await escribir(CLAVE_CERTIFICADO, texto);
}

/**
 * La fecha más alta que ha visto la aplicación.
 *
 * Solo sube, nunca baja: es lo que hace inútil atrasar el reloj del celular.
 */
export async function fechaMasAltaVista(): Promise<string | null> {
  return leer(CLAVE_FECHA_MAXIMA);
}

export async function anotarFecha(fecha: string): Promise<void> {
  const previa = await fechaMasAltaVista();
  if (!previa || fecha > previa) await escribir(CLAVE_FECHA_MAXIMA, fecha);
}

/**
 * Desde cuándo corre la prueba de dos semanas. Se fija la primera vez que se
 * pide y ya no cambia: ni al actualizar la app ni al atrasar el reloj.
 */
export async function inicioDePrueba(hoy: string): Promise<string> {
  const guardado = await leer(CLAVE_PRUEBA);
  if (guardado) return guardado;
  await escribir(CLAVE_PRUEBA, hoy);
  return hoy;
}

/**
 * Activa un certificado pegado por el usuario, **si es bueno y es suyo**.
 *
 * Se comprueba todo antes de guardar nada: la firma, que sea de este teléfono
 * y que no esté vencido del todo. Guardar uno malo —pegado a medias, o el de
 * un compañero— dejaría la app peor que antes de intentarlo.
 */
export async function activarCertificado(
  texto: string,
): Promise<{ ok: true; hasta: string; nombre: string } | { ok: false; error: string }> {
  const { CLAVE_PUBLICA } = await import("./clave-publica");
  const { importarClavePublica, verificarCertificado } = await import("./token");
  if (!CLAVE_PUBLICA) return { ok: false, error: "Esta versión de la app no admite licencias." };

  // WhatsApp a veces parte el texto en líneas o le añade espacios.
  const limpio = texto.replace(/\s+/g, "").trim();
  const certificado = await verificarCertificado(limpio, await importarClavePublica(CLAVE_PUBLICA));
  if (!certificado) {
    return {
      ok: false,
      error: "Ese texto no es una licencia válida. Cópiala entera del mensaje, sin cortar nada.",
    };
  }
  const aqui = await identificadorDelDispositivo();
  if (certificado.dispositivo && certificado.dispositivo !== aqui) {
    return {
      ok: false,
      error: "Esa licencia es de otro teléfono. Pide la tuya mandando el código de este.",
    };
  }
  await guardarCertificado(limpio);
  return { ok: true, hasta: certificado.vigenteHasta, nombre: certificado.nombre };
}
