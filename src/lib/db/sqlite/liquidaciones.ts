/**
 * Liquidaciones semanales sobre la base local (§13).
 *
 * La semana en curso **se recalcula al vuelo** cada vez que se pide: así
 * refleja al instante cualquier jornada que se acabe de guardar. Solo al
 * cerrarla se congela el resultado, junto con la regla que se usó, para que
 * una subida de tarifa no altere semanas ya pagadas.
 *
 * El cálculo en sí no está aquí: vive en `@/lib/pagos/calcular-liquidacion`,
 * es el mismo código que usa el panel web y tiene sus propias pruebas. Aquí
 * solo se leen las jornadas, se le pasan y se guarda lo que devuelve. Esa
 * separación es la razón de que cambiar de base de datos no haya tocado ni una
 * línea de la regla de permanencia de Wong.
 */
import {
  calcularLiquidacion,
  type JornadaLiquidable,
} from "@/lib/pagos/calcular-liquidacion";
import { VEHICULO_POR_DEFECTO, type ReglaPago, type TipoVehiculo } from "@/lib/pagos/reglas";
import { semanaDe, type FechaISO } from "@/lib/fechas";

import type { EstadoSemana, JornadaCompleta, SemanaLiquidada } from "../tipos";
import { consultar, ejecutar, nuevoId } from "./conexion";
import { jornadasPorRango, reglaVigente } from "./jornadas";
import { perfilActual } from "./perfil";

const ahora = () => new Date().toISOString();

export async function liquidacionDeSemana(
  referencia: FechaISO,
  hasta?: FechaISO,
): Promise<SemanaLiquidada> {
  const semana = semanaDe(referencia);
  const perfil = await perfilActual();

  const [jornadas, guardada] = await Promise.all([
    jornadasPorRango(semana.inicio, semana.fin),
    leerGuardada(semana.inicio),
  ]);
  const { regla } = await reglaVigente(
    semana.fin,
    perfil?.tiendaId ?? null,
    vehiculoDeLaSemana(jornadas, perfil?.vehiculo),
  );

  const liquidacion = calcularLiquidacion(
    jornadas.map(aLiquidable),
    regla,
    semana.inicio,
    { hasta },
  );

  return {
    liquidacion,
    estado: guardada?.estado ?? "abierta",
    montoRecibidoCentimos: guardada?.montoRecibidoCentimos ?? null,
    id: guardada?.id ?? null,
  };
}

/**
 * Con qué vehículo se trabajó esa semana.
 *
 * Decide qué tarifa se aplica, porque una misma tienda paga distinto en moto
 * que en auto. Se mira lo que dicen las jornadas y no solo el perfil: el perfil
 * dice el vehículo de hoy, y una semana de hace dos meses pudo ser otra.
 *
 * **Limitación conocida**: si una misma semana mezcla vehículos, se usa el más
 * frecuente para toda ella. Aplicar una tarifa distinta a cada día exige que el
 * cálculo acepte varias reglas a la vez, y eso se hará cuando se registren de
 * verdad las tarifas de moto. Mientras solo haya un vehículo, esto es exacto.
 */
function vehiculoDeLaSemana(
  jornadas: readonly JornadaCompleta[],
  delPerfil: TipoVehiculo | undefined,
): TipoVehiculo {
  if (jornadas.length === 0) return delPerfil ?? VEHICULO_POR_DEFECTO;

  const cuenta = new Map<TipoVehiculo, number>();
  for (const j of jornadas) cuenta.set(j.vehiculo, (cuenta.get(j.vehiculo) ?? 0) + 1);

  let ganador: TipoVehiculo = delPerfil ?? VEHICULO_POR_DEFECTO;
  let masVisto = 0;
  for (const [vehiculo, veces] of cuenta) {
    if (veces > masVisto) {
      masVisto = veces;
      ganador = vehiculo;
    }
  }
  return ganador;
}

function aLiquidable(j: JornadaCompleta): JornadaLiquidable {
  return {
    fecha: j.fecha,
    horaEntrada: j.horaEntrada,
    horaSalida: j.horaSalida,
    rutas: j.rutas.map((r) => ({ numero: r.numero, duracionMin: r.duracionMin })),
    pedidos: j.ordenes.map((o) => ({
      codigo: o.codigo,
      tramo: o.tramo,
      estado: o.estado,
      ruta: o.ruta,
      montoManualCentimos: o.montoCentimos,
    })),
  };
}

async function leerGuardada(semanaInicio: FechaISO): Promise<{
  id: string;
  estado: EstadoSemana;
  montoRecibidoCentimos: number | null;
} | null> {
  const filas = await consultar<{
    id: string;
    estado: string;
    recibido_centimos: number | null;
  }>(
    `select id, estado, recibido_centimos from liquidaciones where semana_inicio = ?`,
    [semanaInicio],
  );
  if (filas.length === 0) return null;
  return {
    id: filas[0].id,
    estado: filas[0].estado as EstadoSemana,
    montoRecibidoCentimos: filas[0].recibido_centimos,
  };
}

/**
 * Cierra una semana: congela el monto, el desglose y la regla usada (§13).
 * Editar una jornada de una semana cerrada exige reabrirla explícitamente.
 */
export async function cerrarSemana(
  referencia: FechaISO,
  regla: ReglaPago,
  reglaId: string | null,
): Promise<void> {
  const semana = semanaDe(referencia);
  const jornadas = await jornadasPorRango(semana.inicio, semana.fin);
  const liquidacion = calcularLiquidacion(jornadas.map(aLiquidable), regla, semana.inicio);

  await ejecutar(
    `insert into liquidaciones
       (id, semana_inicio, semana_fin, fecha_pago, regla_id, total_rutas, total_ordenes,
        ordenes_por_tramo, monto_centimos, detalle, estado, actualizado_en, sincronizado)
     values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'cerrada', ?, 0)
     on conflict (semana_inicio) do update set
       semana_fin        = excluded.semana_fin,
       fecha_pago        = excluded.fecha_pago,
       regla_id          = excluded.regla_id,
       total_rutas       = excluded.total_rutas,
       total_ordenes     = excluded.total_ordenes,
       ordenes_por_tramo = excluded.ordenes_por_tramo,
       monto_centimos    = excluded.monto_centimos,
       detalle           = excluded.detalle,
       estado            = 'cerrada',
       actualizado_en    = excluded.actualizado_en,
       sincronizado      = 0`,
    [
      nuevoId(),
      semana.inicio,
      semana.fin,
      semana.pago,
      reglaId,
      liquidacion.totalRutas,
      liquidacion.totalOrdenes,
      JSON.stringify(liquidacion.ordenesPorTramo),
      liquidacion.montoCalculadoCentimos,
      JSON.stringify({
        ...liquidacion.detalle,
        montoPorPedidosCentimos: liquidacion.montoPorPedidosCentimos,
        diasConGarantia: liquidacion.diasConGarantia,
      }),
      ahora(),
    ],
  );
}

/** Registra lo que realmente pagaron y marca la semana como pagada (§13). */
export async function registrarPago(
  semanaInicio: FechaISO,
  montoRecibidoCentimos: number,
): Promise<void> {
  await ejecutar(
    `update liquidaciones
        set recibido_centimos = ?, estado = 'pagada', actualizado_en = ?, sincronizado = 0
      where semana_inicio = ?`,
    [montoRecibidoCentimos, ahora(), semanaInicio],
  );
}

/** Vuelve a abrir una semana cerrada para poder editar sus jornadas. */
export async function reabrirSemana(semanaInicio: FechaISO): Promise<void> {
  await ejecutar(
    `update liquidaciones
        set estado = 'abierta', actualizado_en = ?, sincronizado = 0
      where semana_inicio = ?`,
    [ahora(), semanaInicio],
  );
}

/**
 * En qué estado está la semana de una fecha.
 *
 * Lo usan las pantallas de edición: una jornada de una semana cerrada no se
 * toca sin reabrirla, porque el monto liquidado está congelado y editarla por
 * debajo dejaría el historial diciendo una cosa y la liquidación otra.
 */
export async function estadoDeSemana(fecha: FechaISO): Promise<EstadoSemana> {
  const guardada = await leerGuardada(semanaDe(fecha).inicio);
  return guardada?.estado ?? "abierta";
}
