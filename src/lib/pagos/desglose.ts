/**
 * De dónde viene el dinero: la tienda de siempre, cada tienda a la que se
 * apoyó, y el taxi. Puro, para poder probarlo sin pantalla.
 *
 * Las filas son las que aparecen en el desglose de Inicio, Pagos y
 * Estadísticas: lo mismo en los tres sitios, con las mismas cuentas.
 */
import type { BloqueExtraFila } from "@/lib/db/tipos";
import type { CategoriaIngreso } from "@/lib/pagos/bloques-extra";

export interface FilaDeDesglose {
  /** Estable, para usarla de `key`. */
  clave: string;
  categoria: CategoriaIngreso;
  /** «Tienda Wong», «Apoyo · Limatambo», «Taxi». */
  etiqueta: string;
  /** «33 pedidos», «11.25 h», «2 carreras · 14.6 km». */
  detalle: string;
  centimos: number;
}

function plural(n: number, uno: string, varios: string): string {
  return `${n} ${n === 1 ? uno : varios}`;
}

/** Quita ceros de más: 11.25 → «11.25», 11 → «11». */
function numero(n: number): string {
  return String(Math.round(n * 100) / 100);
}

/**
 * Las filas del desglose, de mayor a menor dentro de cada categoría y en el
 * orden tienda → apoyo → taxi. Una categoría sin dinero ni pedidos no sale.
 */
export function desglosePorFuente(entrada: {
  tiendaNombre: string | null;
  pedidosTienda: number;
  centimosTienda: number;
  bloques: readonly BloqueExtraFila[];
}): FilaDeDesglose[] {
  const filas: FilaDeDesglose[] = [];

  if (entrada.centimosTienda > 0 || entrada.pedidosTienda > 0) {
    filas.push({
      clave: "tienda",
      categoria: "tienda",
      etiqueta: entrada.tiendaNombre ? `Tienda ${entrada.tiendaNombre}`.replace(/^Tienda Tienda/i, "Tienda") : "Tu tienda",
      detalle: plural(entrada.pedidosTienda, "pedido", "pedidos"),
      centimos: entrada.centimosTienda,
    });
  }

  // El apoyo se junta por tienda: tres días en Limatambo son una sola fila.
  const apoyos = new Map<string, { horas: number; pedidos: number; veces: number; centimos: number }>();
  for (const b of entrada.bloques) {
    if (b.tipo === "taxi") continue;
    const nombre = (b.tiendaNombre || "otra tienda").trim();
    const a = apoyos.get(nombre) ?? { horas: 0, pedidos: 0, veces: 0, centimos: 0 };
    a.veces += 1;
    a.centimos += b.montoCentimos;
    if (b.tipo === "apoyo_hora") a.horas += b.horas;
    else a.pedidos += b.pedidos.length;
    apoyos.set(nombre, a);
  }
  for (const [nombre, a] of [...apoyos].sort((x, y) => y[1].centimos - x[1].centimos)) {
    const partes: string[] = [];
    if (a.horas > 0) partes.push(`${numero(a.horas)} h`);
    if (a.pedidos > 0) partes.push(plural(a.pedidos, "pedido", "pedidos"));
    filas.push({
      clave: `apoyo:${nombre}`,
      categoria: "apoyo",
      etiqueta: `Apoyo · ${nombre}`,
      detalle: partes.join(" · ") || plural(a.veces, "apoyo", "apoyos"),
      centimos: a.centimos,
    });
  }

  const taxis = entrada.bloques.filter((b) => b.tipo === "taxi");
  if (taxis.length > 0) {
    const km = taxis.reduce((s, b) => s + (b.tipo === "taxi" ? (b.km ?? 0) : 0), 0);
    filas.push({
      clave: "taxi",
      categoria: "taxi",
      etiqueta: "Taxi libre",
      detalle: `${plural(taxis.length, "carrera", "carreras")}${km > 0 ? ` · ${numero(km)} km` : ""}`,
      centimos: taxis.reduce((s, b) => s + b.montoCentimos, 0),
    });
  }

  return filas;
}
