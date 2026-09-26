/**
 * Distancias entre dos puntos de la Tierra.
 *
 * Solo la matemática, sin red ni plugins: funciona sin señal una vez que se
 * conocen las coordenadas de los dos puntos.
 */

export interface Punto {
  lat: number;
  lng: number;
}

const RADIO_DE_LA_TIERRA_KM = 6371.0088;
const aRadianes = (grados: number): number => (grados * Math.PI) / 180;

/**
 * Kilómetros **en línea recta** entre dos puntos (fórmula de haversine).
 *
 * Es la distancia por el aire: siempre igual o menor que la que se recorre por
 * las calles. Para las tiendas que miden así sus tramos es exacta; para las que
 * miden por la ruta de Waze o Maps es un piso.
 */
export function kmEnLinea(a: Punto, b: Punto): number {
  const dLat = aRadianes(b.lat - a.lat);
  const dLng = aRadianes(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(aRadianes(a.lat)) * Math.cos(aRadianes(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * RADIO_DE_LA_TIERRA_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Hacia dónde queda `b` visto desde `a`: grados desde el norte, en el sentido del reloj (0 a 360). */
export function rumbo(a: Punto, b: Punto): number {
  const dLng = aRadianes(b.lng - a.lng);
  const lat1 = aRadianes(a.lat);
  const lat2 = aRadianes(b.lat);
  const y = Math.sin(dLng) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

/** Una latitud y una longitud que existen. */
export const esPuntoValido = (p: Punto | null | undefined): p is Punto =>
  !!p && Number.isFinite(p.lat) && Number.isFinite(p.lng) && Math.abs(p.lat) <= 90 && Math.abs(p.lng) <= 180;
