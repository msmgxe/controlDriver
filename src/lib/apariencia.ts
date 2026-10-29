/**
 * Qué cara tiene la app, y cómo se elige.
 *
 * Salen de las cuatro propuestas de diseño (`prototipo/propuestas-diseno.html`)
 * más dos temas añadidos después. Dos son pareja **claro/oscuro** y siguen al
 * teléfono si no se elige nada:
 *
 *   · `claro`  → propuesta D, «Mapa»;
 *   · `oscuro` → propuesta B, «Asfalto».
 *
 * Los otros cuatro son **temas propios**, que solo se activan a mano —no
 * tienen media query que los dispare, uno elige el que más le gusta y se
 * queda—:
 *
 *   · `turbo`   → propuesta A: violeta, mostaza y bordes gruesos;
 *   · `menta`   → propuesta C: la continuación del verde de siempre;
 *   · `arcilla` → terracota y beige, cálido y de papel;
 *   · `avispa`  → fondo blanco, amarillo y negro de alto contraste.
 *
 * `auto` sigue eligiendo entre claro y oscuro según el teléfono: es una
 * elección tan explícita como cualquier tema propio, y una vez elegida no
 * cambia sola con la hora del día. Pero **nadie la elige sin querer**: hasta
 * que alguien toca algo en Ajustes, la cara de fábrica es `claro` —Mapa—, no
 * «lo que decida el teléfono».
 *
 * Lo elegido se guarda en `localStorage` y no en la base, a propósito: hace
 * falta **antes de pintar**, y la base responde después. Un script mínimo en
 * la cabecera (`SCRIPT_INICIAL`) lo lee y pone `data-modo` en `<html>` antes
 * de que aparezca nada; sin eso, quien eligió un tema vería un fogonazo del
 * tema equivocado cada vez que abre la app.
 *
 * Si `localStorage` no está —modo privado, datos borrados— se cae a `claro`,
 * igual que en una instalación nueva. El tema es una comodidad, y perder la
 * preferencia no puede romper nada.
 */

/** Una cara completa de la app: colores, tipografía y forma. */
type Tema = "claro" | "oscuro" | "turbo" | "menta" | "arcilla" | "avispa";
/** Lo que el repartidor eligió: un tema fijo, o que la app decida sola. */
export type Preferencia = "auto" | Tema;
/** Lo que termina puesto en pantalla: siempre uno de los seis temas. */
export type Modo = Tema;

export const CLAVE_APARIENCIA = "rutas-a.apariencia";
/** Los ajustes de letra y controles, en un solo JSON. */
export const CLAVE_VISUAL = "rutas-a.visual";

const TEMAS: readonly Tema[] = ["claro", "oscuro", "turbo", "menta", "arcilla", "avispa"];
const PREFERENCIAS: readonly Preferencia[] = ["auto", ...TEMAS];

export function esPreferencia(v: unknown): v is Preferencia {
  return typeof v === "string" && (PREFERENCIAS as readonly string[]).includes(v);
}

/** Lo que el repartidor eligió, o `claro` —la de fábrica— si no eligió nada o no se puede leer. */
export function leerPreferencia(): Preferencia {
  try {
    const guardada = localStorage.getItem(CLAVE_APARIENCIA);
    return esPreferencia(guardada) ? guardada : "claro";
  } catch {
    return "claro";
  }
}

/** ¿El teléfono está en modo oscuro ahora mismo? */
function sistemaEsOscuro(): boolean {
  try {
    return window.matchMedia("(prefers-color-scheme: dark)").matches;
  } catch {
    return false;
  }
}

/**
 * La preferencia, ya resuelta a uno de los seis temas.
 *
 * Solo `auto` mira el teléfono. Turbo, menta, arcilla y avispa son
 * elecciones fijas: quien los eligió los quiere ver siempre, de día o de
 * noche.
 */
export function modoDe(preferencia: Preferencia, sistemaOscuro = sistemaEsOscuro()): Modo {
  if (preferencia === "auto") return sistemaOscuro ? "oscuro" : "claro";
  return preferencia;
}

/** Pone la cara en la página. */
export function aplicarModo(modo: Modo): void {
  document.documentElement.dataset.modo = modo;
}

/** Guarda la preferencia y la aplica al instante. */
export function elegirPreferencia(preferencia: Preferencia): void {
  try {
    localStorage.setItem(CLAVE_APARIENCIA, preferencia);
  } catch {
    /* Sin dónde guardarla, al menos vale para esta sesión. */
  }
  aplicarModo(modoDe(preferencia));
}

/**
 * El script que corre antes que nada, escrito como texto.
 *
 * Es autónomo a propósito —no puede importar nada— y por eso repite en unas
 * líneas lo que arriba hacen las funciones. Cualquier cambio aquí tiene que
 * hacerse en los dos sitios; la prueba de `apariencia.test.ts` lo comprueba.
 */
export const SCRIPT_INICIAL = `(function(){var TEMAS=['claro','oscuro','turbo','menta','arcilla','avispa'];var d=document.documentElement;var m='claro';try{var p=localStorage.getItem('${CLAVE_APARIENCIA}');if(p==='auto')m=matchMedia('(prefers-color-scheme: dark)').matches?'oscuro':'claro';else if(TEMAS.indexOf(p)!==-1)m=p}catch(e){}d.dataset.modo=m;var v={};try{v=JSON.parse(localStorage.getItem('${CLAVE_VISUAL}')||'{}')||{}}catch(e){}var D={letra:'tema',tamano:'normal',botones:'relieve',toques:'comodo',anim:'completa'};var O={letra:['tema','redondeada','clasica','moderna','condensada','amigable','legible'],tamano:['normal','grande','muy-grande'],botones:['relieve','plano'],toques:['comodo','compacto'],anim:['completa','reducida']};for(var k in D){d.dataset[k]=(O[k].indexOf(v[k])!==-1)?v[k]:D[k]}})();`;


/* ---------------------------------------------------------------------------
 * Letra y controles (v2.0)
 *
 * Aparte de la cara (colores), cada persona elige cómo se lee y cómo se toca:
 * el tipo de letra, su tamaño, si los botones llevan relieve, cuánto miden los
 * toques y si hay animaciones. Se guardan juntos y se ponen como atributos
 * `data-*` en <html>; `globals.css` hace el resto.
 * ------------------------------------------------------------------------- */

export const OPCIONES_VISUALES = {
  letra: ["tema", "redondeada", "clasica", "moderna", "condensada", "amigable", "legible"],
  tamano: ["normal", "grande", "muy-grande"],
  botones: ["relieve", "plano"],
  toques: ["comodo", "compacto"],
  anim: ["completa", "reducida"],
} as const;

export type Letra = (typeof OPCIONES_VISUALES.letra)[number];
export type Tamano = (typeof OPCIONES_VISUALES.tamano)[number];
export type Botones = (typeof OPCIONES_VISUALES.botones)[number];
export type Toques = (typeof OPCIONES_VISUALES.toques)[number];
export type Anim = (typeof OPCIONES_VISUALES.anim)[number];

export interface Visual {
  letra: Letra;
  tamano: Tamano;
  botones: Botones;
  toques: Toques;
  anim: Anim;
}

/** Lo de fábrica: la letra de cada cara, tamaño normal, botones con relieve, toques cómodos y movimiento completo. */
export const VISUAL_DEFECTO: Visual = { letra: "tema", tamano: "normal", botones: "relieve", toques: "comodo", anim: "completa" };

/** Lo guardado, completado con lo de fábrica donde falte o venga un valor raro. */
export function normalizarVisual(crudo: unknown): Visual {
  const o = (typeof crudo === "object" && crudo !== null ? crudo : {}) as Record<string, unknown>;
  const salida = { ...VISUAL_DEFECTO } as Record<string, string>;
  for (const k of Object.keys(OPCIONES_VISUALES) as Array<keyof Visual>) {
    if ((OPCIONES_VISUALES[k] as readonly unknown[]).includes(o[k])) salida[k] = o[k] as string;
  }
  return salida as unknown as Visual;
}

export function leerVisual(): Visual {
  try {
    return normalizarVisual(JSON.parse(localStorage.getItem(CLAVE_VISUAL) ?? "{}"));
  } catch {
    return { ...VISUAL_DEFECTO };
  }
}

/** Pone los ajustes en la página. */
export function aplicarVisual(v: Visual): void {
  const d = document.documentElement.dataset;
  d.letra = v.letra;
  d.tamano = v.tamano;
  d.botones = v.botones;
  d.toques = v.toques;
  d.anim = v.anim;
}

/** Cambia uno o varios ajustes, los guarda y los aplica al instante. Devuelve los ajustes resultantes. */
export function elegirVisual(cambio: Partial<Visual>): Visual {
  const nuevo = normalizarVisual({ ...leerVisual(), ...cambio });
  try {
    localStorage.setItem(CLAVE_VISUAL, JSON.stringify(nuevo));
  } catch {
    /* Sin dónde guardarlo, vale para esta sesión. */
  }
  aplicarVisual(nuevo);
  return nuevo;
}
