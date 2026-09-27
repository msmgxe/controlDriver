/**
 * Aceptación del aviso legal: propiedad de la app y protección de los datos
 * de los clientes (ver `TextoLegal`, que trae el texto completo).
 *
 * Igual que el bloqueo (`bloqueo.ts`), vive en `localStorage` y se lee con
 * `useSyncExternalStore`: hace falta antes de pintar, y perder la
 * aceptación —modo privado, datos borrados— no puede dejar la app en un
 * estado raro, así que se cae a "hay que volver a aceptar", nunca al revés.
 *
 * La aceptación queda con la versión del texto que se aceptó. Si el texto
 * cambia de verdad, se sube `VERSION_TERMINOS` y a todo el mundo se le vuelve
 * a pedir, aunque ya hubiera aceptado una versión anterior.
 */

const CLAVE = "rutas-a.terminos";

/** Sube este número solo cuando el texto legal cambie de verdad. */
export const VERSION_TERMINOS = 1;

export interface Aceptacion {
  version: number;
  fecha: string;
}

const oyentes = new Set<() => void>();

export function suscribirTerminos(alCambiar: () => void): () => void {
  oyentes.add(alCambiar);
  return () => {
    oyentes.delete(alCambiar);
  };
}

function avisar(): void {
  for (const oyente of oyentes) oyente();
}

function leerAceptacion(): Aceptacion | null {
  try {
    const crudo = localStorage.getItem(CLAVE);
    if (!crudo) return null;
    const datos = JSON.parse(crudo) as Partial<Aceptacion>;
    if (datos.version !== VERSION_TERMINOS || typeof datos.fecha !== "string") return null;
    return { version: datos.version, fecha: datos.fecha };
  } catch {
    return null;
  }
}

/** La aceptación de la versión vigente, o `null` si falta aceptarla. */
export function aceptacionVigente(): Aceptacion | null {
  return leerAceptacion();
}

export function aceptarTerminos(fecha: string): void {
  try {
    localStorage.setItem(CLAVE, JSON.stringify({ version: VERSION_TERMINOS, fecha } satisfies Aceptacion));
  } catch {
    /* Sin almacenamiento no se puede recordar: se vuelve a pedir la próxima vez.
       Más seguro que dar por aceptado algo que no se pudo guardar. */
  }
  avisar();
}

/* ---------------------------------------------------------------------------
 * Instantáneas para useSyncExternalStore — ver `bloqueo.ts` para el porqué.
 * ------------------------------------------------------------------------- */

export type EstadoTerminos = "desconocido" | "aceptados" | "pendientes";

export function instantaneaTerminos(): EstadoTerminos {
  return leerAceptacion() !== null ? "aceptados" : "pendientes";
}

export function instantaneaTerminosServidor(): EstadoTerminos {
  return "desconocido";
}

/** Para Ajustes: la fecha en que se aceptó, o "" antes de hidratar / si falta. */
export function instantaneaFechaAceptacion(): string {
  return leerAceptacion()?.fecha ?? "";
}

export function instantaneaFechaAceptacionServidor(): string {
  return "";
}
