import { z } from "zod";

/**
 * Reglas de pago (§13).
 *
 * El pago es **por pedido**, según la distancia del pedido, no por ruta. Una
 * ruta puede llevar pedidos de tramos distintos. Todos los pedidos se pagan,
 * sea cual sea su estado: el driver hizo el recorrido aunque el pedido se
 * devuelva.
 *
 * Los montos se manejan en **céntimos enteros** en todo el cálculo. Los soles
 * con decimales solo aparecen al formatear para la pantalla o al escribir en
 * una columna `numeric` de Postgres. Nada de sumar coma flotante.
 */

/**
 * Con qué se reparte.
 *
 * No es un dato decorativo: una misma tienda paga tarifas distintas según el
 * vehículo, porque el costo de cubrir un tramo no es el mismo en moto que en
 * auto. Por eso una regla de pago se identifica por **tienda + vehículo +
 * fecha de vigencia**, y no solo por tienda.
 *
 * Va también en cada jornada, no solo en el perfil: si algún día se sale en
 * moto en vez de en auto, ese día se paga con la tarifa de moto. Guardarlo
 * únicamente en el perfil haría que cambiar de vehículo reescribiera el
 * pasado.
 */
export const esquemaVehiculo = z.enum(["auto", "moto", "bicicleta"]);
export type TipoVehiculo = z.infer<typeof esquemaVehiculo>;

export const VEHICULOS: ReadonlyArray<{ id: TipoVehiculo; nombre: string }> = [
  { id: "auto", nombre: "Auto" },
  { id: "moto", nombre: "Moto eléctrica" },
  { id: "bicicleta", nombre: "Bicicleta" },
];

/** El de siempre, mientras no se diga otra cosa. */
export const VEHICULO_POR_DEFECTO: TipoVehiculo = "auto";

export const esquemaTramo = z.object({
  id: z.number().int().min(1).max(6),
  desde: z.number().min(0),
  hasta: z.number().min(0),
  monto: z.number().min(0),
});

/**
 * Garantía por permanencia en tienda.
 *
 * La tienda paga un monto por hora de presencia y, al final del día, paga **el
 * mayor** de los dos: lo que sumaron los pedidos o lo que suma la permanencia.
 * No se suman: compiten. Es un piso, no un extra.
 *
 * Ejemplo de "Wong - Aldabas": S/ 10 por hora, horario de 9:00 a 22:00 → 13 h →
 * piso de S/ 130. Un día de 14 pedidos paga S/ 141.50 (ganan los pedidos); uno
 * de 11 pedidos paga S/ 130 (gana el piso).
 *
 * Las horas se cuentan **completas, redondeando hacia abajo**: de 9:00 a 21:30
 * son 12 h, no 12.5.
 */
export const esquemaGarantiaPermanencia = z.object({
  activa: z.boolean(),
  solesPorHora: z.number().min(0),
  /** Por ahora solo "diaria": cada día se compara por separado. */
  comparacion: z.literal("diaria"),
  /** Por ahora solo "abajo": las horas se truncan. */
  redondeoHoras: z.literal("abajo"),
});

export const esquemaReglaPago = z.object({
  moneda: z.literal("PEN"),
  base: z.literal("por_pedido"),
  tramos: z.array(esquemaTramo).min(1),
  /** Ausente en tiendas que no pagan permanencia. */
  garantiaPermanencia: esquemaGarantiaPermanencia.nullish(),
});

export type Tramo = z.infer<typeof esquemaTramo>;
export type GarantiaPermanencia = z.infer<typeof esquemaGarantiaPermanencia>;
export type ReglaPago = z.infer<typeof esquemaReglaPago>;

/**
 * Tarifa de "Wong - Aldabas", la primera tienda.
 *
 * Cada tienda tiene sus propias reglas y las registra el administrador; esta
 * vive en `reglas_pago` asociada a su tienda y versionada por `vigente_desde`.
 * Para cambiarla se inserta una fila nueva, nunca se edita la anterior, para no
 * alterar semanas ya liquidadas.
 *
 * Se usa además como respaldo en código si la fila de la base llega corrupta:
 * antes que romper un cálculo de dinero con datos a medias, se usa esto.
 */
export const REGLA_INICIAL: ReglaPago = {
  moneda: "PEN",
  base: "por_pedido",
  tramos: [
    { id: 1, desde: 0, hasta: 3, monto: 10.0 },
    { id: 2, desde: 3, hasta: 8, monto: 11.5 },
    { id: 3, desde: 8, hasta: 10, monto: 13.0 },
    { id: 4, desde: 10, hasta: 11, monto: 14.5 },
    { id: 5, desde: 11, hasta: 12, monto: 16.0 },
  ],
  garantiaPermanencia: {
    activa: true,
    solesPorHora: 10.0,
    comparacion: "diaria",
    redondeoHoras: "abajo",
  },
};

/**
 * Cuánto paga la moto eléctrica hasta que se cambie: un sol único por pedido,
 * sin tramos por distancia (§ modalidad).
 */
export const TARIFA_MOTO_ELECTRICA = 6.0;

/**
 * Una regla de **un solo tramo**, sin techo de distancia: paga lo mismo
 * cualquier pedido, sea cual sea el recorrido.
 *
 * Es la forma de la moto eléctrica: a diferencia del auto, que cobra más
 * cuanto más lejos es el pedido, la tienda le paga a la moto un monto fijo. No
 * hay tabla de tramos que editar, solo un número.
 */
export function reglaTarifaUnica(monto: number): ReglaPago {
  return {
    moneda: "PEN",
    base: "por_pedido",
    // `hasta` no importa —todo pedido cae aquí—, pero tiene que ser un número
    // grande y no `Infinity`: el esquema exige `z.number()`.
    tramos: [{ id: 1, desde: 0, hasta: 9999, monto }],
    garantiaPermanencia: null,
  };
}

/**
 * Tramo abierto de §17.2: la tabla no cubre los pedidos de más de 12 km. Hasta
 * que la tienda lo confirme, se marcan con este tramo y monto manual, y la
 * liquidación los señala aparte.
 */
export const TRAMO_MAS_DE_12_KM = 6;

/* ---------------------------------------------------------------------------
 * Céntimos
 * ------------------------------------------------------------------------- */

/** Soles con decimales → céntimos enteros. */
export function aCentimos(soles: number): number {
  return Math.round(soles * 100);
}

/** Céntimos enteros → soles, listo para una columna numeric(10,2). */
export function aSoles(centimos: number): number {
  return centimos / 100;
}

/** "S/ 141.50" */
export function formatearSoles(centimos: number): string {
  const signo = centimos < 0 ? "−" : "";
  const abs = Math.abs(centimos);
  return `${signo}S/ ${Math.floor(abs / 100)}.${String(abs % 100).padStart(2, "0")}`;
}

/* ---------------------------------------------------------------------------
 * Tramos
 * ------------------------------------------------------------------------- */

/** Lo que cuesta un pedido de ese tramo, en céntimos. */
export function pagoDelTramo(regla: ReglaPago, tramo: number): number | null {
  const t = regla.tramos.find((x) => x.id === tramo);
  return t ? aCentimos(t.monto) : null;
}

/**
 * Tramo al que pertenecen unos kilómetros.
 *
 * Supuesto de §13 pendiente de confirmar (§17.2): el valor exacto del límite
 * pertenece al tramo inferior — 3.0 km paga S/ 10.00 y 3.1 km paga S/ 11.50.
 * Implementado como `km <= hasta`.
 *
 * Devuelve `TRAMO_MAS_DE_12_KM` si se pasa de la tabla.
 */
export function tramoDeKm(regla: ReglaPago, km: number): number {
  const ordenados = [...regla.tramos].sort((a, b) => a.hasta - b.hasta);
  const t = ordenados.find((x) => km <= x.hasta);
  return t ? t.id : TRAMO_MAS_DE_12_KM;
}

/* ---------------------------------------------------------------------------
 * Permanencia en tienda
 * ------------------------------------------------------------------------- */

const aMinutos = (hora: string): number =>
  Number(hora.slice(0, 2)) * 60 + Number(hora.slice(3, 5));

/**
 * Horas de permanencia entre dos horas `HH:MM`, **completas hacia abajo**: de
 * 9:00 a 21:30 son 12 horas, no 12.5.
 *
 * Si la salida es anterior a la entrada se entiende que el turno cruzó la
 * medianoche. Devuelve 0 si falta alguna de las dos.
 */
export function horasDePermanencia(
  entrada: string | null,
  salida: string | null,
): number {
  if (!entrada || !salida) return 0;
  const inicio = aMinutos(entrada);
  const fin = aMinutos(salida);
  const minutos = fin >= inicio ? fin - inicio : fin + 24 * 60 - inicio;
  return Math.floor(minutos / 60);
}

/**
 * Céntimos que garantiza la permanencia de un día, o `null` si la tienda no
 * paga permanencia o no se sabe el horario de ese día.
 */
export function montoPorPermanencia(
  regla: ReglaPago,
  entrada: string | null,
  salida: string | null,
): number | null {
  const garantia = regla.garantiaPermanencia;
  if (!garantia?.activa) return null;

  const horas = horasDePermanencia(entrada, salida);
  if (horas <= 0) return null;

  return horas * aCentimos(garantia.solesPorHora);
}
