import { z } from "zod";

/**
 * Esquema de salida del modelo, una respuesta por imagen (§4).
 *
 * Toda respuesta del modelo pasa por aquí antes de tocarse (§7). Si una imagen
 * no valida, se descarta esa imagen y se informa: nunca se deja pasar un objeto
 * a medio formar al resto del sistema.
 *
 * Los campos son anulables a propósito. Las capturas se solapan y se cortan al
 * hacer scroll, así que una tarjeta puede llegar sin ruta o sin hora. Lo que no
 * se ve se marca, no se inventa.
 */

/**
 * Los dos formatos de código de pedido que trae la app de reparto:
 *
 *   · `v12239582wofp-01` — el habitual;
 *   · `wpet-12268585-01` — el otro, con el número de despacho en el medio.
 *
 * En los dos hay un número de despacho de 8 dígitos y un sufijo de 2 (el bulto).
 */
export const RE_CODIGO_PEDIDO = /^(?:v\d{8}wofp-\d{2}|wpet-\d{8}-\d{2})$/;

/** El texto que dice cómo es un código, para los mensajes de error. */
export const FORMATO_DE_CODIGO = "v12238726wofp-01 o wpet-12268585-01";

/** El número de despacho de un código —sus 8 dígitos—, sea cual sea su formato. */
export function numeroDeDespacho(codigo: string): string | null {
  return (
    /^v(\d{8})wofp-\d{2}$/.exec(codigo)?.[1] ?? /^wpet-(\d{8})-\d{2}$/.exec(codigo)?.[1] ?? null
  );
}

/** Hora de 24 h, `HH:MM`. */
export const esquemaHora = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Hora en formato HH:MM de 24 h");

/** Fecha de calendario `YYYY-MM-DD`. */
export const esquemaFechaISO = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha en formato YYYY-MM-DD");

export const esquemaRutaExtraida = z.object({
  numero: z.number().int().positive(),
  estado: z.string().min(1),
  hora_inicio: esquemaHora.nullable().default(null),
  hora_fin: esquemaHora.nullable().default(null),
  /** false cuando la tarjeta llegó cortada y algún campo no era visible. */
  legible_completo: z.boolean().default(true),
  /**
   * El número no se leyó: se puso por el orden dentro de la captura.
   *
   * Hay que saberlo al fusionar. Un número deducido solo vale dentro de su
   * captura —la primera ruta de la captura de arriba y la primera de la de
   * abajo serían las dos "1"—, así que esas rutas no pueden emparejarse por
   * número sino por horario.
   */
  numero_deducido: z.boolean().default(false),
});

export const esquemaOrdenExtraida = z.object({
  /** Se transcribe carácter por carácter; aquí no se corrige ni se normaliza. */
  codigo: z.string().min(1),
  ruta: z.number().int().positive().nullable().default(null),
  estado: z.string().min(1),
  legible_completo: z.boolean().default(true),
});

export const esquemaResumenOrdenes = z.object({
  entregado: z.number().int().min(0),
  parcial: z.number().int().min(0),
  no_entregado: z.number().int().min(0),
});

export const esquemaImagenExtraida = z.object({
  tipo_pantalla: z.enum(["rutas", "ordenes", "desconocido"]),
  fecha: esquemaFechaISO.nullable().default(null),
  contador_rutas: z.number().int().min(0).nullable().default(null),
  contador_ordenes: z.number().int().min(0).nullable().default(null),
  resumen_ordenes: esquemaResumenOrdenes.nullable().default(null),
  rutas: z.array(esquemaRutaExtraida).default([]),
  ordenes: z.array(esquemaOrdenExtraida).default([]),
});

export type RutaExtraida = z.infer<typeof esquemaRutaExtraida>;
export type OrdenExtraida = z.infer<typeof esquemaOrdenExtraida>;
export type ResumenOrdenes = z.infer<typeof esquemaResumenOrdenes>;
export type ImagenExtraida = z.infer<typeof esquemaImagenExtraida>;

export interface ImagenDescartada {
  indice: number;
  motivo: string;
}

export interface ResultadoParseo {
  validas: ImagenExtraida[];
  descartadas: ImagenDescartada[];
}

/**
 * Valida las respuestas crudas del modelo y separa las que no cumplen.
 *
 * `crudas` viene de `JSON.parse` de la respuesta de cada imagen, en el mismo
 * orden en que se enviaron.
 */
export function parsearRespuestas(crudas: readonly unknown[]): ResultadoParseo {
  const validas: ImagenExtraida[] = [];
  const descartadas: ImagenDescartada[] = [];

  crudas.forEach((cruda, indice) => {
    const r = esquemaImagenExtraida.safeParse(cruda);
    if (r.success) {
      validas.push(r.data);
    } else {
      descartadas.push({
        indice,
        motivo: r.error.issues.map((i) => `${i.path.join(".") || "(raíz)"}: ${i.message}`).join("; "),
      });
    }
  });

  return { validas, descartadas };
}
