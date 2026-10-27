/**
 * Cotejar el reporte de la empresa con lo que la persona tiene registrado.
 *
 * La empresa manda la lista de los pedidos que contó para el pago (una captura
 * con un código por fila). Se lee el texto de la imagen, se sacan los números de
 * despacho y se comparan con los pedidos de la app. Se compara por **número de
 * despacho** —los 8 dígitos— y no por el código entero: da igual si en la app el
 * pedido está como `v12341686wofp-01` o `wpet-12341686-01`, o con una letra al
 * final.
 *
 * Puro, para poder probarlo sin pantalla.
 */
import { numeroDeDespacho } from "@/lib/extraccion/esquema";
import { esCodigoPendiente } from "@/lib/db/sqlite/jornadas";
import type { FechaISO } from "@/lib/fechas";

/** Cifras que el lector confunde con letras dentro de un número. */
const aDigitos = (t: string): string =>
  t.replace(/[Oo]/g, "0").replace(/[lIi]/g, "1").replace(/S/g, "5").replace(/B/g, "8");

/**
 * Los números de despacho que hay en las líneas leídas de la imagen.
 *
 * Acepta `v12341686wofp-01`, `wpet-12343880-01` y las variantes que a veces trae
 * el reporte (`wpet-opcaso12343880p-01`): un prefijo, 8 dígitos y un sufijo con
 * guion. Se ignora el resto de la fila (nombre, cantidad). Sin repetidos, en el
 * orden en que salen.
 */
export function extraerNumeros(lineas: readonly string[]): string[] {
  const vistos = new Set<string>();
  const re = /(?:^|[^a-z0-9])(?:v|wpet[-\s]?[a-z]{0,10})\s*([0-9OolISB]{8})\s*(?:wofp|p)?\s*[-–]\s*0?\d(?![0-9])/gi;
  for (const linea of lineas) {
    for (const m of linea.matchAll(re)) {
      const numero = aDigitos(m[1]);
      if (/^\d{8}$/.test(numero)) vistos.add(numero);
    }
  }
  return [...vistos];
}

export interface PedidoMio {
  id: string;
  codigo: string;
  fecha: FechaISO;
  montoCentimos: number;
  contado: boolean;
}

export interface ResultadoDeCotejo {
  /** Cuántos números distintos trae el reporte de la empresa. */
  enReporte: number;
  /** Los míos que la empresa también contó. */
  coinciden: PedidoMio[];
  /** Números que la empresa contó y que no tengo con código. */
  faltanEnMiRegistro: string[];
  /** Los míos, dentro del período del reporte, que la empresa no contó. */
  noContados: PedidoMio[];
  /** Pedidos míos sin código real (de «anotar cuántos hice»), dentro del período. */
  sinCodigo: PedidoMio[];
  /** El período que cubre el reporte, por los pedidos que coinciden; null si no coincidió ninguno. */
  periodo: { desde: FechaISO; hasta: FechaISO } | null;
}

export function cotejar(numerosEmpresa: readonly string[], mios: readonly PedidoMio[]): ResultadoDeCotejo {
  const empresa = new Set(numerosEmpresa);
  const conNumero = mios.map((p) => ({ p, numero: esCodigoPendiente(p.codigo) ? null : numeroDeDespacho(p.codigo) }));

  const coinciden = conNumero.filter((x) => x.numero !== null && empresa.has(x.numero)).map((x) => x.p);
  const mios8 = new Set(conNumero.flatMap((x) => (x.numero ? [x.numero] : [])));
  const faltanEnMiRegistro = numerosEmpresa.filter((n) => !mios8.has(n));

  if (coinciden.length === 0) {
    return { enReporte: empresa.size, coinciden, faltanEnMiRegistro, noContados: [], sinCodigo: [], periodo: null };
  }

  const fechas = coinciden.map((p) => p.fecha).sort();
  const periodo = { desde: fechas[0], hasta: fechas[fechas.length - 1] };
  const dentro = (p: PedidoMio) => p.fecha >= periodo.desde && p.fecha <= periodo.hasta;

  return {
    enReporte: empresa.size,
    coinciden,
    faltanEnMiRegistro,
    noContados: conNumero.filter((x) => x.numero !== null && !empresa.has(x.numero) && dentro(x.p)).map((x) => x.p),
    sinCodigo: conNumero.filter((x) => x.numero === null && dentro(x.p)).map((x) => x.p),
    periodo,
  };
}
