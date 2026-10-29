/**
 * Firmar licencias desde el panel web —a diferencia de `emitir.ts`, este
 * archivo sí lleva `"server-only"` a propósito: usa `process.env`, algo que
 * solo tiene sentido dentro de Next.js, nunca en el CLI por `jiti`.
 *
 * La decisión consciente que esto representa: la clave privada deja de
 * existir *solo* en la Mac de quien administra (`~/.rutas-a`) y pasa a vivir
 * también como variable de entorno del servidor, `LICENCIA_CLAVE_PRIVADA`.
 * Los riesgos y cómo se mitigan están en `Archivos MD/PANEL-LICENCIAS.md`:
 * la clave se lee SOLO aquí, en el instante de firmar (nunca se guarda en una
 * variable del módulo ni se escribe en un log), toda acción exige sesión, hay
 * un tope de firmas por hora y cada una queda en la tabla `auditoria`.
 *
 * Las dos copias de la clave firman certificados idénticos, porque las dos
 * usan exactamente `emitirCertificado` de `emitir.ts`.
 */
import "server-only";

import { hoyEnLima } from "../fechas";
import { emitirCertificado, importarClavePrivada, sumarMeses } from "./emitir";
import { mensajeParaWhatsApp } from "./panel";
import { auditar } from "./acceso";
import { buscarLicencia, contarAuditoria, obtenerLicencia, registrarEmision } from "./repositorio";
import { LIMITE_EMISIONES_POR_HORA } from "./seguridad";
import { esquemaCodigo, esquemaEmision, primerError } from "./validar";

const DIAS_DE_GRACIA = 7;

export type ResultadoEmision =
  | { ok: true; certificado: string; mensaje: string; hasta: string; codigo: string }
  | { ok: false; error: string };

export const CAMPOS_EMISION = ["codigo", "nombre", "meses", "monto", "metodo", "telefono", "notas"];

/** Firma con la clave del servidor. La clave se lee y se descarta aquí mismo. */
async function firmar(datos: { codigo: string; nombre: string; hasta: string }): Promise<string> {
  const texto = process.env.LICENCIA_CLAVE_PRIVADA;
  if (!texto) throw new Error("FALTA_CLAVE");
  let jwk: JsonWebKey;
  try {
    jwk = JSON.parse(texto);
  } catch {
    throw new Error("CLAVE_ILEGIBLE");
  }
  const clave = await importarClavePrivada(jwk);
  return emitirCertificado(
    {
      usuario: datos.codigo,
      nombre: datos.nombre,
      dispositivo: datos.codigo,
      vigenteHasta: datos.hasta,
      emitidoEn: new Date().toISOString(),
      diasDeGracia: DIAS_DE_GRACIA,
    },
    clave,
  );
}

function errorDeFirma(e: unknown): string {
  const m = e instanceof Error ? e.message : "";
  if (m === "FALTA_CLAVE") return "Falta LICENCIA_CLAVE_PRIVADA en el servidor: todavía no se puede firmar desde aquí.";
  if (m === "CLAVE_ILEGIBLE") return "LICENCIA_CLAVE_PRIVADA no es un JSON válido. Revisa cómo la pegaste en Vercel.";
  // Nunca se devuelve el mensaje crudo: podría arrastrar fragmentos de la clave.
  return "No se pudo firmar. Revisa la clave del servidor.";
}

const ACCIONES_DE_FIRMA = ["emitir", "renovar", "reenviar"];

async function topeAlcanzado(): Promise<boolean> {
  const haceUnaHora = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  return (await contarAuditoria(ACCIONES_DE_FIRMA, haceUnaHora)) >= LIMITE_EMISIONES_POR_HORA;
}

/**
 * Emite una licencia nueva o renueva una existente: valida, firma, registra
 * el pago y deja constancia en la auditoría. **Quien llama ya comprobó la
 * sesión** (`exigirSesion`).
 */
export async function emitirDesdeElPanel(
  entrada: Record<string, string>,
  ip: string,
  accion: "emitir" | "renovar",
): Promise<ResultadoEmision> {
  const v = esquemaEmision.safeParse(entrada);
  if (!v.success) return { ok: false, error: primerError(v.error) };
  const d = v.data;

  if (await topeAlcanzado()) {
    return { ok: false, error: `Tope de seguridad: más de ${LIMITE_EMISIONES_POR_HORA} firmas en la última hora. Espera un rato.` };
  }

  const hoy = hoyEnLima();
  const previa = await buscarLicencia(d.codigo);
  const hasta = sumarMeses(previa?.vigenteHasta ?? null, d.meses, hoy);

  let certificado: string;
  try {
    certificado = await firmar({ codigo: d.codigo, nombre: d.nombre, hasta });
  } catch (e) {
    return { ok: false, error: errorDeFirma(e) };
  }

  await registrarEmision({
    codigo: d.codigo,
    nombre: d.nombre,
    vigenteHasta: hasta,
    diasDeGracia: DIAS_DE_GRACIA,
    fechaDePago: hoy,
    duracion: String(d.meses),
    montoCentimos: d.monto,
    metodo: d.metodo,
    telefono: d.telefono,
    notas: d.notas,
  });
  await auditar(accion, d.codigo, ip);

  return { ok: true, certificado, mensaje: mensajeParaWhatsApp(certificado), hasta, codigo: d.codigo };
}

/**
 * Vuelve a firmar la licencia que el usuario ya tiene (misma fecha), sin
 * registrar un pago: para recuperar el mensaje de WhatsApp de alguien que lo
 * perdió. No alarga nada.
 */
export async function reenviarCertificado(codigoCrudo: string, ip: string): Promise<ResultadoEmision> {
  const c = esquemaCodigo.safeParse(codigoCrudo);
  if (!c.success) return { ok: false, error: primerError(c.error) };
  const licencia = await obtenerLicencia(c.data);
  if (!licencia) return { ok: false, error: "No existe esa licencia." };
  if (await topeAlcanzado()) {
    return { ok: false, error: `Tope de seguridad: más de ${LIMITE_EMISIONES_POR_HORA} firmas en la última hora.` };
  }
  let certificado: string;
  try {
    certificado = await firmar({ codigo: licencia.codigo, nombre: licencia.nombre, hasta: licencia.vigenteHasta });
  } catch (e) {
    return { ok: false, error: errorDeFirma(e) };
  }
  await auditar("reenviar", licencia.codigo, ip);
  return { ok: true, certificado, mensaje: mensajeParaWhatsApp(certificado), hasta: licencia.vigenteHasta, codigo: licencia.codigo };
}
