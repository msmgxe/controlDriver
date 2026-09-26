/**
 * De las líneas de texto de una foto a los datos de una comanda.
 *
 * La «comanda» que acompaña a cada pedido es la **hoja de despacho** de Wong:
 *
 *     Hoja de despacho Nº 12264655
 *     Nombre del Cliente:            Claudia Castro
 *     Dirección de Despacho:         Ca. Santa Carmela 182,
 *     Distrito:                      SANTIAGO DE SURCO (CP 150140), LIMA,
 *     Persona Autorizada para Recibir:  Lima
 *                                    LIMA               Teléfono: …
 *                                    Claudia Castro
 *
 * Lo importante es la disposición: las etiquetas van a la izquierda, **vacías**,
 * y los valores van todos en una columna a la derecha, alineados a su borde
 * izquierdo. Encima de esa columna hay un sello («FACTURADO», con la fecha) y
 * debajo, la etiqueta pegada de «DESPACHO» con letra a mano. Nada de eso es
 * texto que se pueda leer con fiabilidad, así que se ignora: los datos se sacan
 * de la columna de la derecha.
 *
 * El número de despacho **es** parte del código del pedido: `12264655` →
 * `v12264655wofp-01`. Con él se reconoce el pedido que ya estaba cargado.
 *
 * Qué se sabe de la disposición se usa solo si el lector dio posiciones; sin
 * ellas se sigue el orden del texto, que en estas hojas también sirve: el
 * nombre, la dirección y el resto vienen en fila.
 *
 * Dos cosas que este intérprete **no** hace: inventar un dato que no leyó, y
 * decidir por la persona. Lo que no se ve con claridad sale con una confianza
 * baja —o vacío— para que la pantalla lo marque y se revise.
 */

/** Una línea de texto tal como la devuelve el lector, con dónde está. */
export interface LineaLeida {
  texto: string;
  /** Posición y tamaño en píxeles. Todo en 0 si el lector no las dio. */
  x: number;
  y: number;
  w: number;
  h: number;
  /** Cuánto se fía el lector de esta línea, de 0 a 1; null si no lo dice. */
  confianza: number | null;
}

export interface CampoDeComanda {
  valor: string | null;
  /** De 0 a 1. Cero si no se leyó. */
  confianza: number;
}

export interface ComandaLeida {
  /** El número de despacho: 8 dígitos, la parte del medio del código del pedido. */
  numero: CampoDeComanda;
  nombre: CampoDeComanda;
  /** La dirección completa, tal como salió (con distrito y código postal). */
  direccion: CampoDeComanda;
  /** La calle y el número, sin distrito ni código postal. */
  calle: string | null;
  distrito: string | null;
  telefono: CampoDeComanda;
  /** La fecha de la hoja, `AAAA-MM-DD`. Solo una pista: el sello sale borroso. */
  fecha: CampoDeComanda;
  /** Lo que se le pide a un buscador de direcciones, o null si no hay calle. */
  consultaDeMapa: string | null;
  /**
   * La franja de la foto (en píxeles, de arriba abajo) que ocupa esta hoja,
   * cuando en la misma foto hay más de una. Sirve para recortar cada hoja como
   * su propia evidencia. `null` si la foto trae una sola.
   */
  franja: { desde: number; hasta: number } | null;
}

/* ---------------------------------------------------------------------------
 * Reconocer líneas
 * ------------------------------------------------------------------------- */

const MESES: Record<string, number> = {
  ENE: 1, FEB: 2, MAR: 3, ABR: 4, MAY: 5, JUN: 6, JUL: 7, AGO: 8, SEP: 9, SET: 9, OCT: 10, NOV: 11, DIC: 12,
};

/** Un número de despacho, con las confusiones típicas de la lectura corregidas. */
const RE_TITULO = /d?espacho\s*N\S{0,2}\s*([0-9OolIiSB]{8})\b/i;
const RE_TITULO_FLOJO = /d?espacho\D{0,10}(\d{8})/i;
const RE_SOLO_NUMERO = /^\s*(1[0-9]\d{6})\s*$/;

/** Etiquetas del formulario: van a la izquierda y nunca son un dato. */
const RE_ETIQUETA =
  /nombre\s+del\s+cliente|direcci[oó]n\s+de\s+despacho|persona\s+autorizada|recibir\s*:|^\s*distrito\s*:?\s*$|^\s*(?:l?iente|despacho|cliente)\s*:\s*$|tel[eé]f/i;

/** El sello de «FACTURADO» y lo que lleva dentro. */
const RE_SELLO =
  /factur|wong\s*on|cencosud|retail|per[uú]\s*s\.?\s*a|t-?\s?115\b|^[x×\s]+$|\b20\d\d\b.*\bsep|\bsep\.?\s*20\d\d/i;

/** Con qué empieza una dirección de Lima. */
const RE_VIA =
  /^\s*(?:av\.?|avenida|jr\.?|jir[oó]n|ca\.?|calle|psje\.?|pasaje|pje\.?|urb\.?|urbanizaci[oó]n|mz\.?|manzana|alameda|prol\.?|prolongaci[oó]n|carretera|malec[oó]n|plaza|óvalo|ovalo|sector|asoc\.?)\b/i;

const RE_CP = /\bCP\b|\(\s*CP|\b15\d{4}\b/i;

/** Cifras que el lector confunde con letras cuando quería un dígito. */
function aDigitos(t: string): string {
  return t.replace(/[Oo]/g, "0").replace(/[lIi]/g, "1").replace(/S/g, "5").replace(/B/g, "8");
}

const normalizar = (t: string): string => t.replace(/\s+/g, " ").trim();

/* ---------------------------------------------------------------------------
 * Confianza
 * ------------------------------------------------------------------------- */

/**
 * De cuánto se fía el lector de un grupo de líneas: la peor de ellas.
 *
 * Si el lector no da confianza —o la da en cero para todo, que es como lo dicen
 * algunos Android cuando no la calculan— se devuelve `null`, y la confianza del
 * campo la decide solo su forma.
 */
function confianzaDe(lineas: readonly LineaLeida[]): number | null {
  const dadas = lineas.map((l) => l.confianza).filter((c): c is number => c !== null && c > 0);
  return dadas.length === 0 ? null : Math.min(...dadas);
}

/** Sin confianza del lector, se parte de un «bastante segura» que la forma del dato confirma o baja. */
const SIN_DATO_DEL_LECTOR = 0.85;

const campo = (valor: string | null, base: number | null, forma: number): CampoDeComanda =>
  valor === null
    ? { valor: null, confianza: 0 }
    : { valor, confianza: Math.max(0, Math.min(1, (base ?? SIN_DATO_DEL_LECTOR) * forma)) };

/* ---------------------------------------------------------------------------
 * Datos sueltos
 * ------------------------------------------------------------------------- */

/** ¿Parece el nombre de una persona? Letras y espacios, de una a cinco palabras. */
function parecerNombre(t: string): boolean {
  const l = normalizar(t);
  if (l.length < 2 || l.length > 40) return false;
  if (/\d/.test(l)) return false;
  if (RE_ETIQUETA.test(l) || RE_SELLO.test(l) || RE_VIA.test(l) || RE_TITULO_FLOJO.test(l)) return false;
  if (/^(lima|callao)$/i.test(l)) return false;
  const palabras = l.split(" ");
  return palabras.length <= 5 && palabras.every((p) => /^[A-Za-zÁÉÍÓÚÜÑáéíóúüñ'’.-]+$/.test(p));
}

/** Un teléfono de Lima: nueve dígitos que empiezan por 9, con o sin +51. */
function buscarTelefono(textos: readonly string[]): string | null {
  for (const t of textos) {
    const m = /(?<!\d)(?:\+?\s*51[\s-]*)?(9\d{2})[\s-]?(\d{3})[\s-]?(\d{3})(?!\d)/.exec(t);
    if (m) return `${m[1]} ${m[2]} ${m[3]}`;
  }
  return null;
}

/** `24-09-26` o un sello con `24 SEP. 2026`. */
function buscarFecha(textos: readonly string[]): { fecha: string; delSello: boolean } | null {
  for (const t of textos) {
    const m = /^\s*(\d{2})-(\d{2})-(\d{2})\s*$/.exec(t);
    if (m) return { fecha: `20${m[3]}-${m[2]}-${m[1]}`, delSello: false };
  }
  for (const t of textos) {
    const m = /(\d{1,2})\s*[.\-]?\s*(ENE|FEB|MAR|ABR|MAY|JUN|JUL|AGO|SEP|SET|OCT|NOV|DIC)[A-Z]*\.?\s*(20\d{2})/i.exec(t);
    if (m) {
      const mes = MESES[m[2].toUpperCase()];
      return { fecha: `${m[3]}-${String(mes).padStart(2, "0")}-${m[1].padStart(2, "0")}`, delSello: true };
    }
  }
  return null;
}

/**
 * Separa «Ca. Santa Carmela 182, SANTIAGO DE SURCO (CP 150140), LIMA, Lima» en
 * la calle y el distrito.
 */
export function partirDireccion(completa: string): { calle: string | null; distrito: string | null } {
  let t = normalizar(completa)
    .replace(/\(?\s*CP\s*\d{5,6}\s*\)?/gi, " ")
    .replace(/\b15\d{4}\)/g, " ");
  // «, Lima, Lima» al final: la provincia y el departamento, que no aportan.
  t = t.replace(/(?:[\s,]*\blima\b)+[\s,.]*$/i, "");
  t = normalizar(t).replace(/[\s,]+$/, "");
  if (!t) return { calle: null, distrito: null };

  const coma = t.lastIndexOf(",");
  if (coma > 0) {
    const calle = normalizar(t.slice(0, coma));
    const distrito = normalizar(t.slice(coma + 1));
    // Si lo de después de la última coma trae números, no es un distrito: es
    // parte de la calle («Jr. Uno 12, Dpto 4»).
    if (distrito && !/\d/.test(distrito)) return { calle, distrito };
  }
  return { calle: t, distrito: null };
}

/** Lo que entiende un buscador de direcciones: la calle sin «Dpto 4C», y el distrito. */
export function consultaParaMapa(calle: string | null, distrito: string | null): string | null {
  if (!calle) return null;
  const limpia = calle
    .replace(/\b(?:dpto|depto|dep|int|interior|piso|of|ofic|oficina|lote|lt|mz)\.?\s*[\w-]+/gi, " ")
    .replace(/\s+,/g, ",");
  return [normalizar(limpia).replace(/[\s,]+$/, ""), distrito, "Lima", "Perú"].filter(Boolean).join(", ");
}

/* ---------------------------------------------------------------------------
 * Una hoja
 * ------------------------------------------------------------------------- */

interface Contexto {
  ancho: number;
  /** El lector dio posiciones. */
  conCajas: boolean;
}

function interpretarHoja(lineas: readonly LineaLeida[], ctx: Contexto, numeroDelTitulo: string | null): ComandaLeida {
  const ordenadas = ctx.conCajas
    ? [...lineas].sort((a, b) => a.y - b.y || a.x - b.x)
    : [...lineas];
  const titulo = ordenadas.findIndex((l) => RE_TITULO.test(l.texto) || RE_TITULO_FLOJO.test(l.texto));
  const despues = ordenadas.slice(titulo >= 0 ? titulo + 1 : 0);

  /* La primera línea que abre una dirección. En la columna de la derecha, si se
     sabe dónde está cada cosa: las etiquetas de la izquierda nunca la abren,
     pero la calle de una sola palabra podría confundirse con un sello. */
  const abre = (l: LineaLeida) => RE_VIA.test(l.texto) && !RE_ETIQUETA.test(l.texto);
  let inicio = despues.findIndex((l) => abre(l) && (!ctx.conCajas || l.x >= ctx.ancho * 0.35));
  if (inicio < 0) inicio = despues.findIndex(abre);

  let columna: LineaLeida[] = despues;
  if (inicio >= 0 && ctx.conCajas) {
    const izquierda = despues[inicio].x;
    const margen = Math.max(40, ctx.ancho * 0.05);
    columna = despues.filter((l) => Math.abs(l.x - izquierda) <= margen);
    inicio = columna.indexOf(despues[inicio]);
  }

  /* El nombre: lo que hay justo encima de la calle. Puede ir partido en dos
     líneas —«Elsa Patricia» / «Tizon»—, así que se sube mientras lo que haya
     parezca parte de un nombre. */
  const nombreLineas: LineaLeida[] = [];
  if (inicio > 0) {
    for (let i = inicio - 1; i >= 0 && nombreLineas.length < 3; i--) {
      if (!parecerNombre(columna[i].texto)) break;
      nombreLineas.unshift(columna[i]);
    }
  }
  const nombreTexto = nombreLineas.length ? normalizar(nombreLineas.map((l) => l.texto).join(" ")) : null;

  /* La dirección: desde la calle hasta la línea que cierra con «Lima» después
     del código postal. Esa es la marca de que la dirección terminó; lo que
     sigue —«LIMA» otra vez, el teléfono, el nombre repetido— ya no es suyo. */
  const direccionLineas: LineaLeida[] = [];
  if (inicio >= 0) {
    let vistoCP = false;
    for (let j = inicio; j < columna.length && direccionLineas.length < 6; j++) {
      const t = columna[j].texto;
      // Sin código postal, «LIMA» a secas ya es el distrito repetido, no la calle.
      if (direccionLineas.length > 0 && !vistoCP && /^\s*lima[\s,.]*$/i.test(t)) break;
      if (direccionLineas.length > 0 && (RE_ETIQUETA.test(t) || /^\s*\d{2}-\d{2}-\d{2}\s*$/.test(t) || /entrega\s+a\s+domicilio|^\d{3}T\d{3}/i.test(t))) break;
      direccionLineas.push(columna[j]);
      if (RE_CP.test(t)) vistoCP = true;
      if (vistoCP && /\blima\b[\s,.]*$/i.test(t)) break;
    }
  }
  const direccionTexto = direccionLineas.length
    ? normalizar(direccionLineas.map((l) => l.texto).join(" ")).replace(/\s+,/g, ",").replace(/\(\s+/g, "(")
    : null;
  const { calle, distrito } = direccionTexto ? partirDireccion(direccionTexto) : { calle: null, distrito: null };

  /* El teléfono y la fecha se buscan en toda la hoja: el teléfono va a la
     derecha de «LIMA», más lejos que la columna; y la fecha, en la columna o
     en el sello. */
  const textosHoja = ordenadas.map((l) => l.texto);
  const telefono = buscarTelefono(textosHoja);
  const lineaTelefono = telefono ? ordenadas.find((l) => buscarTelefono([l.texto]) === telefono) : undefined;
  const fecha = buscarFecha(textosHoja);
  const lineaFecha = fecha ? ordenadas.find((l) => buscarFecha([l.texto])?.fecha === fecha.fecha) : undefined;

  /* La forma del dato confirma —o baja— lo que el lector dijo de él. */
  const formaDireccion = (calle && /\d/.test(calle) ? 1 : 0.7) * (distrito ? 1 : 0.85) * (direccionLineas.length ? 1 : 0);
  const numero = numeroDelTitulo;
  const lineaTitulo = titulo >= 0 ? ordenadas[titulo] : undefined;

  return {
    numero: campo(numero, lineaTitulo ? confianzaDe([lineaTitulo]) : null, /^\d{8}$/.test(numero ?? "") ? 1 : 0.4),
    nombre: campo(nombreTexto, nombreLineas.length ? confianzaDe(nombreLineas) : null, nombreTexto && nombreLineas.length === 1 && nombreTexto.split(" ").length < 2 ? 0.7 : 1),
    direccion: campo(direccionTexto, confianzaDe(direccionLineas), formaDireccion),
    calle,
    distrito,
    telefono: campo(telefono, lineaTelefono ? confianzaDe([lineaTelefono]) : null, 1),
    fecha: campo(fecha?.fecha ?? null, lineaFecha ? confianzaDe([lineaFecha]) : null, fecha?.delSello ? 0.6 : 1),
    consultaDeMapa: consultaParaMapa(calle, distrito),
    franja: null,
  };
}

/** El número del título de una línea, con las letras confundidas con dígitos corregidas. */
function numeroDeTitulo(l: LineaLeida): string | null {
  const m = RE_TITULO.exec(l.texto);
  if (m) {
    const n = aDigitos(m[1]);
    return /^\d{8}$/.test(n) ? n : null;
  }
  const flojo = RE_TITULO_FLOJO.exec(l.texto);
  return flojo ? flojo[1] : null;
}

/* ---------------------------------------------------------------------------
 * Una foto, con una o más hojas
 * ------------------------------------------------------------------------- */

/**
 * Las comandas que hay en una foto.
 *
 * Una foto suele traer una, pero se ha visto con dos hojas una debajo de la
 * otra —cada una con su «Hoja de despacho Nº»—. Se parte por esos títulos y
 * cada hoja se lee por separado. Si no hay ningún título, se intenta la foto
 * entera como una sola hoja: puede que el número se haya leído mal, y aun así
 * el nombre y la dirección sirven.
 *
 * Devuelve **siempre al menos una**, aunque venga vacía: la pantalla tiene que
 * poder decir «esta foto no se pudo leer» y ofrecer volver a tomarla.
 */
export function interpretarComandas(
  lineas: readonly LineaLeida[],
  tamano: { ancho: number; alto: number },
): ComandaLeida[] {
  const utiles = lineas.filter((l) => normalizar(l.texto) !== "");
  const conCajas = utiles.length > 0 && utiles.filter((l) => l.w > 0 && l.h > 0).length >= utiles.length * 0.8;
  const ctx: Contexto = { ancho: tamano.ancho, conCajas };
  const ordenadas = conCajas ? [...utiles].sort((a, b) => a.y - b.y || a.x - b.x) : [...utiles];

  /* Dónde empieza cada hoja. Un número de 8 cifras suelto, justo al lado de
     «despacho», también cuenta: a veces el lector separa el número en grande. */
  const titulos: Array<{ indice: number; numero: string | null }> = [];
  ordenadas.forEach((l, i) => {
    const n = numeroDeTitulo(l);
    if (n !== null || RE_TITULO_FLOJO.test(l.texto) || /d?espacho\s*N\S{0,2}\s*$/i.test(l.texto)) {
      titulos.push({ indice: i, numero: n });
    }
  });
  for (const t of titulos) {
    if (t.numero !== null) continue;
    const vecino = ordenadas.find((l, i) => {
      if (i === t.indice || !RE_SOLO_NUMERO.test(l.texto)) return false;
      return !conCajas || Math.abs(l.y - ordenadas[t.indice].y) <= ordenadas[t.indice].h * 1.5;
    });
    if (vecino) t.numero = RE_SOLO_NUMERO.exec(vecino.texto)![1];
  }

  if (titulos.length === 0) {
    const suelto = ordenadas.map((l) => RE_SOLO_NUMERO.exec(l.texto)?.[1]).find(Boolean) ?? null;
    return [interpretarHoja(ordenadas, ctx, suelto)];
  }

  return titulos.map((t, k) => {
    const siguiente = titulos[k + 1];
    let hoja: LineaLeida[];
    if (conCajas) {
      const tituloL = ordenadas[t.indice];
      const desde = tituloL.y - tituloL.h * 0.6;
      const hasta = siguiente ? ordenadas[siguiente.indice].y - ordenadas[siguiente.indice].h * 0.6 : Infinity;
      hoja = ordenadas.filter((l) => l.y >= desde && l.y < hasta);
    } else {
      hoja = ordenadas.slice(t.indice, siguiente ? siguiente.indice : undefined);
    }
    const leida = interpretarHoja(hoja, ctx, t.numero);
    if (conCajas && titulos.length > 1) {
      const tituloL = ordenadas[t.indice];
      leida.franja = {
        desde: Math.max(0, Math.round(tituloL.y - tituloL.h * 0.6)),
        hasta: siguiente ? Math.round(ordenadas[siguiente.indice].y - ordenadas[siguiente.indice].h * 0.6) : tamano.alto,
      };
    }
    return leida;
  });
}

/** El código de pedido que corresponde a un número de despacho, para el primer bulto. */
export const codigoDeDespacho = (numero: string, bulto = 1): string =>
  `v${numero}wofp-${String(bulto).padStart(2, "0")}`;
