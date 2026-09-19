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
  /**
   * Orden de su primera aparición, bajando por las capturas. Es el orden de la
   * lista de la app de reparto, que es el que manda para numerar —no la hora—.
   */
  posicion: number;
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

  /* --- rutas: se deduplican **por horario**, no por número ---

     La misma ruta sale en varias capturas porque se solapan al hacer scroll,
     y hay que quedarse con una. Emparejarlas por número era lo evidente y
     fallaba: cuando el lector no ve el círculo, el número se pone por el orden
     dentro de la captura, así que la primera ruta de la captura de arriba y la
     primera de la de abajo eran las dos "Ruta 1" y se pisaban. Se perdían
     rutas enteras y las que quedaban salían con el horario de otra.

     El horario, en cambio, identifica una ruta sin ambigüedad: dos rutas del
     mismo día no empiezan y acaban a la misma hora. El número se reconstruye
     después, con `numerarRutas`. */
  const rutasPorClave = new Map<string, RutaFusionada>();
  let sinClave = 0;
  for (const img of imagenes) {
    for (const ruta of img.rutas) {
      const clave =
        ruta.hora_inicio && ruta.hora_fin
          ? `h:${ruta.hora_inicio}-${ruta.hora_fin}`
          : !ruta.numero_deducido
            ? `n:${ruta.numero}`
            : `?:${sinClave++}`;

      const previa = rutasPorClave.get(clave);
      if (!previa) {
        rutasPorClave.set(clave, { ...ruta, apariciones: 1, posicion: rutasPorClave.size + 1 });
      } else {
        rutasPorClave.set(clave, {
          ...combinarRuta(previa, ruta),
          apariciones: previa.apariciones + 1,
          posicion: previa.posicion,
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

  const resumenOrdenes = primerResumen(imagenes);

  return {
    fecha,
    fechasEnConflicto,
    contadorRutas: consensoNumerico(imagenes.map((i) => i.contador_rutas)),
    contadorOrdenes: consensoNumerico(imagenes.map((i) => i.contador_ordenes)),
    resumenOrdenes,
    rutas: numerarRutas([...rutasPorClave.values()]),
    ordenes: cuadrarConElResumen(
      completarRutasPorVecinos(
        [...ordenesPorCodigo.values()].sort((a, b) => a.posicion - b.posicion),
      ),
      resumenOrdenes,
    ),
    conteoImagenes,
  };
}

/**
 * Pone a cada ruta su número definitivo.
 *
 * El número es el de **la lista de la app de reparto**, y esa lista no va por
 * orden de hora: suele empezar con una o dos rutas de la noche anterior —la 1 a
 * las 20:21, la 2 a las 21:24— y recién la 3 es de la mañana. Numerar por hora,
 * que es lo que se hacía, mandaba esas rutas al final como si fueran la 8 y la
 * 9, y los pedidos que dicen "Ruta 1" quedaban apuntando a la ruta equivocada.
 *
 * Por eso se numera por **orden de aparición** bajando por las capturas, que es
 * el orden de la lista. Un número leído en el círculo se respeta siempre; los
 * que faltan se rellenan contando desde el leído más cercano:
 *
 *     «1» 20:21    leído
 *      ?  21:24    → 2, justo detrás de la 1
 *     «3» 10:03    leído
 *
 * Si no se leyó ninguno, se numeran desde la 1 en el orden de la lista.
 */
export function numerarRutas(rutas: readonly RutaFusionada[]): RutaFusionada[] {
  const enLista = [...rutas].sort((a, b) => a.posicion - b.posicion);
  const numeros = enLista.map((r) => (r.numero_deducido ? null : r.numero));

  for (let i = 0; i < numeros.length; i++) {
    if (numeros[i] !== null) continue;

    // El leído más cercano por delante marca desde dónde contar.
    let j = i - 1;
    while (j >= 0 && numeros[j] === null) j--;
    if (j >= 0) {
      numeros[i] = (numeros[j] as number) + (i - j);
      continue;
    }

    // Si no hay ninguno antes, se cuenta hacia atrás desde el siguiente leído.
    let k = i + 1;
    while (k < numeros.length && numeros[k] === null) k++;
    numeros[i] = k < numeros.length ? Math.max(1, (numeros[k] as number) - (k - i)) : i + 1;
  }

  return enLista
    .map((r, i) => ({ ...r, numero: numeros[i] as number }))
    .sort((a, b) => a.numero - b.numero);
}

/**
 * Pone la ruta a un pedido al que no se le leyó, **solo cuando es seguro**.
 *
 * La lista de pedidos de la app va ordenada por ruta —1, 1, 2, 2, 3…—. Así
 * que si el pedido de antes y el de después son de la misma ruta, el de en
 * medio también lo es, sin ninguna duda.
 *
 * Si son de rutas distintas, el pedido está en la frontera y podría ser de
 * cualquiera de las dos. Ahí no se adivina: se deja sin ruta para que se vea y
 * se corrija. Con dos pedidos por ruta, que es lo normal, casi todos están en
 * una frontera, así que esto rescata pocos; el rescate de verdad viene del
 * solapamiento entre capturas —el mismo pedido sale en dos y en una se leyó
 * la etiqueta—, que ya resuelve la fusión.
 */
export function completarRutasPorVecinos(ordenes: OrdenFusionada[]): OrdenFusionada[] {
  return ordenes.map((o, i) => {
    if (o.ruta !== null) return o;

    let antes: number | null = null;
    for (let j = i - 1; j >= 0 && antes === null; j--) antes = ordenes[j].ruta;
    let despues: number | null = null;
    for (let k = i + 1; k < ordenes.length && despues === null; k++) despues = ordenes[k].ruta;

    return antes !== null && antes === despues ? { ...o, ruta: antes } : o;
  });
}

/**
 * Corrige los estados que contradicen a la tarjeta de resumen.
 *
 * La tarjeta de arriba de la pantalla de pedidos dice cuántos se entregaron,
 * cuántos a medias y cuántos no, y es **el dato más fiable de toda la
 * captura**: son tres números grandes en una posición fija. El estado de cada
 * pedido, en cambio, es un rótulo pequeño que el lector puede atribuir al
 * pedido equivocado.
 *
 * Así que cuando el resumen dice que hubo **cero** no entregados, ningún pedido
 * puede estarlo, lea lo que lea el lector. Es exactamente lo que pasó en el
 * primer uso real: dieciocho pedidos pintados de rojo en un día en que se
 * entregó todo.
 *
 * Solo se corrige lo que el resumen permite afirmar con certeza. Si dice que
 * hubo un no entregado y se leyeron tres, no hay forma de saber cuál es el
 * bueno, y se deja como está para que lo decida la persona.
 */
export function cuadrarConElResumen(
  ordenes: OrdenFusionada[],
  resumen: ResumenOrdenes | null,
): OrdenFusionada[] {
  if (!resumen) return ordenes;
  return ordenes.map((o) => {
    if (o.estado === "No entregado" && resumen.no_entregado === 0) {
      return { ...o, estado: "Entregado" };
    }
    if (o.estado === "Entrega parcial" && resumen.parcial === 0) {
      return { ...o, estado: "Entregado" };
    }
    return o;
  });
}

/**
 * Combina dos lecturas de la misma ruta. Gana el dato visible sobre el ausente;
 * si las dos lo traen, gana la primera, porque cambiar de opinión sobre un dato
 * ya leído sería inventar.
 */
function combinarRuta(a: RutaExtraida, b: RutaExtraida): RutaExtraida {
  // Un número leído gana a uno deducido: el deducido solo valía en su captura.
  const numeroLeido = !a.numero_deducido ? a : !b.numero_deducido ? b : null;
  return {
    numero: numeroLeido ? numeroLeido.numero : a.numero,
    numero_deducido: numeroLeido === null,
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
