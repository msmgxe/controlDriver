/**
 * Validación estricta de todo lo que entra al panel y al CLI. Una sola fuente
 * de reglas: el panel (`servidor.ts`) y `scripts/licencia.ts` usan estas
 * mismas, para que no haya dos criterios distintos de "qué es válido".
 *
 * Sin `server-only`: lo importa también el CLI por `jiti`.
 */
import { z } from "zod";

export const MONTO_MAXIMO_SOLES = 5000;

/** El código del teléfono es un UUID (8-4-4-4-12 hexadecimales). */
export const esquemaCodigo = z.guid("Ese código no parece el de un teléfono. Pide que lo copien de Ajustes → Tu licencia.");

export const esquemaNombre = z
  .string()
  .trim()
  .min(1, "Falta el nombre.")
  .max(80, "Nombre demasiado largo (máx. 80).")
  // Sin caracteres de control: acabaría en el certificado, el CSV y el mensaje.
  .refine((t) => !/[\u0000-\u001f\u007f]/.test(t), "Nombre con caracteres no permitidos.");

export const esquemaMeses = z.coerce
  .number("Meses inválidos.")
  .int("Meses: un número entero.")
  .min(1, "Meses: entre 1 y 24.")
  .max(24, "Meses: entre 1 y 24.");

/**
 * Convierte "15", "15.50" o "15,5" en céntimos. `null` si viene vacío (el
 * monto es opcional). Devuelve `NaN` si no es un monto válido; nunca lanza.
 */
export function aCentimos(texto: string | null | undefined): number | null {
  const t = (texto ?? "").trim().replace(",", ".");
  if (t === "") return null;
  if (!/^\d{1,4}(\.\d{1,2})?$/.test(t)) return Number.NaN;
  const centimos = Math.round(Number(t) * 100);
  if (centimos < 0 || centimos > MONTO_MAXIMO_SOLES * 100) return Number.NaN;
  return centimos;
}

export const esquemaMonto = z
  .string()
  .optional()
  .transform((t, ctx) => {
    const c = aCentimos(t);
    if (c !== null && Number.isNaN(c)) {
      ctx.addIssue({ code: "custom", message: `Monto: un número entre 0 y ${MONTO_MAXIMO_SOLES} (máx. 2 decimales).` });
      return z.NEVER;
    }
    return c;
  });

const METODOS_CONOCIDOS: Record<string, string> = {
  yape: "Yape",
  plin: "Plin",
  efectivo: "Efectivo",
};

/** Yape / Plin / Efectivo, o un texto corto (máx. 20) para cualquier otro. */
export const esquemaMetodo = z
  .string()
  .optional()
  .transform((t, ctx) => {
    const v = (t ?? "").trim();
    if (v === "") return null;
    const conocido = METODOS_CONOCIDOS[v.toLowerCase()];
    if (conocido) return conocido;
    if (v.length > 20 || !/^[\p{L}\p{N} .\-/]+$/u.test(v)) {
      ctx.addIssue({ code: "custom", message: "Método: texto corto (máx. 20), sin símbolos raros." });
      return z.NEVER;
    }
    return v;
  });

export const esquemaTelefono = z
  .string()
  .optional()
  .transform((t, ctx) => {
    const v = (t ?? "").trim();
    if (v === "") return null;
    if (!/^\+?[\d ()-]{6,20}$/.test(v)) {
      ctx.addIssue({ code: "custom", message: "Teléfono: solo dígitos, espacios y + (6 a 20 caracteres)." });
      return z.NEVER;
    }
    return v;
  });

export const esquemaNotas = z
  .string()
  .optional()
  .transform((t, ctx) => {
    const v = (t ?? "").trim();
    if (v === "") return null;
    if (v.length > 500) {
      ctx.addIssue({ code: "custom", message: "Notas: máximo 500 caracteres." });
      return z.NEVER;
    }
    return v;
  });

/** Emisión nueva o renovación: lo que llega de un formulario. */
export const esquemaEmision = z.object({
  codigo: esquemaCodigo,
  nombre: esquemaNombre,
  meses: esquemaMeses,
  monto: esquemaMonto,
  metodo: esquemaMetodo,
  telefono: esquemaTelefono,
  notas: esquemaNotas,
});

export const esquemaContacto = z.object({
  codigo: esquemaCodigo,
  nombre: esquemaNombre,
  telefono: esquemaTelefono,
  notas: esquemaNotas,
});

export type DatosEmision = z.output<typeof esquemaEmision>;

/** El primer mensaje de error legible de un fallo de zod. */
export function primerError(error: z.ZodError): string {
  return error.issues[0]?.message ?? "Datos inválidos.";
}

/** Saca los campos de un FormData como texto (nunca archivos). */
export function textoDe(datos: FormData, campos: string[]): Record<string, string> {
  const salida: Record<string, string> = {};
  for (const c of campos) {
    const v = datos.get(c);
    if (typeof v === "string") salida[c] = v;
  }
  return salida;
}
