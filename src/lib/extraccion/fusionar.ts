import type { FechaISO } from "@/lib/fechas";
import type {
  ImagenExtraida,
  OrdenExtraida,
  ResumenOrdenes,
  RutaExtraida,
} from "./esquema";

/**
 * Fusión y deduplicación de las capturas de un día (§4.4).
 *
 * Las capturas se solapan al hacer scroll, así que la misma ruta o el mismo
 * pedido aparece en varias imágenes, a veces cortado. Deduplicar es obligatorio.
 *
 * Lo hace **código determinista**, no el modelo: agrupa por tipo de pantalla,
 * deduplica rutas por número y pedidos por código, y conserva el orden de
 * aparición. Cuando una tarjeta llega dos veces, gana la versión más completa.
 */

export interface RutaFusionada extends RutaExtraida {
  /** Cuántas capturas la traían. Solo para diagnóstico. */
  apariciones: number;
}

export interface OrdenFusionada extends OrdenExtraida {
  /** Posición de la primera aparición, 1-indexada. Es el orden de la app. */
  posicion: number;
  apariciones: number;
}

export interface JornadaFusionada {
  /** null si ninguna captura la traía, o si hay conflicto entre capturas. */
  fecha: FechaISO | null;
  /** Más de una fecha distinta entre las imágenes: carga mixta, se rechaza (§6). */
  fechasEnConflicto: FechaISO[];
  contadorRutas: number | null;
  contadorOrdenes: number | null;
  resumenOrdenes: ResumenOrdenes | null;
  rutas: RutaFusionada[];
  ordenes: OrdenFusionada[];
  /** Cuántas imágenes aportaron a cada tipo de pantalla. */
  conteoImagenes: { rutas: number; ordenes: number; desconocido: number };
}

export function fusionarCapturas(imagenes: readonly ImagenExtraida[]): JornadaFusionada {
  const conteoImagenes = { rutas: 0, ordenes: 0, desconocido: 0 };
  for (const img of imagenes) conteoImagenes[img.tipo_pantalla] += 1;

  /* --- fecha: todas las capturas del día deben coincidir --- */
  const fechas = [...new Set(imagenes.map((i) => i.fecha).filter((f): f is FechaISO => f !== null))];
  const fechasEnConflicto = fechas.length > 1 ? fechas.sort() : [];
  const fecha = fechas.length === 1 ? fechas[0] : null;

  /* --- rutas: se deduplican por número, conservando el orden de aparición --- */
  const rutasPorNumero = new Map<number, RutaFusionada>();
  for (const img of imagenes) {
    for (const ruta of img.rutas) {
      const previa = rutasPorNumero.get(ruta.numero);
      if (!previa) {
        rutasPorNumero.set(ruta.numero, { ...ruta, apariciones: 1 });
      } else {
        rutasPorNumero.set(ruta.numero, {
          ...combinarRuta(previa, ruta),
          apariciones: previa.apariciones + 1,
        });
      }
    }
  }

  /* --- pedidos: se deduplican por código --- */
  const ordenesPorCodigo = new Map<string, OrdenFusionada>();
  for (const img of imagenes) {
    for (const orden of img.ordenes) {
      const previa = ordenesPorCodigo.get(orden.codigo);
      if (!previa) {
        ordenesPorCodigo.set(orden.codigo, {
          ...orden,
          posicion: ordenesPorCodigo.size + 1,
          apariciones: 1,
        });
      } else {
        ordenesPorCodigo.set(orden.codigo, {
          ...combinarOrden(previa, orden),
          posicion: previa.posicion,
          apariciones: previa.apariciones + 1,
        });
      }
    }
  }

  return {
    fecha,
    fechasEnConflicto,
    contadorRutas: consensoNumerico(imagenes.map((i) => i.contador_rutas)),
    contadorOrdenes: consensoNumerico(imagenes.map((i) => i.contador_ordenes)),
    resumenOrdenes: primerResumen(imagenes),
    rutas: [...rutasPorNumero.values()].sort((a, b) => a.numero - b.numero),
    ordenes: [...ordenesPorCodigo.values()].sort((a, b) => a.posicion - b.posicion),
    conteoImagenes,
  };
}

/**
 * Combina dos lecturas de la misma ruta. Gana el dato visible sobre el ausente;
 * si las dos lo traen, gana la primera, porque cambiar de opinión sobre un dato
 * ya leído sería inventar.
 */
function combinarRuta(a: RutaExtraida, b: RutaExtraida): RutaExtraida {
  return {
    numero: a.numero,
    estado: a.legible_completo ? a.estado : b.estado || a.estado,
    hora_inicio: a.hora_inicio ?? b.hora_inicio,
    hora_fin: a.hora_fin ?? b.hora_fin,
    // Queda completa si alguna de las dos capturas la mostró entera.
    legible_completo: a.legible_completo || b.legible_completo,
  };
}

function combinarOrden(a: OrdenExtraida, b: OrdenExtraida): OrdenExtraida {
  return {
    codigo: a.codigo,
    ruta: a.ruta ?? b.ruta,
    estado: a.legible_completo ? a.estado : b.estado || a.estado,
    legible_completo: a.legible_completo || b.legible_completo,
  };
}

/**
 * Los contadores del encabezado se repiten en todas las capturas del día, así
 * que deberían coincidir. Si no, gana el valor más repetido; a igualdad, el
 * mayor, porque un contador leído de menos suele ser un recorte.
 */
function consensoNumerico(valores: readonly (number | null)[]): number | null {
  const presentes = valores.filter((v): v is number => v !== null);
  if (presentes.length === 0) return null;

  const cuenta = new Map<number, number>();
  for (const v of presentes) cuenta.set(v, (cuenta.get(v) ?? 0) + 1);

  let mejor = presentes[0];
  let mejorCuenta = 0;
  for (const [valor, veces] of cuenta) {
    if (veces > mejorCuenta || (veces === mejorCuenta && valor > mejor)) {
      mejor = valor;
      mejorCuenta = veces;
    }
  }
  return mejor;
}

function primerResumen(imagenes: readonly ImagenExtraida[]): ResumenOrdenes | null {
  for (const img of imagenes) {
    if (img.resumen_ordenes) return img.resumen_ordenes;
  }
  return null;
}

/**
 * Separa las capturas por día y fusiona cada día por su cuenta.
 *
 * Antes, subir capturas de dos días era un error que había que deshacer a
 * mano. Es una exigencia absurda: al final de la semana uno tiene el carrete
 * lleno y no va a ir seleccionando de tres en tres. El sistema puede
 * ordenarlas solo.
 *
 * **El reparto de las capturas sin fecha es lo que tiene miga.** Solo la
 * primera captura de cada pantalla trae la cabecera `Resumen del DD/MM/YYYY`;
 * en cuanto se hace scroll para fotografiar el resto, la fecha desaparece. Así
 * que la mayoría de las capturas de un día no dicen de qué día son.
 *
 * Se resuelve con el orden en que se subieron, que refleja cómo se tomaron:
 * se abre el día 17, se fotografía arriba —con fecha—, se baja y se fotografía
 * el resto —sin fecha—, y luego se pasa al día 18. Por eso **una captura sin
 * fecha pertenece al último día visto antes de ella**. Las que llegan antes de
 * cualquier fecha se asignan a la primera, que es el único candidato posible.
 *
 * Devuelve los días ordenados de más antiguo a más reciente.
 */
export function fusionarPorFecha(
  imagenes: readonly ImagenExtraida[],
): JornadaFusionada[] {
  return agruparPorFecha(imagenes, (i) => i.fecha).map(([, delDia]) =>
    fusionarCapturas(delDia),
  );
}

/**
 * Reparte cosas por día según la fecha que trae cada una.
 *
 * Está separado de `fusionarPorFecha` porque hace falta dos veces con datos
 * distintos: para las capturas leídas y para las **imágenes originales**, que
 * se guardan como prueba del día al que pertenecen. Duplicar esta regla en dos
 * sitios sería garantizar que un día se separen de forma distinta.
 *
 * Devuelve los grupos ordenados por fecha, de más antigua a más reciente. La
 * clave del grupo es `""` cuando no se pudo determinar el día.
 */
export function agruparPorFecha<T>(
  cosas: readonly T[],
  fechaDe: (cosa: T) => string | null,
): Array<[string, T[]]> {
  if (cosas.length === 0) return [];

  const grupos = new Map<string, T[]>();
  const SIN_FECHA = "";
  let ultimaVista: string | null = null;

  for (const cosa of cosas) {
    const suya = fechaDe(cosa);
    if (suya) ultimaVista = suya;
    const clave = suya ?? ultimaVista ?? SIN_FECHA;
    const grupo = grupos.get(clave);
    if (grupo) grupo.push(cosa);
    else grupos.set(clave, [cosa]);
  }

  /* Las que llegaron antes de ver ninguna fecha: si al final resultó haber un
     solo día, son de ese día sin ninguna duda. Si hubo varios, no hay forma
     honesta de adivinarlo y se dejan aparte para que la persona lo diga. */
  const huerfanas = grupos.get(SIN_FECHA);
  const conFecha = [...grupos.keys()].filter((k) => k !== SIN_FECHA);
  if (huerfanas && conFecha.length === 1) {
    grupos.get(conFecha[0])!.unshift(...huerfanas);
    grupos.delete(SIN_FECHA);
  }

  return [...grupos.entries()].sort(([a], [b]) => a.localeCompare(b));
}
