/**
 * Interpretación de las capturas **sin modelo de lenguaje**.
 *
 * Las capturas de la app de reparto no son fotos: son pantallazos. Texto
 * digital, contraste perfecto, la misma tipografía y la misma disposición
 * siempre. Es el caso más fácil que existe para un lector de texto, y encima
 * el formato es fijo, así que un intérprete escrito a mano acierta más que un
 * modelo —no improvisa, no alucina un código que no vio, y cuesta cero.
 *
 * Lo que llega aquí es la lista de líneas que el lector del teléfono sacó de
 * la imagen, en orden de lectura. Lo que sale es exactamente la misma
 * estructura que producía el modelo, así que el resto del sistema —fusión,
 * validación, revisión— no se entera del cambio.
 *
 * Los cuatro patrones que lo hacen posible, y que no se parecen a nada más:
 *
 *   · `Resumen del 16/09/2026`
 *   · `Rutas 7` · `Órdenes 14`
 *   · `De: 10:03 a 10:27 horas`
 *   · `v12238726wofp-01`
 */
import {
  esquemaImagenExtraida,
  esquemaOrdenExtraida,
  esquemaRutaExtraida,
  type ImagenExtraida,
  type OrdenExtraida,
  type RutaExtraida,
} from "./esquema";

/* ---------------------------------------------------------------------------
 * Limpieza
 * ------------------------------------------------------------------------- */

/** Sin acentos y en minúsculas, para comparar sin depender de la tilde. */
export function normalizar(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();
}

/**
 * Qué dígito es cada letra que el lector confunde con uno.
 *
 * Cada una se parece a **un** dígito, y la tabla anterior mezclaba dos: la `B`
 * mayúscula es un 8 —de ahí que un `v12250818` con el último trazo cortado
 * saliera como `v12250618`, un pedido que no existe—, y la `b` minúscula es un
 * 6. Lo mismo la `G` (6) y la `g` (9).
 */
const DIGITO_DE: Readonly<Record<string, string>> = {
  o: "0", O: "0", D: "0", Q: "0",
  l: "1", L: "1", i: "1", I: "1", "|": "1",
  z: "2", Z: "2",
  s: "5", S: "5",
  b: "6", G: "6",
  T: "7",
  B: "8",
  g: "9", q: "9",
};

/**
 * Arregla las confusiones clásicas de un lector de texto **solo donde toca**.
 *
 * En un código de pedido sabemos que esas posiciones son dígitos, así que una
 * `O` solo puede ser un cero y una `l` solo puede ser un uno. Aplicar esto al
 * texto entero sería destructivo —convertiría "Finalizado" en "F1na1izado"—,
 * de ahí que se use únicamente dentro del código, donde no hay ambigüedad.
 */
function soloDigitos(trozo: string): string {
  return [...trozo].map((c) => DIGITO_DE[c] ?? c).join("").replace(/[^\d]/g, "");
}

/* ---------------------------------------------------------------------------
 * Patrones
 * ------------------------------------------------------------------------- */

/** `Resumen del 16/09/2026`, con o sin "del", y admitiendo guiones. */
const RE_FECHA = /resumen\s+(?:del?\s+)?(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{4})/;

/** `Rutas 7` — el contador de la cabecera. En plural, a diferencia de `Ruta 4`. */
const RE_CONTADOR_RUTAS = /^rutas\s*[:(]?\s*(\d{1,3})\s*\)?$/;

/** `Órdenes 14` — ya sin tilde por `normalizar`. */
const RE_CONTADOR_ORDENES = /^ordenes\s*[:(]?\s*(\d{1,3})\s*\)?$/;

/**
 * En la pantalla real los contadores van dentro de un círculo junto a la
 * pestaña: `Rutas (7)`. El lector a menudo devuelve la palabra y el número en
 * líneas separadas, y ese `14` suelto se tomaba por el número de una ruta.
 */
const RE_PESTANA_RUTAS = /^rutas$/;
const RE_PESTANA_ORDENES = /^ordenes$/;

/**
 * Un número que puede llevar delante el icono de su tarjeta.
 *
 * El resumen pone un ✓ verde, un ⚠ amarillo y un ! rojo delante de cada cifra.
 * El lector los convierte en lo que le parece más cercano: un símbolo, un
 * número dentro de un círculo, o una letra —la O por el ✓, la A por el ⚠—.
 */
const RE_NUMERO_CON_ICONO = /^(?:[^\w\s]|[oaq@©]|[\u2460-\u24ff])?\s*(\d{1,3})$/;

/**
 * La palabra «ruta», con la errata que el lector comete en la letra pequeña y
 * gris de la etiqueta: una `t` que sale `l`, `1` o `i`.
 */
const RUTA = "ru[tl1i]a";

/** `1 Ruta • Finalizado`: el círculo con el número y la palabra en la misma línea. */
const RE_NUMERO_Y_RUTA = new RegExp(`^(\\d{1,3})\\s*[.·•\\-)]?\\s*${RUTA}\\b`);

/** `Ruta 4` en cualquier punto de la línea, para cuando va junto al código. */
const RE_RUTA_EN_LINEA = new RegExp(`\\b${RUTA}\\s*:?\\s*(\\d{1,3})\\b`);

/**
 * `De: 10:03 a 10:27 horas`
 *
 * El «De:» es opcional y los dos puntos pueden salir como punto o punto y
 * coma: bastaba que el lector se comiera esa palabra, o cambiara un signo,
 * para que la ruta entera desapareciera sin dejar rastro. La pareja
 * «hora a hora» ya es lo bastante específica por sí sola.
 */
const RE_HORARIO =
  /(?:\bde:?\s*)?(\d{1,2})\s*[:.;]\s*(\d{2})\s*(?:a|al|-|–|—)\s*(\d{1,2})\s*[:.;]\s*(\d{2})/;

/** Las dos horas de un horario, ya en `HH:MM`, o null si la línea no trae ninguno. */
function leerHorario(linea: string): [string, string] | null {
  const m = linea.match(RE_HORARIO);
  return m ? [normalizarHora(`${m[1]}:${m[2]}`), normalizarHora(`${m[3]}:${m[4]}`)] : null;
}

/**
 * Los caracteres que en un código son dígitos, contando los que el lector
 * suele poner en su lugar.
 */
const DIG = "[0-9oOlLiI|sSbBgGzZqQdDT]";

/**
 * `v12238726wofp-01`
 *
 * Se admiten espacios de más y se toleran letras donde deberían ir dígitos,
 * porque es justo donde el lector se equivoca. La reconstrucción posterior
 * devuelve siempre la forma canónica.
 *
 * Es deliberadamente **más ancha** que el formato real —de 6 a 10 dígitos, y
 * un sufijo de 1 a 3—. Un pedido que se lee con un dígito de menos o de más
 * es un pedido leído: se conserva, se marca como dudoso y la pantalla de
 * Revisión pide mirarlo. Con la regla estricta se perdía en silencio, y
 * faltaban pedidos sin que nadie supiera por qué. Tampoco se exige que
 * «wofp» salga exacto: basta `w`, dos caracteres cualesquiera y una `p`, y el
 * guion admite las variantes tipográficas que ponen los lectores.
 */
export const RE_CODIGO = new RegExp(
  `v\\s*(${DIG}{6,10})\\s*(?:w|vv)\\s*[a-z0-9]\\s*[a-z0-9]\\s*p\\s*[-\\u2010-\\u2015\\u2212_.·:]?\\s*(${DIG}{1,3})`,
  "i",
);

/** ¿Tiene el código el formato exacto —8 dígitos, `-` y 2 más—? */
function codigoCompleto(digitos: string, sufijo: string): boolean {
  return digitos.length === 8 && sufijo.length === 2;
}

/**
 * `wpet-12268585-01` — el otro formato de código que trae la app de reparto,
 * con el número de despacho en el medio.
 *
 * Aquí el ancla es la **palabra**, no la forma: `w`, `p` y dos caracteres
 * cualesquiera —para tolerar el `wpet` mal leído—. Sin exigir la `p`, cualquier
 * palabra de cuatro letras seguida de un número podía pasar por código, porque
 * los dígitos admiten letras que el lector confunde con ellos.
 */
export const RE_CODIGO_WPET = new RegExp(
  `w\\s*p\\s*[a-z0-9]\\s*[a-z0-9]\\s*[-\\u2010-\\u2015\\u2212_.·:]\\s*(${DIG}{6,10})\\s*[-\\u2010-\\u2015\\u2212_.·:]\\s*(${DIG}{1,3})`,
  "i",
);

/** Un código de pedido hallado en una línea de texto. */
export interface CodigoHallado {
  /** Su forma canónica: `v12238726wofp-01` o `wpet-12268585-01`. */
  codigo: string;
  digitos: string;
  sufijo: string;
  /** Lo que ocupaba en la línea, para poder quitarlo y mirar lo que queda. */
  texto: string;
}

/**
 * El código de pedido que trae una línea, en cualquiera de sus dos formatos.
 *
 * Se prueba primero el habitual: el otro solo se busca si ese no está.
 */
export function buscarCodigo(linea: string): CodigoHallado | null {
  const m = linea.match(RE_CODIGO);
  if (m) {
    const digitos = soloDigitos(m[1]);
    const sufijo = soloDigitos(m[2]);
    return { codigo: `v${digitos}wofp-${sufijo}`, digitos, sufijo, texto: m[0] };
  }

  const w = linea.match(RE_CODIGO_WPET);
  // Con al menos cinco dígitos de verdad: los que el lector confunde con letras no bastan.
  if (w && (w[1].match(/\d/g)?.length ?? 0) >= 5) {
    const digitos = soloDigitos(w[1]);
    const sufijo = soloDigitos(w[2]);
    return { codigo: `wpet-${digitos}-${sufijo}`, digitos, sufijo, texto: w[0] };
  }
  return null;
}

/** ¿Lleva esta línea un código de pedido? */
export const hayCodigo = (linea: string): boolean => buscarCodigo(linea) !== null;

/**
 * `Ruta 4` — en singular: la ruta a la que pertenecen los pedidos.
 *
 * Admite cosas detrás —una flecha, el horario, el estado— porque en la lista
 * de pedidos agrupada por ruta es la cabecera de un bloque, y ahí suele ir
 * acompañada. No confunde el contador `Rutas 7`: tras "ruta" exige espacio o
 * dos puntos antes del número, y la "s" del plural no es ninguna de las dos.
 */
export const RE_RUTA_DEL_PEDIDO = new RegExp(`^${RUTA}\\s*:?\\s*(\\d{1,3})\\b`);

/** Estados propios de un pedido. "Finalizado" es de las rutas y no cuenta aquí. */
export const ESTADOS_DE_PEDIDO = new Set(["Entregado", "Entrega parcial", "No entregado"]);

/** Un número suelto: en la pantalla de Rutas es el círculo azul. */
const RE_NUMERO_SUELTO = /^(\d{1,3})$/;

/**
 * Estados conocidos.
 *
 * La lista no es cerrada: §17.4 avisa de que pueden aparecer estados nuevos.
 * Por eso lo que no se reconoce **no se descarta** —se conserva tal cual y la
 * pantalla de Revisión lo enseña para que la persona decida.
 */
const ESTADOS: ReadonlyArray<{ patron: RegExp; canonico: string }> = [
  { patron: /^entrega\s+parcial$/, canonico: "Entrega parcial" },
  { patron: /^no\s+entregado$/, canonico: "No entregado" },
  { patron: /^entregado$/, canonico: "Entregado" },
  { patron: /^finalizado$/, canonico: "Finalizado" },
  { patron: /^en\s+curso$/, canonico: "En curso" },
  { patron: /^cancelado$/, canonico: "Cancelado" },
  { patron: /^pendiente$/, canonico: "Pendiente" },
];

/** Los mismos estados, buscados dentro de una línea que trae más cosas. */
const ESTADOS_EN_LINEA: ReadonlyArray<{ patron: RegExp; canonico: string }> = [
  { patron: /\bentrega\s+parcial\b/, canonico: "Entrega parcial" },
  { patron: /\bno\s+entregado\b/, canonico: "No entregado" },
  { patron: /\bentregado\b/, canonico: "Entregado" },
];

/**
 * El icono que acompaña al estado, leído como carácter.
 *
 * En la pantalla real el estado lleva delante un ✓ en un círculo, y el lector
 * lo devuelve como lo que le parece: `| Entregado`, `• Entregado`,
 * `V Entregado`. Buscando el estado exacto no se reconocía ninguno.
 */
const RE_ICONO_DELANTE = /^(?:[^\p{L}\p{N}\s]+|[vo©@])\s+/u;

/** Distancia de edición entre dos textos cortos. */
function distancia(a: string, b: string): number {
  const fila = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    let anterior = fila[0];
    fila[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const guardado = fila[j];
      fila[j] = Math.min(
        fila[j] + 1,
        fila[j - 1] + 1,
        anterior + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
      anterior = guardado;
    }
  }
  return fila[b.length];
}

/**
 * Lo que queda de un rótulo de estado tras quitarle el ruido que le pone el
 * lector: solo letras y espacios, y sin las letras sueltas del principio o del
 * final, que son el icono o el borde de la etiqueta.
 *
 * El estado va dentro de una **píldora** —un borde redondeado con un ✓ verde
 * delante—, y el lector devuelve el borde como paréntesis y el ✓ como una
 * letra: `(O Entregado)`, `(• Entregado`, `V Entregado`. Con la regla de antes
 * solo se reconocía el estado si el ruido era un símbolo pegado con un
 * espacio, y `(O Entregado)` se perdía: el pedido salía con el estado por
 * defecto y marcado como incompleto.
 */
function rotuloLimpio(linea: string): string {
  const palabras = linea
    .replace(/[^\p{L}\s]/gu, " ")
    .split(/\s+/)
    .filter(Boolean);
  while (palabras.length > 1 && palabras[0].length === 1) palabras.shift();
  while (palabras.length > 1 && palabras[palabras.length - 1].length === 1) palabras.pop();
  return palabras.join(" ");
}

export function estadoDe(linea: string): string | null {
  const sinIcono = linea.replace(RE_ICONO_DELANTE, "");
  for (const { patron, canonico } of ESTADOS) {
    if (patron.test(sinIcono)) return canonico;
  }

  /* Segunda pasada, más permisiva: el rótulo limpio, y aun con una o dos
     letras mal leídas —«Entregadc», «Entrega do»—. Solo para textos largos, en
     los que dos letras de diferencia son el lector y no otra palabra. */
  const limpio = rotuloLimpio(linea);
  if (limpio.length < 7) return null;

  const exacto = ESTADOS.find(({ canonico }) => limpio === canonico.toLowerCase());
  if (exacto) return exacto.canonico;

  /* Se elige **el más cercano**, y solo si gana con claridad: «entregado» está
     a dos letras de «no entregado», y tomar el primero que pase el umbral
     convertía un estado en el contrario. Tampoco vale una palabra mucho más
     corta o larga —«Entrega» suelto no es «Entregado»—. */
  const sinEspacios = limpio.replace(/\s+/g, "");
  const candidatos = ESTADOS.map(({ canonico }) => {
    const objetivo = canonico.toLowerCase().replace(/\s+/g, "");
    const tolera = objetivo.length >= 9 ? 2 : 1;
    const d = distancia(sinEspacios, objetivo);
    return { canonico, d, valido: d <= tolera && Math.abs(sinEspacios.length - objetivo.length) <= 1 };
  })
    .filter((c) => c.valido)
    .sort((a, b) => a.d - b.d);

  if (candidatos.length === 0) return null;
  if (candidatos.length > 1 && candidatos[0].d === candidatos[1].d) return null;
  return candidatos[0].canonico;
}

/**
 * Lee y aparta la cabecera fija de la pantalla: los contadores de las
 * pestañas y la tarjeta de resumen.
 *
 * Va en una pasada previa, antes que el resto, por una razón que costó cara:
 * todo lo de la cabecera son **números sueltos y rótulos de estado**, que es
 * exactamente lo que el resto del intérprete busca en las tarjetas. Si no se
 * aparta antes, el `14` del contador de órdenes se toma por el número de una
 * ruta y el `No entregado` del resumen por el estado de un pedido —que fue lo
 * que pintó de rojo un día entero en que se entregó todo—.
 *
 * El orden importa: primero los contadores, luego el resumen. El primer
 * rótulo del resumen se decide mirando la línea anterior, y si esa línea es el
 * `14` del contador, se equivocaba de lado.
 */
function lineasDeCabecera(lineas: readonly string[]): {
  consumidas: Set<number>;
  contadorRutas: number | null;
  contadorOrdenes: number | null;
  resumen: { entregado: number; parcial: number; noEntregado: number } | null;
} {
  const consumidas = new Set<number>();
  let contadorRutas: number | null = null;
  let contadorOrdenes: number | null = null;

  // Hasta dónde llega la cabecera: nunca más allá del primer pedido.
  let limite = lineas.length;
  for (let i = 0; i < lineas.length; i++) {
    if (hayCodigo(lineas[i])) {
      limite = i;
      break;
    }
  }

  /* --- contadores de las pestañas --- */
  for (let i = 0; i < limite; i++) {
    const linea = normalizar(lineas[i]);
    const junto =
      linea.match(RE_CONTADOR_RUTAS) ?? linea.match(RE_CONTADOR_ORDENES);
    if (junto) {
      if (RE_CONTADOR_RUTAS.test(linea)) contadorRutas = Number(junto[1]);
      else contadorOrdenes = Number(junto[1]);
      consumidas.add(i);
      continue;
    }

    const esPestanaRutas = RE_PESTANA_RUTAS.test(linea);
    const esPestanaOrdenes = RE_PESTANA_ORDENES.test(linea);
    if ((esPestanaRutas || esPestanaOrdenes) && i + 1 < limite) {
      const m = normalizar(lineas[i + 1]).match(RE_NUMERO_CON_ICONO);
      consumidas.add(i);
      if (m) {
        if (esPestanaRutas) contadorRutas = Number(m[1]);
        else contadorOrdenes = Number(m[1]);
        consumidas.add(i + 1);
      }
    }
  }

  /* --- tarjeta de resumen --- */
  const resumen = { entregado: 0, parcial: 0, noEntregado: 0 };
  let hay = false;
  const anotar = (etiqueta: string, cuantos: number) => {
    hay = true;
    if (etiqueta.startsWith("entrega ")) resumen.parcial = cuantos;
    else if (etiqueta.startsWith("no ")) resumen.noEntregado = cuantos;
    else resumen.entregado = cuantos;
  };

  const RE_ETIQUETAS = /(entrega\s+parcial|no\s+entregado|entregado)/g;

  /* Leído por filas: una línea con los rótulos y la siguiente con las cifras.
     Pasa cuando el lector recorre las tres tarjetas de izquierda a derecha. */
  for (let i = 0; i < limite - 1; i++) {
    if (consumidas.has(i)) continue;
    const linea = normalizar(lineas[i]);
    const etiquetas = [...linea.matchAll(RE_ETIQUETAS)].map((m) => m[1]);
    if (etiquetas.length < 2) continue;

    const cifras = [...normalizar(lineas[i + 1]).matchAll(/\d{1,3}/g)].map((m) => Number(m[0]));
    if (cifras.length < etiquetas.length) continue;

    etiquetas.forEach((e, k) => anotar(e, cifras[k]));
    consumidas.add(i);
    consumidas.add(i + 1);
  }

  /* Leído en dos bloques: los tres rótulos seguidos y después las tres
     cifras seguidas. Es como sale **la pantalla real**, y es la forma que no
     se había previsto: emparejar cada rótulo con la línea de debajo le daba a
     "No entregado" el 14 de "Entregado". De ahí salieron todos los pedidos
     pintados de rojo en días en que se entregó todo. */
  for (let i = 0; i < limite; i++) {
    if (consumidas.has(i)) continue;
    const rotulos: Array<{ linea: number; etiqueta: string }> = [];
    let j = i;
    while (j < limite && !consumidas.has(j)) {
      const l = normalizar(lineas[j]);
      if (!/^(entregado|entrega\s+parcial|no\s+entregado)$/.test(l)) break;
      rotulos.push({ linea: j, etiqueta: l });
      j++;
    }
    if (rotulos.length < 2) continue;

    const cifras: Array<{ linea: number; valor: number }> = [];
    let k = j;
    while (k < limite && cifras.length < rotulos.length && !consumidas.has(k)) {
      const m = normalizar(lineas[k]).match(RE_NUMERO_CON_ICONO);
      if (!m) break;
      cifras.push({ linea: k, valor: Number(m[1]) });
      k++;
    }
    if (cifras.length !== rotulos.length) continue;

    rotulos.forEach((r, n) => {
      anotar(r.etiqueta, cifras[n].valor);
      consumidas.add(r.linea);
      consumidas.add(cifras[n].linea);
    });
    break;
  }

  /* Leído por columnas: cada rótulo con su cifra justo debajo —o, en algunos
     teléfonos, justo encima—. Se reúnen primero los candidatos y luego se
     decide; consumir sobre la marcha se comía el estado de un pedido. */
  const candidatos: Array<{ linea: number; etiqueta: string }> = [];
  for (let i = 0; i < limite; i++) {
    if (consumidas.has(i)) continue;
    const linea = normalizar(lineas[i]);
    if (/^(entregado|entrega\s+parcial|no\s+entregado)$/.test(linea)) {
      candidatos.push({ linea: i, etiqueta: linea });
      continue;
    }
    const juntos = linea.match(
      /^(entregado|entrega\s+parcial|no\s+entregado)\s*:?\s*(?:[^\w\s]|[oaq@©])?\s*(\d{1,3})$/,
    );
    if (juntos) {
      anotar(juntos[1], Number(juntos[2]));
      consumidas.add(i);
    }
  }

  /* La cifra, ¿encima o debajo del rótulo? Se decide una vez para las tres
     tarjetas, y **mirando los extremos**, no el medio.

     En el medio no se puede saber: en «Entregado · 14 · Entrega parcial · 0»
     cada rótulo tiene una cifra a cada lado, y decidirlo rótulo a rótulo le
     daba a cada uno la del vecino. En los extremos sí: si las cifras van
     debajo, el último rótulo tiene la suya detrás; si van encima, el primero
     la tiene delante y detrás del último ya no queda ninguna. Ante la duda,
     debajo, que es como está la pantalla real. */
  const cifraDe = (i: number): number | null => {
    if (i < 0 || i >= limite || consumidas.has(i)) return null;
    const m = normalizar(lineas[i]).match(RE_NUMERO_CON_ICONO);
    return m ? Number(m[1]) : null;
  };
  const primera = candidatos[0]?.linea ?? -1;
  const ultima = candidatos.at(-1)?.linea ?? -1;
  const cifraEncima =
    primera >= 0 && cifraDe(primera - 1) !== null && cifraDe(ultima + 1) === null;

  const conCifra = candidatos.map((c) => {
    const vecino = cifraEncima ? c.linea - 1 : c.linea + 1;
    return { ...c, vecino, cifra: cifraDe(vecino) };
  });

  /* Una sola etiqueta suelta y sin cifra no es el resumen: es el estado de un
     pedido cuyo código el lector devolvió después. El resumen enseña siempre
     sus tres tarjetas. */
  const utiles = conCifra.filter((c) => c.cifra !== null);
  if (utiles.length >= 2 || (utiles.length === 1 && candidatos.length >= 2)) {
    for (const c of conCifra) {
      consumidas.add(c.linea);
      if (c.cifra !== null) {
        consumidas.add(c.vecino);
        anotar(c.etiqueta, c.cifra);
      }
    }
  }

  return { consumidas, contadorRutas, contadorOrdenes, resumen: hay ? resumen : null };
}

/* ---------------------------------------------------------------------------
 * El intérprete
 * ------------------------------------------------------------------------- */

/**
 * Lo que una captura le deja a la siguiente.
 *
 * Hace falta porque la lista de pedidos se fotografía haciendo scroll, y una
 * captura puede empezar a mitad de una ruta: sus primeros pedidos pertenecen
 * a la `Ruta N` que se vio al final de la captura anterior, y en esta no
 * aparece. Sin arrastrar ese dato, esos pedidos quedarían sin ruta.
 */
export interface ContextoEntreCapturas {
  /** Ruta bajo la que seguían los pedidos al terminar la captura anterior. */
  rutaAbierta: number | null;
  /** La captura anterior era una lista de pedidos agrupada por ruta. */
  agrupada: boolean;
}

const SIN_CONTEXTO: ContextoEntreCapturas = { rutaAbierta: null, agrupada: false };

/** Una captura suelta. Ver `interpretarConContexto` para una serie. */
export function interpretarCaptura(lineasCrudas: readonly string[]): ImagenExtraida {
  return interpretarConContexto(lineasCrudas).imagen;
}

/**
 * Convierte las líneas leídas de una captura en datos estructurados.
 *
 * Hay dos formas de pantalla de pedidos, y leer bien depende de distinguirlas:
 *
 *     Una tarjeta por pedido          Pedidos agrupados por ruta
 *     ─────────────────────           ──────────────────────────
 *     v12239582wofp-01                Ruta 4          ← una vez
 *     Ruta 4                          v12239582wofp-01
 *     Entregado                       Entregado
 *     v12239681wofp-01                v12239681wofp-01
 *     Ruta 4                          Entregado
 *     Entregado                       Ruta 5          ← cambia
 *                                     v12240224wofp-01
 *
 * En la agrupada, `Ruta 4` sale **una sola vez** y vale para todos los pedidos
 * que vienen debajo hasta la siguiente. Buscarla junto a cada pedido —que es lo
 * que se hacía— solo se la daba al primero de cada ruta: cada ruta salía con
 * un pedido y el resto quedaba sin asignar.
 *
 * Se distinguen por lo que viene **justo después** de cada `Ruta N`. En la
 * agrupada es una cabecera, así que la sigue un código. En la de tarjetas la
 * sigue el estado del pedido. Contar líneas no bastaba: una pantalla de
 * tarjetas con la última cortada también tiene menos `Ruta N` que códigos, y
 * se tomaba por agrupada.
 */
export function interpretarConContexto(
  lineasCrudas: readonly string[],
  previo: ContextoEntreCapturas = SIN_CONTEXTO,
): { imagen: ImagenExtraida; contexto: ContextoEntreCapturas } {
  // Una línea del lector puede traer varias líneas visuales dentro.
  const lineas = lineasCrudas
    .flatMap((l) => l.split(/\r?\n/))
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  const cabecera = lineasDeCabecera(lineas);
  const { consumidas, resumen } = cabecera;

  /* --- qué forma tiene la pantalla --- */
  let codigos = 0;
  let cabeceras = 0;
  let rutasDeTarjeta = 0;
  for (let i = 0; i < lineas.length; i++) {
    if (consumidas.has(i)) continue;
    if (hayCodigo(lineas[i])) codigos++;
    else if (RE_RUTA_DEL_PEDIDO.test(normalizar(lineas[i]))) {
      if (esCabeceraDeRuta(lineas, i, consumidas)) cabeceras++;
      else rutasDeTarjeta++;
    }
  }

  const agrupada =
    cabeceras + rutasDeTarjeta > 0
      ? cabeceras > 0 && cabeceras >= rutasDeTarjeta
      : // Ninguna `Ruta N` a la vista, pero la anterior era agrupada: es la
        // continuación por scroll de la misma ruta.
        previo.agrupada && codigos > 0;

  const orientacionRuta = orientacionDeLasTarjetas(lineas, consumidas);
  const orientacionEstado = orientacionDeLosEstados(lineas, consumidas);

  /* ¿El número del círculo va antes o después del horario de su tarjeta?

     Se decide una vez por captura, por lo que pasa con la primera. Hacerlo
     tarjeta a tarjeta —usar el de antes y, si falta, buscar el de después— era
     un error: cuando a una tarjeta no se le leía el número, se quedaba con el
     de la tarjeta siguiente y salían dos rutas con el mismo. */
  let primerNumero = -1;
  let primerHorario = -1;
  for (let i = 0; i < lineas.length; i++) {
    if (consumidas.has(i)) continue;
    const l = normalizar(lineas[i]);
    if (primerNumero === -1 && RE_NUMERO_SUELTO.test(l)) primerNumero = i;
    if (primerHorario === -1 && RE_HORARIO.test(l)) primerHorario = i;
  }
  const numeroAntesDelHorario = primerNumero !== -1 && primerNumero < primerHorario;

  let fecha: string | null = null;
  let contadorRutas: number | null = cabecera.contadorRutas;
  let contadorOrdenes: number | null = cabecera.contadorOrdenes;

  const rutas: RutaExtraida[] = [];
  const ordenes: OrdenExtraida[] = [];

  /* Dos números pendientes distintos, porque vienen de sitios distintos y no
     pueden mezclarse: el de una cabecera `Ruta 4` es seguro; el de un círculo
     suelto depende de la orientación de la captura. */
  let numeroDeCabecera: number | null = null;
  let numeroSuelto: number | null = null;
  let estadoPendiente: string | null = null;
  let rutaVigente: number | null = agrupada ? previo.rutaAbierta : null;

  for (let i = 0; i < lineas.length; i++) {
    if (consumidas.has(i)) continue;

    const cruda = lineas[i];
    const linea = normalizar(cruda);

    /* --- cabecera --- */
    const mFecha = linea.match(RE_FECHA);
    if (mFecha) {
      const [, d, m, a] = mFecha;
      fecha = `${a}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
      continue;
    }

    const mRutas = linea.match(RE_CONTADOR_RUTAS);
    if (mRutas) {
      contadorRutas = Number(mRutas[1]);
      continue;
    }

    const mOrdenes = linea.match(RE_CONTADOR_ORDENES);
    if (mOrdenes) {
      contadorOrdenes = Number(mOrdenes[1]);
      continue;
    }

    /* --- pedidos --- */
    const hallado = buscarCodigo(cruda);
    if (hallado) {
      const { codigo, digitos, sufijo } = hallado;

      /* En la pantalla real la etiqueta `Ruta 1` va en la misma fila que el
         código, a la derecha, y el lector a menudo los devuelve juntos. Se
         mira primero ahí: es la asociación más segura que hay. */
      const resto = normalizar(cruda.replace(hallado.texto, " "));
      const rutaEnLaLinea = resto.match(RE_RUTA_EN_LINEA);
      const estadoEnLaLinea = ESTADOS_EN_LINEA.find((e) => e.patron.test(resto))?.canonico ?? null;

      const estado = estadoEnLaLinea ?? buscarEstado(lineas, i, orientacionEstado, consumidas);
      const ruta = rutaEnLaLinea
        ? Number(rutaEnLaLinea[1])
        : agrupada
          ? rutaVigente
          : buscarRuta(lineas, i, orientacionRuta, consumidas);

      ordenes.push({
        codigo,
        ruta,
        estado: estado ?? "Entregado",
        /* Un código con un dígito de más o de menos se conserva, pero como
           dudoso: es un pedido leído a medias, no un pedido perdido. */
        legible_completo: ruta !== null && estado !== null && codigoCompleto(digitos, sufijo),
      });
      numeroDeCabecera = null;
      numeroSuelto = null;
      estadoPendiente = null;
      continue;
    }

    /* --- tarjeta de la pantalla de rutas: «1 Ruta • Finalizado» --- */
    const mNumeroYRuta = linea.match(RE_NUMERO_Y_RUTA);
    if (mNumeroYRuta) {
      numeroDeCabecera = Number(mNumeroYRuta[1]);
      continue;
    }

    /* --- cabecera de ruta --- */
    const mRuta = linea.match(RE_RUTA_DEL_PEDIDO);
    if (mRuta) {
      const n = Number(mRuta[1]);
      if (agrupada) rutaVigente = n;
      // Si la cabecera trae el horario detrás, esa ruta tiene número leído.
      numeroDeCabecera = n;
      const enLaMisma = linea.match(RE_HORARIO);
      if (!enLaMisma) continue;
    }

    /* --- rutas --- */
    const horario = leerHorario(linea);
    if (horario) {
      /* El número se toma de donde dice la orientación de esta captura, y de
         ningún otro sitio. Si no está, se numera por orden y se marca como
         deducido: ese número solo vale dentro de esta captura, y la fusión lo
         reconstruye con los de las rutas vecinas. */
      const numero =
        numeroDeCabecera ??
        (numeroAntesDelHorario ? numeroSuelto : numeroSiguiente(lineas, i, consumidas));
      const estado = estadoPendiente ?? estadoSiguiente(lineas, i);

      rutas.push({
        numero: numero ?? rutas.length + 1,
        estado: estado ?? "Finalizado",
        hora_inicio: horario[0],
        hora_fin: horario[1],
        legible_completo: true,
        numero_deducido: numero === null,
      });
      numeroDeCabecera = null;
      numeroSuelto = null;
      estadoPendiente = null;
      continue;
    }

    const estado = estadoDe(linea);
    if (estado) {
      estadoPendiente = estado;
      continue;
    }

    const mNumero = linea.match(RE_NUMERO_SUELTO);
    if (mNumero) {
      numeroSuelto = Number(mNumero[1]);
      continue;
    }
  }

  const tipo: ImagenExtraida["tipo_pantalla"] =
    ordenes.length > 0 || resumen !== null ? "ordenes" : rutas.length > 0 ? "rutas" : "desconocido";

  /* Se valida contra el mismo esquema de siempre, pero **sin lanzar**.

     Antes era `.parse`, que lanza si un solo dato no cuadra: una hora leída
     como 25:10, un círculo leído como "0". Y con esa excepción se perdía la
     captura entera —o, más arriba, la carga entera—. Ahora cada dato se
     sanea: una hora imposible se queda en blanco, un número de ruta imposible
     pasa a deducido. Se pierde el dato malo, no la captura. */
  const imagen = sanearYValidar({
    tipo_pantalla: tipo,
    fecha: fechaValida(fecha),
    contador_rutas: contadorRutas,
    contador_ordenes: contadorOrdenes,
    resumen_ordenes: resumen
      ? { entregado: resumen.entregado, parcial: resumen.parcial, no_entregado: resumen.noEntregado }
      : null,
    rutas: rutas.map((r, i) => ({
      ...r,
      hora_inicio: horaValida(r.hora_inicio),
      hora_fin: horaValida(r.hora_fin),
      ...(Number.isInteger(r.numero) && r.numero > 0
        ? {}
        : { numero: i + 1, numero_deducido: true }),
    })),
    ordenes: ordenes.map((o) => ({
      ...o,
      ruta: o.ruta !== null && Number.isInteger(o.ruta) && o.ruta > 0 ? o.ruta : null,
    })),
  });

  return {
    imagen,
    /* Una captura de rutas no pertenece a la lista de pedidos: la cadena pasa
       a través de ella intacta. Si se reiniciara, el pedido que abre la
       siguiente captura de pedidos perdería la ruta bajo la que venía. */
    contexto:
      tipo === "rutas"
        ? previo
        : { rutaAbierta: agrupada ? rutaVigente : null, agrupada },
  };
}

/**
 * ¿Esta línea `Ruta N` es la cabecera de un bloque de pedidos?
 *
 * Lo es si lo siguiente con sustancia es un código. Se saltan el horario y el
 * estado de la ruta ("Finalizado"), que pueden ir en la cabecera; cualquier
 * otra cosa —en particular el estado de un pedido— dice que no es cabecera
 * sino la ruta de una tarjeta.
 */
function esCabeceraDeRuta(
  lineas: readonly string[],
  desde: number,
  consumidas: ReadonlySet<number>,
): boolean {
  for (let i = desde + 1; i < Math.min(lineas.length, desde + 5); i++) {
    if (consumidas.has(i)) continue;
    if (hayCodigo(lineas[i])) return true;
    const linea = normalizar(lineas[i]);
    if (RE_HORARIO.test(linea)) continue;
    const estado = estadoDe(linea);
    if (estado && !ESTADOS_DE_PEDIDO.has(estado)) continue;
    return false;
  }
  return false;
}

/**
 * En una pantalla de una tarjeta por pedido, ¿la línea `Ruta N` va antes o
 * después del código?
 *
 *     código → Ruta N      (se busca hacia **adelante**)
 *     Ruta N → código      (se busca hacia **atrás**)
 *
 * Buscar en las dos direcciones a la vez parece más robusto y es justo lo
 * contrario: cada pedido acabaría robando la ruta de su vecino, y el error
 * sería invisible porque el resultado parece plausible. Se decide una vez por
 * captura, por lo que pasa con la primera tarjeta.
 */
function orientacionDeLasTarjetas(
  lineas: readonly string[],
  consumidas: ReadonlySet<number>,
): "adelante" | "atras" {
  let primerCodigo = -1;
  let primeraRuta = -1;

  for (let i = 0; i < lineas.length; i++) {
    if (consumidas.has(i)) continue;
    if (primerCodigo === -1 && hayCodigo(lineas[i])) primerCodigo = i;
    if (primeraRuta === -1 && RE_RUTA_DEL_PEDIDO.test(normalizar(lineas[i]))) primeraRuta = i;
    if (primerCodigo !== -1 && primeraRuta !== -1) break;
  }

  if (primerCodigo === -1 || primeraRuta === -1) return "adelante";
  return primeraRuta < primerCodigo ? "atras" : "adelante";
}

/**
 * ¿El estado de cada pedido va antes o después de su código?
 *
 * Se decide **aparte** de la ruta, y no es un detalle: en la lista agrupada la
 * cabecera `Ruta 4` va antes de los códigos pero los estados van después, así
 * que usar la misma orientación para las dos cosas desplazaba todos los
 * estados un puesto.
 *
 * Por el medio de la lista no se puede saber —«código, estado, código,
 * estado» se ve igual desde cualquier pedido del centro—, así que se mira en
 * los bordes: si sobran estados antes del primer código o después del último.
 * Ante la duda, hacia adelante, que es el orden de lectura.
 */
function orientacionDeLosEstados(
  lineas: readonly string[],
  consumidas: ReadonlySet<number>,
): "adelante" | "atras" {
  let primerCodigo = -1;
  let ultimoCodigo = -1;
  for (let i = 0; i < lineas.length; i++) {
    if (consumidas.has(i) || !hayCodigo(lineas[i])) continue;
    if (primerCodigo === -1) primerCodigo = i;
    ultimoCodigo = i;
  }
  if (primerCodigo === -1) return "adelante";

  const esEstadoDePedido = (i: number) =>
    !consumidas.has(i) && ESTADOS_DE_PEDIDO.has(estadoDe(normalizar(lineas[i])) ?? "");

  let antes = 0;
  for (let i = primerCodigo - 1; i >= Math.max(0, primerCodigo - 3); i--) {
    if (esEstadoDePedido(i)) antes++;
  }
  let despues = 0;
  for (let i = ultimoCodigo + 1; i <= Math.min(lineas.length - 1, ultimoCodigo + 3); i++) {
    if (esEstadoDePedido(i)) despues++;
  }

  return antes > despues ? "atras" : "adelante";
}

/**
 * Recorre desde un código en una dirección hasta el código vecino, que es
 * donde empieza la tarjeta de al lado. Ese tope es lo que impide que un pedido
 * con la tarjeta cortada se quede con los datos del de al lado.
 */
function recorrerTarjeta(
  lineas: readonly string[],
  desde: number,
  orientacion: "adelante" | "atras",
  consumidas: ReadonlySet<number>,
  buscar: (linea: string) => boolean,
): void {
  const paso = orientacion === "adelante" ? 1 : -1;
  for (let i = desde + paso; i >= 0 && i < lineas.length; i += paso) {
    if (consumidas.has(i)) continue;
    if (hayCodigo(lineas[i])) return;
    if (buscar(normalizar(lineas[i]))) return;
  }
}

function buscarEstado(
  lineas: readonly string[],
  desde: number,
  orientacion: "adelante" | "atras",
  consumidas: ReadonlySet<number>,
): string | null {
  let encontrado: string | null = null;
  recorrerTarjeta(lineas, desde, orientacion, consumidas, (linea) => {
    const estado = estadoDe(linea);
    if (estado && ESTADOS_DE_PEDIDO.has(estado)) encontrado = estado;
    return encontrado !== null;
  });
  return encontrado;
}

function buscarRuta(
  lineas: readonly string[],
  desde: number,
  orientacion: "adelante" | "atras",
  consumidas: ReadonlySet<number>,
): number | null {
  let encontrada: number | null = null;
  recorrerTarjeta(lineas, desde, orientacion, consumidas, (linea) => {
    const m = linea.match(RE_RUTA_DEL_PEDIDO);
    if (m) encontrada = Number(m[1]);
    return encontrada !== null;
  });
  return encontrada;
}

/** El número suelto que va justo detrás del horario, sin pasar al de otra tarjeta. */
function numeroSiguiente(
  lineas: readonly string[],
  desde: number,
  consumidas: ReadonlySet<number>,
): number | null {
  for (let i = desde + 1; i < Math.min(lineas.length, desde + 4); i++) {
    if (consumidas.has(i)) continue;
    const linea = normalizar(lineas[i]);
    if (RE_HORARIO.test(linea)) return null;
    const m = linea.match(RE_NUMERO_SUELTO);
    if (m) return Number(m[1]);
  }
  return null;
}

/** Lo mismo para el estado de la ruta. */
function estadoSiguiente(lineas: readonly string[], desde: number): string | null {
  for (let i = desde + 1; i < Math.min(lineas.length, desde + 4); i++) {
    const linea = normalizar(lineas[i]);
    if (RE_HORARIO.test(linea)) return null;
    const estado = estadoDe(linea);
    if (estado) return estado;
  }
  return null;
}

/** Una hora de reloj de verdad, o null. `25:10` y `09:61` no lo son. */
function horaValida(hora: string | null | undefined): string | null {
  return hora && /^([01]\d|2[0-3]):[0-5]\d$/.test(hora) ? hora : null;
}

/** Una fecha de calendario que existe, o null. El 31/02 no existe. */
function fechaValida(fecha: string | null): string | null {
  if (!fecha) return null;
  const [a, m, d] = fecha.split("-").map(Number);
  const real = new Date(Date.UTC(a, m - 1, d));
  return real.getUTCFullYear() === a && real.getUTCMonth() === m - 1 && real.getUTCDate() === d
    ? fecha
    : null;
}

/**
 * Valida sin lanzar nunca.
 *
 * Si el conjunto no pasa, se prueba dato a dato y se quedan los que pasan. Si
 * ni así, la captura se da por desconocida —se cuenta como no leída— en lugar
 * de reventar la carga.
 */
function sanearYValidar(crudo: unknown): ImagenExtraida {
  const entero = esquemaImagenExtraida.safeParse(crudo);
  if (entero.success) return entero.data;

  const c = crudo as Record<string, unknown>;
  const rutas = Array.isArray(c.rutas)
    ? c.rutas.flatMap((r) => {
        const v = esquemaRutaExtraida.safeParse(r);
        return v.success ? [v.data] : [];
      })
    : [];
  const ordenes = Array.isArray(c.ordenes)
    ? c.ordenes.flatMap((o) => {
        const v = esquemaOrdenExtraida.safeParse(o);
        return v.success ? [v.data] : [];
      })
    : [];

  const parcial = esquemaImagenExtraida.safeParse({ ...c, rutas, ordenes });
  if (parcial.success) return parcial.data;

  return esquemaImagenExtraida.parse({
    tipo_pantalla: "desconocido",
    fecha: null,
    contador_rutas: null,
    contador_ordenes: null,
    resumen_ordenes: null,
    rutas: [],
    ordenes: [],
  });
}

/** `9:03` → `09:03`. El esquema exige dos dígitos en la hora. */
function normalizarHora(hora: string): string {
  const [h, m] = hora.split(":");
  return `${h.padStart(2, "0")}:${m}`;
}
