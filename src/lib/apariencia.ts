/**
 * Qué cara tiene la app, y cómo se elige.
 *
 * Salen de las cuatro propuestas de diseño (`prototipo/propuestas-diseno.html`).
 * Dos son pareja **claro/oscuro** y siguen al teléfono si no se elige nada:
 *
 *   · `claro`  → propuesta D, «Mapa»;
 *   · `oscuro` → propuesta B, «Asfalto».
 *
 * Las otras dos son **temas propios**, que solo se activan a mano —no tienen
 * media query que los dispare, uno elige el que más le gusta y se queda—:
 *
 *   · `turbo`  → propuesta A: violeta, mostaza y bordes gruesos;
 *   · `menta`  → propuesta C: la continuación del verde de siempre.
 *
 * `auto` sigue eligiendo entre claro y oscuro según el teléfono, como hacía
 * antes de que existieran turbo y menta: elegir un tema propio es un acto
 * explícito, y una vez elegido no cambia solo con la hora del día.
 *
 * Lo elegido se guarda en `localStorage` y no en la base, a propósito: hace
 * falta **antes de pintar**, y la base responde después. Un script mínimo en
 * la cabecera (`SCRIPT_INICIAL`) lo lee y pone `data-modo` en `<html>` antes
 * de que aparezca nada; sin eso, quien eligió un tema vería un fogonazo del
 * tema equivocado cada vez que abre la app.
 *
 * Si `localStorage` no está —modo privado, datos borrados— se cae a `auto`.
 * El tema es una comodidad, y perder la preferencia no puede romper nada.
 */

/** Una cara completa de la app: colores, tipografía y forma. */
type Tema = "claro" | "oscuro" | "turbo" | "menta";
/** Lo que el repartidor eligió: un tema fijo, o que la app decida sola. */
export type Preferencia = "auto" | Tema;
/** Lo que termina puesto en pantalla: siempre uno de los cuatro temas. */
export type Modo = Tema;

export const CLAVE_APARIENCIA = "rutas-a.apariencia";

const TEMAS: readonly Tema[] = ["claro", "oscuro", "turbo", "menta"];
const PREFERENCIAS: readonly Preferencia[] = ["auto", ...TEMAS];

export function esPreferencia(v: unknown): v is Preferencia {
  return typeof v === "string" && (PREFERENCIAS as readonly string[]).includes(v);
}

/** Lo que el repartidor eligió, o `auto` si no eligió nada o no se puede leer. */
export function leerPreferencia(): Preferencia {
  try {
    const guardada = localStorage.getItem(CLAVE_APARIENCIA);
    return esPreferencia(guardada) ? guardada : "auto";
  } catch {
    return "auto";
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
 * La preferencia, ya resuelta a uno de los cuatro temas.
 *
 * Solo `auto` mira el teléfono. Turbo y menta son elecciones fijas: quien los
 * eligió los quiere ver siempre, de día o de noche.
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
export const SCRIPT_INICIAL = `(function(){var TEMAS=['claro','oscuro','turbo','menta'];var m='claro';try{var p=localStorage.getItem('${CLAVE_APARIENCIA}');if(TEMAS.indexOf(p)===-1)p='auto';m=p==='auto'?(matchMedia('(prefers-color-scheme: dark)').matches?'oscuro':'claro'):p}catch(e){}document.documentElement.dataset.modo=m})();`;
