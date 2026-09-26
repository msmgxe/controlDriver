/**
 * Sacar un punto del mapa de un texto: un enlace de Google Maps, o coordenadas
 * escritas o copiadas tal cual.
 *
 * Sirve para dos cosas: ubicar la tienda desde Ajustes («pega el enlace del
 * lugar»), y corregir la ubicación de un cliente cuando la dirección no se
 * encontró bien.
 */
import { esPuntoValido, type Punto } from "./distancia";

const NUM = String.raw`(-?\d{1,3}(?:\.\d+)?)`;
const PARES = [
  // …/@-12.0895,-76.9704,17z
  new RegExp(String.raw`@${NUM},\s*${NUM}`),
  // …!3d-12.0895!4d-76.9704 (el punto exacto de un lugar)
  new RegExp(String.raw`!3d${NUM}!4d${NUM}`),
  // ?q=-12.0895,-76.9704 · ?ll= · ?query= · ?destination= · ?center=
  new RegExp(String.raw`[?&](?:q|ll|query|destination|center|daddr)=${NUM}(?:%2C|,)\s*${NUM}`, "i"),
  // geo:-12.0895,-76.9704
  new RegExp(String.raw`geo:${NUM},\s*${NUM}`, "i"),
  // Solo coordenadas: «-12.0895, -76.9704»
  new RegExp(String.raw`^\s*${NUM}\s*[,;]\s*${NUM}\s*$`),
  new RegExp(String.raw`^\s*${NUM}\s+${NUM}\s*$`),
];

/** El punto que dice el texto, o null si no dice ninguno. */
export function puntoDeTexto(texto: string): Punto | null {
  const t = texto.trim();
  if (!t) return null;
  for (const re of PARES) {
    const m = re.exec(t);
    if (!m) continue;
    const punto = { lat: Number(m[1]), lng: Number(m[2]) };
    if (esPuntoValido(punto)) return punto;
  }
  return null;
}

/**
 * ¿Es un enlace corto de Google Maps (`maps.app.goo.gl/…`)?
 *
 * Esos no traen las coordenadas dentro: hay que abrirlos para ver adónde
 * llevan, y eso necesita internet. Ver `resolverEnlaceCorto`.
 */
export const esEnlaceCorto = (texto: string): boolean =>
  /(?:maps\.app\.goo\.gl|goo\.gl\/maps|g\.co\/kgs)\//i.test(texto);

/** El primer enlace que aparece en un texto pegado (a veces viene con «Mira este lugar: …»). */
export function primerEnlace(texto: string): string | null {
  return /https?:\/\/\S+/i.exec(texto)?.[0] ?? null;
}

/** Una dirección de Google Maps para ver un punto, para abrirla en la app de mapas. */
export const enlaceDeMapa = (p: Punto): string =>
  `https://www.google.com/maps/search/?api=1&query=${p.lat.toFixed(6)},${p.lng.toFixed(6)}`;

/** Lo mismo, pero buscando un texto, cuando aún no hay coordenadas. */
export const enlaceDeBusqueda = (texto: string): string =>
  `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(texto)}`;
