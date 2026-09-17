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

/** `^v\d{8}wofp-\d{2}$`, p. ej. `v12239582wofp-01`. */
export const RE_CODIGO_PEDIDO = /^v\d{8}wofp-\d{2}$/;

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
