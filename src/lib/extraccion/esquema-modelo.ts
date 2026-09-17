import { z } from "zod";

/**
 * Esquema que se le pasa al modelo como formato de salida obligado.
 *
 * Es distinto del de `esquema.ts` a propósito. Ese es **tolerante**: acepta
 * campos ausentes y les pone valores por defecto, porque es el que valida lo
 * que llega. Este es **estricto**: todos los campos son obligatorios y lo que
 * puede faltar se declara `nullable`, que es lo que exige el formato de salida
 * estructurada. Con él, el modelo no puede devolver un objeto a medio formar.
 *
 * Aun así, la respuesta se vuelve a pasar por el esquema tolerante antes de
 * tocarse: una salida estructurada garantiza la forma, no que los datos tengan
 * sentido (§7).
 */

const hora = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);
const fechaISO = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export const esquemaModelo = z.object({
  tipo_pantalla: z.enum(["rutas", "ordenes", "desconocido"]),
  fecha: fechaISO.nullable(),
  contador_rutas: z.number().int().min(0).nullable(),
  contador_ordenes: z.number().int().min(0).nullable(),
  resumen_ordenes: z
    .object({
      entregado: z.number().int().min(0),
      parcial: z.number().int().min(0),
      no_entregado: z.number().int().min(0),
    })
    .nullable(),
  rutas: z.array(
    z.object({
      numero: z.number().int().positive(),
      estado: z.string(),
      hora_inicio: hora.nullable(),
      hora_fin: hora.nullable(),
      legible_completo: z.boolean(),
    }),
  ),
  ordenes: z.array(
    z.object({
      codigo: z.string(),
      ruta: z.number().int().positive().nullable(),
      estado: z.string(),
      legible_completo: z.boolean(),
    }),
  ),
});

export type SalidaModelo = z.infer<typeof esquemaModelo>;
