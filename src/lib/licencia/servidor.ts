/**
 * Firmar licencias desde el panel web —a diferencia de `emitir.ts`, este
 * archivo sí lleva `"server-only"` a propósito: usa `process.env`, algo que
 * solo tiene sentido dentro de Next.js, nunca en el CLI por `jiti`.
 *
 * La decisión consciente que esto representa: la clave privada deja de
 * existir *solo* en la Mac de quien administra (`~/.rutas-a`) y pasa a vivir
 * también como variable de entorno del servidor, `LICENCIA_CLAVE_PRIVADA`.
 * Antes de esto, emitir una licencia exigía terminal y esa Mac encendida; a
 * partir de 400-1000 suscriptores eso no aguanta. El CLI sigue funcionando
 * igual, como respaldo y para quien prefiera la terminal —las dos copias de
 * la clave firman certificados idénticos, porque las dos usan exactamente
 * `emitirCertificado` de `emitir.ts`.
 */
import "server-only";

import { hoyEnLima } from "../fechas";
import {
  emitirCertificado,
  importarClavePrivada,
  parsearDuracion,
  sumarDiasDeVigencia,
  sumarMeses,
} from "./emitir";
import { buscarLicencia, registrarEmision } from "./repositorio";

const DIAS_DE_GRACIA = 7;

export type ResultadoEmision =
  | { ok: true; certificado: string; hasta: string }
  | { ok: false; error: string };

/**
 * Firma una licencia desde el panel, con la misma validación que el CLI
 * (`scripts/licencia.ts`): mismo formato de código, mismo rango de meses o
 * días, misma lógica de "sumar a lo que le quedaba". Que existan dos sitios
 * desde donde se puede emitir no debe significar dos reglas distintas.
 */
export async function emitirDesdeElPanel(datos: {
  codigo: string;
  nombre: string;
  duracionTexto: string;
}): Promise<ResultadoEmision> {
  const codigo = datos.codigo.trim();
  const nombre = datos.nombre.trim();

  if (!codigo || !nombre) return { ok: false, error: "Falta el código del teléfono o el nombre." };
  if (!/^[0-9a-f-]{36}$/i.test(codigo)) {
    return { ok: false, error: "Ese código no parece el de un teléfono. Pide que lo copien de Ajustes → Tu licencia." };
  }

  const duracion = parsearDuracion(datos.duracionTexto.trim());
  if (!duracion) {
    return { ok: false, error: "Duración inválida: un número de meses (1-24), o de días con 'd', como 15d." };
  }
  if (duracion.unidad === "meses" && (duracion.cantidad < 1 || duracion.cantidad > 24)) {
    return { ok: false, error: "Meses: entre 1 y 24." };
  }
  if (duracion.unidad === "dias" && (duracion.cantidad < 1 || duracion.cantidad > 90)) {
    return { ok: false, error: "Días: entre 1 y 90 —para más de tres meses, usa meses." };
  }

  const texto = process.env.LICENCIA_CLAVE_PRIVADA;
  if (!texto) {
    return { ok: false, error: "Falta LICENCIA_CLAVE_PRIVADA en el servidor: todavía no se puede firmar desde aquí." };
  }

  const hoy = hoyEnLima();
  const previa = await buscarLicencia(codigo);
  const hasta =
    duracion.unidad === "meses"
      ? sumarMeses(previa?.vigenteHasta ?? null, duracion.cantidad, hoy)
      : sumarDiasDeVigencia(previa?.vigenteHasta ?? null, duracion.cantidad, hoy);

  const clave = await importarClavePrivada(JSON.parse(texto));
  const certificado = await emitirCertificado(
    {
      usuario: codigo,
      nombre,
      dispositivo: codigo,
      vigenteHasta: hasta,
      emitidoEn: new Date().toISOString(),
      diasDeGracia: DIAS_DE_GRACIA,
    },
    clave,
  );

  await registrarEmision({
    codigo,
    nombre,
    vigenteHasta: hasta,
    diasDeGracia: DIAS_DE_GRACIA,
    fechaDePago: hoy,
    duracion: datos.duracionTexto.trim(),
  });

  return { ok: true, certificado, hasta };
}
