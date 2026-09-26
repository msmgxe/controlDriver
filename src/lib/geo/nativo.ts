/**
 * Lo que solo el teléfono sabe hacer: buscar una dirección, saber dónde está,
 * y pedir la ruta por calles.
 *
 * Todo lo demás de `lib/geo` es matemática y funciona sin señal. Esto **no**:
 *
 *   · `buscarDireccion` usa el servicio de direcciones del propio Android
 *     (`Geocoder`) y necesita internet. **La dirección del cliente sale del
 *     teléfono hacia ese servicio**: es la única vez que un dato de un cliente
 *     viaja, y por eso Ajustes lo dice.
 *   · `posicionActual` usa el GPS y pide permiso de ubicación.
 *   · `rutaPorCalles` pide la ruta a un servicio público de rutas, y le manda
 *     **solo coordenadas**, no direcciones ni nombres.
 *
 * Ninguna falla en silencio: si algo no anda, se lanza un `Error` con un
 * mensaje que la pantalla puede enseñar tal cual, y la persona sigue con lo de
 * siempre —poner el pin o los kilómetros a mano—.
 */
import { Capacitor, CapacitorHttp, registerPlugin } from "@capacitor/core";
import { Geolocation } from "@capacitor/geolocation";

import { esPuntoValido, type Punto } from "./distancia";
import { esEnlaceCorto, primerEnlace, puntoDeTexto } from "./enlaces";

/* ---------------------------------------------------------------------------
 * Dirección → coordenadas
 * ------------------------------------------------------------------------- */

interface GeocodificadorPlugin {
  buscar(opciones: {
    texto: string;
    cercaLat?: number;
    cercaLng?: number;
    radioKm?: number;
    max?: number;
  }): Promise<{ resultados: Array<{ lat: number; lng: number; etiqueta: string }> }>;
}

const Geocodificador = registerPlugin<GeocodificadorPlugin>("Geocodificador");

export interface Candidato extends Punto {
  /** Cómo llama Android a ese lugar, para que la persona pueda confirmarlo. */
  etiqueta: string;
}

/**
 * Busca una dirección y devuelve los sitios que Android encuentra, el más
 * probable primero.
 *
 * `cerca` acota la búsqueda a unos kilómetros de un punto —la tienda—: sin
 * eso, «Jr. Los Molles 167» puede salir en otra ciudad. Y `radioKm` es cuánto:
 * 40 km cubre Lima entera con margen.
 */
export async function buscarDireccion(texto: string, cerca?: Punto, radioKm = 40): Promise<Candidato[]> {
  if (!Capacitor.isNativePlatform()) {
    throw new Error("Buscar direcciones solo funciona en la app instalada en el teléfono.");
  }
  try {
    const { resultados } = await Geocodificador.buscar({
      texto,
      cercaLat: cerca?.lat,
      cercaLng: cerca?.lng,
      radioKm,
      max: 4,
    });
    return resultados
      .filter((r) => esPuntoValido(r))
      .map((r) => ({ lat: r.lat, lng: r.lng, etiqueta: r.etiqueta }));
  } catch (fallo) {
    throw new Error(
      fallo instanceof Error && fallo.message ? fallo.message : "No se pudo buscar la dirección. ¿Hay internet?",
    );
  }
}

/* ---------------------------------------------------------------------------
 * GPS
 * ------------------------------------------------------------------------- */

export interface PosicionActual extends Punto {
  /** Cuántos metros de margen dice tener el GPS. */
  precisionM: number | null;
}

/** Dónde está el teléfono ahora, pidiendo permiso si hace falta. */
export async function posicionActual(): Promise<PosicionActual> {
  try {
    const permiso = await Geolocation.checkPermissions();
    if (permiso.location !== "granted") {
      const pedido = await Geolocation.requestPermissions({ permissions: ["location"] });
      if (pedido.location !== "granted") {
        throw new Error("Sin permiso de ubicación. Actívalo en los ajustes del teléfono para Rutas-A.");
      }
    }
    const p = await Geolocation.getCurrentPosition({ enableHighAccuracy: true, timeout: 20_000 });
    return { lat: p.coords.latitude, lng: p.coords.longitude, precisionM: p.coords.accuracy ?? null };
  } catch (fallo) {
    if (fallo instanceof Error && fallo.message) throw fallo;
    throw new Error("No se pudo saber dónde estás. Prueba a salir a un sitio abierto.");
  }
}

/* ---------------------------------------------------------------------------
 * Internet
 * ------------------------------------------------------------------------- */

interface Respuesta {
  status: number;
  data: unknown;
  /** La dirección final, tras seguir las redirecciones. */
  url: string;
}

/**
 * Una petición GET. En el teléfono va por el cliente nativo de Capacitor, que
 * no está sujeto a CORS; en el navegador de desarrollo, por `fetch`.
 */
async function pedir(url: string, ms = 8000): Promise<Respuesta> {
  if (Capacitor.isNativePlatform()) {
    const r = await CapacitorHttp.get({ url, connectTimeout: ms, readTimeout: ms });
    return { status: r.status, data: r.data, url: r.url || url };
  }
  const control = new AbortController();
  const plazo = setTimeout(() => control.abort(), ms);
  try {
    const r = await fetch(url, { signal: control.signal });
    const texto = await r.text();
    let data: unknown = texto;
    try {
      data = JSON.parse(texto);
    } catch {
      /* No era JSON: se devuelve el texto. */
    }
    return { status: r.status, data, url: r.url || url };
  } finally {
    clearTimeout(plazo);
  }
}

/**
 * El punto de un texto pegado: un enlace de Google Maps, largo o corto, o
 * coordenadas. Devuelve `null` si no dice ninguno.
 *
 * Un enlace corto (`maps.app.goo.gl/…`) no trae las coordenadas: hay que
 * abrirlo y ver adónde redirige, y eso necesita internet.
 */
export async function resolverEnlace(texto: string): Promise<Punto | null> {
  const directo = puntoDeTexto(texto);
  if (directo) return directo;

  const enlace = primerEnlace(texto);
  if (!enlace) return null;
  const directoDelEnlace = puntoDeTexto(enlace);
  if (directoDelEnlace) return directoDelEnlace;
  if (!esEnlaceCorto(enlace)) return null;

  try {
    const r = await pedir(enlace, 10_000);
    return (
      puntoDeTexto(r.url) ??
      // A veces el destino está solo en el cuerpo de la página.
      (typeof r.data === "string" ? puntoDeTexto(r.data.slice(0, 200_000)) ?? buscarEnCuerpo(r.data) : null)
    );
  } catch {
    throw new Error("No se pudo abrir el enlace corto. ¿Hay internet? También sirve el enlace largo, o las coordenadas.");
  }
}

/** Busca `@lat,lng` o `!3d…!4d…` en el texto de una página. */
function buscarEnCuerpo(cuerpo: string): Punto | null {
  const m = /@(-?\d{1,3}\.\d+),(-?\d{1,3}\.\d+)/.exec(cuerpo) ?? /!3d(-?\d{1,3}\.\d+)!4d(-?\d{1,3}\.\d+)/.exec(cuerpo);
  if (!m) return null;
  const p = { lat: Number(m[1]), lng: Number(m[2]) };
  return esPuntoValido(p) ? p : null;
}

/**
 * La distancia **por calles** entre dos puntos, en kilómetros, según un
 * servicio público de rutas (OSRM). Devuelve `null` si no pudo: sin señal, o el
 * servicio no contestó a tiempo. Quien llama estima con el factor de calles.
 *
 * Solo se le mandan coordenadas. Es un servicio gratuito y compartido: se usa
 * una vez por pedido, no en ráfagas.
 */
export async function rutaPorCalles(desde: Punto, hasta: Punto): Promise<number | null> {
  try {
    const url =
      `https://router.project-osrm.org/route/v1/driving/` +
      `${desde.lng.toFixed(6)},${desde.lat.toFixed(6)};${hasta.lng.toFixed(6)},${hasta.lat.toFixed(6)}?overview=false`;
    const r = await pedir(url, 8000);
    const datos = r.data as { code?: string; routes?: Array<{ distance?: number }> } | null;
    const metros = datos?.code === "Ok" ? datos.routes?.[0]?.distance : undefined;
    return typeof metros === "number" && metros >= 0 ? metros / 1000 : null;
  } catch {
    return null;
  }
}
