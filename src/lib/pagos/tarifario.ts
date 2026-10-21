/**
 * El tarifario de un tipo de adicional: una lista de zonas (distritos) con lo que
 * se paga **por pedido** en cada una. Es el caso de Expo Vino: «Miraflores
 * S/ 8.50, La Molina S/ 9.00…».
 *
 * Puro, para poder probarlo sin pantalla.
 */
export interface ZonaDeTarifa {
  nombre: string;
  /** Por pedido, en céntimos. */
  montoCentimos: number;
}

const MAX_ZONAS = 200;

/** «8,50», «S/ 8.50», «9» → céntimos; null si no es un monto. */
export function montoACentimos(texto: string): number | null {
  const limpio = texto.replace(/s\s*\/\.?/gi, "").trim().replace(",", ".");
  if (!/^\d+(\.\d{1,2})?$/.test(limpio)) return null;
  const c = Math.round(Number(limpio) * 100);
  return c > 0 && c <= 100_000 ? c : null;
}

/**
 * Lee una tabla pegada: una zona por línea, con su monto al final.
 *
 *     Miraflores 8.50
 *     Lima  Santiago de Surco  S/ 8,50      (copiada de una hoja de cálculo: con tabuladores)
 *
 * Si la línea trae tres columnas separadas por tabulador (provincia, distrito,
 * tarifa), el nombre es la del medio. Si no, se quita un «Lima» inicial suelto
 * (la provincia) y el resto antes del monto es el nombre. Las líneas sin monto
 * (títulos, notas) se ignoran, y una zona repetida se queda con el último monto.
 */
export function parsearTarifario(texto: string): ZonaDeTarifa[] {
  const porNombre = new Map<string, ZonaDeTarifa>();

  for (const cruda of texto.split(/\r?\n/)) {
    const linea = cruda.trim();
    if (!linea) continue;

    const columnas = linea.split("\t").map((c) => c.trim()).filter(Boolean);
    let nombre: string;
    let monto: number | null;

    if (columnas.length >= 3) {
      nombre = columnas[columnas.length - 2];
      monto = montoACentimos(columnas[columnas.length - 1]);
    } else {
      const m = /^(.*?)[\s:–-]*(?:s\s*\/\.?\s*)?(\d+(?:[.,]\d{1,2})?)\s*$/i.exec(columnas.join(" "));
      if (!m) continue;
      nombre = m[1].replace(/^lima\s+(?=\S)/i, "");
      monto = montoACentimos(m[2]);
    }

    nombre = nombre.replace(/\s+/g, " ").replace(/[\s:–-]+$/, "").trim();
    if (monto === null || nombre.length < 2 || nombre.length > 60) continue;
    porNombre.set(nombre.toLowerCase(), { nombre, montoCentimos: monto });
    if (porNombre.size >= MAX_ZONAS) break;
  }

  return [...porNombre.values()];
}

/** Lo que se cobra por `cantidad` pedidos en una zona, o null si la zona no está. */
export function montoDeZona(zonas: readonly ZonaDeTarifa[], nombre: string, cantidad: number): number | null {
  const z = zonas.find((x) => x.nombre === nombre);
  return z && Number.isInteger(cantidad) && cantidad > 0 ? z.montoCentimos * cantidad : null;
}
