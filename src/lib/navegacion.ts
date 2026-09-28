/**
 * Las puertas de la app: las pantallas que se abren desde la barra de abajo (y
 * desde la lateral en pantallas grandes) y cuál está encendida en cada ruta.
 *
 * Va aparte del armazón, sin iconos ni React, para poder probar la regla que
 * más se nota: **la puerta encendida es la pantalla que se está mirando**, y
 * solo esa.
 */

export interface Puerta {
  id: string;
  /** Sin `href` es «Cargar», que abre una hoja en vez de ir a una pantalla. */
  href?: string;
  /** El nombre de la pantalla: el título de arriba y la barra lateral. */
  nombre: string;
  /** El de la barra de abajo, si el entero no cabe en un séptimo del ancho. */
  corto?: string;
}

/** En el orden de la barra de abajo. */
export const PUERTAS: readonly Puerta[] = [
  { id: "inicio", href: "/", nombre: "Hoy", corto: "Inicio" },
  { id: "cargar", nombre: "Cargar" },
  { id: "pagos", href: "/pagos", nombre: "Pagos" },
  { id: "estadisticas", href: "/estadisticas", nombre: "Estadísticas", corto: "Estadíst." },
  { id: "buscar", href: "/buscar", nombre: "Buscar" },
  { id: "historial", href: "/historial", nombre: "Historial" },
  { id: "tutoriales", href: "/tutoriales", nombre: "Tutoriales" },
  { id: "ajustes", href: "/ajustes", nombre: "Ajustes" },
];

/**
 * En el móvil, la barra de abajo no las enseña todas: las cuatro primeras se
 * quedan a la vista, más grandes, y el resto vive detrás de «Más» (ver
 * `Armazon.tsx`). La barra lateral de escritorio sigue mostrando `PUERTAS`
 * entera; solo el móvil tiene este límite de ancho.
 */
export const PUERTAS_PRINCIPALES = 4;

/**
 * Qué puerta está encendida para una ruta. Revisión y compartir son el final de
 * «Cargar»; la jornada, un día de Inicio.
 */
export function puertaDe(ruta: string): string {
  if (ruta === "/" || ruta.startsWith("/jornada")) return "inicio";
  if (ruta.startsWith("/revision") || ruta.startsWith("/compartir")) return "cargar";
  return PUERTAS.find((p) => p.href && p.href !== "/" && ruta.startsWith(p.href))?.id ?? "inicio";
}

/** El título de arriba: el de la puerta encendida, salvo en las pantallas de la carga. */
export function tituloDe(ruta: string): string {
  if (ruta.startsWith("/revision")) return "Revisión";
  if (ruta.startsWith("/compartir")) return "Cargar";
  return PUERTAS.find((p) => p.id === puertaDe(ruta))?.nombre ?? "Hoy";
}
