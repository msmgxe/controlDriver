/**
 * Pone en orden lo que el lector de texto devuelve, usando **dónde** está cada
 * cosa en la imagen.
 *
 * Hasta ahora el lector entregaba solo líneas de texto, en el orden que le
 * saliera —por bloques, y ese orden cambia con el teléfono y con la versión de
 * Android—. El intérprete tenía que adivinar a qué pedido pertenecía cada
 * `Ruta 4` y cada `Entregado` mirando qué línea iba antes o después, y
 * adivinaba mal justo cuando el orden se torcía: en las capturas reales del
 * 20/09, **la mitad de los pedidos salían con la ruta del vecino**, y la Ruta 1
 * se leía como Ruta 2.
 *
 * Con las coordenadas no hay nada que adivinar. Una tarjeta de pedido es:
 *
 *     v12250818wofp-01                 Ruta 4      ← el código y la ruta, en la misma fila
 *     (✓ Entregado)                                ← el estado, justo debajo
 *
 * así que la ruta de un pedido es la que está **en su fila**, y su estado, el
 * que está **debajo de él y encima del siguiente**. Lo que no cae en ninguna
 * tarjeta —el rabo de la tarjeta anterior, cortada por arriba al hacer scroll,
 * o el borde de la de abajo— se descarta en vez de pegárselo a un vecino.
 *
 * Todo es puro: recibe cajas y devuelve las mismas líneas de texto que ya
 * entendía el intérprete, pero ordenadas y sin el ruido. Así se puede probar
 * con lecturas reales, sin teléfono.
 */
import { ESTADOS_DE_PEDIDO, RE_CODIGO, RE_RUTA_DEL_PEDIDO, estadoDe, normalizar } from "./ocr";

/** Un trozo de texto con el rectángulo que ocupa, en píxeles de la imagen. */
export interface LineaConCaja {
  texto: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * Cuánto pueden separarse dos trozos, en alturas de letra, para seguir siendo
 * **la misma frase**. «Rutas» y su contador, o el círculo con el número y la
 * palabra «Ruta», están a una letra de distancia; el código y su etiqueta de
 * ruta, al otro lado de la tarjeta, a diez. Se mide en alturas y no en píxeles
 * para que valga igual en cualquier pantalla.
 */
const SEPARACION_DE_FRASE = 1.6;

/** Cuánto por debajo de su código puede estar el estado, en alturas de letra. */
const ALCANCE_DEL_ESTADO = 3.5;

const centroY = (c: LineaConCaja) => c.y + c.h / 2;

/* ---------------------------------------------------------------------------
 * Filas
 * ------------------------------------------------------------------------- */

/**
 * Reparte los trozos en filas, de arriba abajo, y cada fila de izquierda a
 * derecha. Dos trozos son de la misma fila si sus centros verticales casi
 * coinciden: una etiqueta pequeña y un código grande comparten fila aunque no
 * midan lo mismo.
 */
function enFilas(trozos: readonly LineaConCaja[]): LineaConCaja[][] {
  const ordenados = [...trozos].sort((a, b) => centroY(a) - centroY(b) || a.x - b.x);
  const filas: Array<{ trozos: LineaConCaja[]; centro: number; alto: number }> = [];

  for (const t of ordenados) {
    const fila = filas.at(-1);
    if (fila && Math.abs(centroY(t) - fila.centro) <= 0.55 * Math.min(t.h, fila.alto)) {
      fila.trozos.push(t);
      fila.centro = fila.trozos.reduce((s, x) => s + centroY(x), 0) / fila.trozos.length;
      fila.alto = Math.min(fila.alto, t.h);
    } else {
      filas.push({ trozos: [t], centro: centroY(t), alto: t.h });
    }
  }

  return filas.map((f) => f.trozos.sort((a, b) => a.x - b.x));
}

/** Junta los trozos contiguos de una fila en frases. */
function enFrases(fila: readonly LineaConCaja[]): LineaConCaja[] {
  const frases: LineaConCaja[] = [];
  for (const t of fila) {
    const previa = frases.at(-1);
    if (previa && t.x - (previa.x + previa.w) <= SEPARACION_DE_FRASE * Math.max(previa.h, t.h)) {
      const arriba = Math.min(previa.y, t.y);
      frases[frases.length - 1] = {
        texto: `${previa.texto} ${t.texto}`,
        x: previa.x,
        y: arriba,
        w: t.x + t.w - previa.x,
        h: Math.max(previa.y + previa.h, t.y + t.h) - arriba,
      };
    } else {
      frases.push(t);
    }
  }
  return frases;
}

/* ---------------------------------------------------------------------------
 * Qué es cada cosa
 * ------------------------------------------------------------------------- */

const conCodigo = (t: string) => RE_CODIGO.test(t);
const esRuta = (t: string) => RE_RUTA_DEL_PEDIDO.test(normalizar(t));
const esSoloCifra = (t: string) => /^(?:[^\w\s]|[oaq@©])?\s*\d{1,3}$/.test(normalizar(t));

function esEstadoDePedido(t: string): boolean {
  const e = estadoDe(normalizar(t));
  return e !== null && ESTADOS_DE_PEDIDO.has(e);
}

/* ---------------------------------------------------------------------------
 * Lo público
 * ------------------------------------------------------------------------- */

/**
 * Las líneas de una captura, en el orden en que se leen en pantalla y con cada
 * ruta y cada estado junto al pedido que le corresponde.
 *
 * Si la captura no tiene ningún pedido —la pantalla de Rutas— solo se ordena.
 */
export function lineasEnOrdenDeLectura(trozos: readonly LineaConCaja[]): string[] {
  const utiles = trozos.filter((t) => t.texto.trim().length > 0);
  const filas = enFilas(utiles).map(enFrases);

  const primeraConCodigo = filas.findIndex((f) => f.some((c) => conCodigo(c.texto)));
  if (primeraConCodigo === -1) return filas.flat().map((c) => c.texto.trim());

  const conservadas: LineaConCaja[] = [];
  /* Estados ya asignados: cada código se queda con el **primero** que tiene
     debajo, y uno solo. */
  const conEstado = new Set<LineaConCaja>();

  const filaDelCodigoDe = (r: number): number => {
    for (let k = r; k >= primeraConCodigo; k--) {
      if (filas[k].some((c) => conCodigo(c.texto))) return k;
    }
    return -1;
  };

  filas.forEach((fila, r) => {
    const hayCodigoEnLaFila = fila.some((c) => conCodigo(c.texto));
    const siguienteTieneCodigo = filas[r + 1]?.some((c) => conCodigo(c.texto)) ?? false;

    for (const c of fila) {
      if (conCodigo(c.texto)) {
        conservadas.push(c);
      } else if (esRuta(c.texto)) {
        /* La etiqueta de ruta vale si va en la fila de un código, o si es la
           cabecera de un bloque —sola, con un código justo debajo—. Suelta en
           cualquier otro sitio es el pico de una tarjeta cortada. */
        if (hayCodigoEnLaFila || (fila.length === 1 && siguienteTieneCodigo)) conservadas.push(c);
      } else if (esEstadoDePedido(c.texto)) {
        if (r < primeraConCodigo) {
          /* Encima del primer pedido solo hay dos cosas: el resumen —tres
             rótulos con su cifra— y el rabo de una tarjeta cortada por arriba.
             El resumen se reconoce porque los rótulos van juntos o llevan una
             cifra al lado; el rabo va solo. */
          const cifraDebajo = filas[r + 1]?.some((x) => esSoloCifra(x.texto)) ?? false;
          const cifraAlLado = fila.some((x) => x !== c && esSoloCifra(x.texto));
          const varios = fila.filter((x) => esEstadoDePedido(x.texto)).length >= 2;
          if (varios || cifraDebajo || cifraAlLado) conservadas.push(c);
        } else if (hayCodigoEnLaFila) {
          conservadas.push(c);
        } else {
          const rc = filaDelCodigoDe(r);
          const codigo = rc === -1 ? undefined : filas[rc].find((x) => conCodigo(x.texto));
          if (
            codigo &&
            !conEstado.has(codigo) &&
            centroY(c) - centroY(codigo) <= ALCANCE_DEL_ESTADO * codigo.h
          ) {
            conEstado.add(codigo);
            conservadas.push(c);
          }
        }
      } else {
        conservadas.push(c);
      }
    }
  });

  return conservadas.map((c) => c.texto.trim());
}
