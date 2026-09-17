import { diasEntre, formatearFecha, type FechaISO } from "@/lib/fechas";
import { RE_CODIGO_PEDIDO } from "./esquema";
import type { JornadaFusionada } from "./fusionar";

/**
 * Validaciones de la pantalla de Revisión (§6).
 *
 * Los **bloqueos** impiden el guardado automático y salen arriba, en lenguaje
 * claro. Los **avisos** se muestran pero dejan guardar: el formato de los
 * códigos podría cambiar y no queremos que la app se rompa por eso.
 */

export type NivelAlerta = "bloqueo" | "aviso";

export type CodigoAlerta =
  | "fechas-mixtas"
  | "sin-fecha"
  | "fecha-futura"
  | "fecha-antigua"
  | "faltan-capturas-ordenes"
  | "faltan-capturas-rutas"
  | "resumen-no-cuadra"
  | "horario-invalido"
  | "rutas-solapadas"
  | "ruta-inexistente"
  | "tarjeta-incompleta"
  | "codigo-formato"
  | "codigo-en-otra-fecha";

export interface Alerta {
  nivel: NivelAlerta;
  codigo: CodigoAlerta;
  /** Texto listo para pantalla, en español y sin jerga técnica (§9). */
  mensaje: string;
  /** Códigos de pedido o números de ruta a los que apunta la alerta. */
  referencias?: string[];
}

export interface OpcionesValidacion {
  /** Hoy según el reloj del driver. */
  hoy: FechaISO;
  /** Fecha que el usuario eligió a mano cuando la captura no la traía (§4.5). */
  fechaElegida?: FechaISO | null;
  /** Códigos ya guardados en otra jornada: código → fecha de esa jornada. */
  codigosEnOtrasFechas?: Readonly<Record<string, FechaISO>>;
}

export function validarJornada(
  jornada: JornadaFusionada,
  opciones: OpcionesValidacion,
): Alerta[] {
  const alertas: Alerta[] = [];
  const { hoy, fechaElegida = null, codigosEnOtrasFechas = {} } = opciones;

  /* --- fecha de la jornada (§4.5, §6) --- */
  if (jornada.fechasEnConflicto.length > 1) {
    alertas.push({
      nivel: "bloqueo",
      codigo: "fechas-mixtas",
      mensaje: `Las capturas son de días distintos (${jornada.fechasEnConflicto
        .map(formatearFecha)
        .join(" y ")}). Sube un día a la vez.`,
      referencias: jornada.fechasEnConflicto,
    });
  }

  const fecha = jornada.fecha ?? fechaElegida;
  if (!fecha) {
    alertas.push({
      nivel: "bloqueo",
      codigo: "sin-fecha",
      mensaje: "No se pudo leer la fecha en las capturas. Elígela antes de guardar.",
    });
  } else {
    const antiguedad = diasEntre(fecha, hoy);
    if (antiguedad < 0) {
      alertas.push({
        nivel: "bloqueo",
        codigo: "fecha-futura",
        mensaje: `La fecha ${formatearFecha(fecha)} todavía no llega. Revisa el día.`,
      });
    } else if (antiguedad > 7) {
      alertas.push({
        nivel: "aviso",
        codigo: "fecha-antigua",
        mensaje: `Esta jornada es de hace ${antiguedad} días (${formatearFecha(fecha)}). Confirma que la fecha es correcta.`,
      });
    }
  }

  /* --- contadores contra lo extraído (§6) --- */
  if (jornada.contadorOrdenes !== null && jornada.ordenes.length !== jornada.contadorOrdenes) {
    const faltan = jornada.contadorOrdenes - jornada.ordenes.length;
    alertas.push({
      nivel: "bloqueo",
      codigo: "faltan-capturas-ordenes",
      mensaje:
        faltan > 0
          ? `Falta una captura de Órdenes: la app marca ${jornada.contadorOrdenes} pedidos y se leyeron ${jornada.ordenes.length}.`
          : `Se leyeron ${jornada.ordenes.length} pedidos pero la app marca ${jornada.contadorOrdenes}. Revisa si se coló una captura de otro día.`,
    });
  }

  if (jornada.contadorRutas !== null && jornada.rutas.length !== jornada.contadorRutas) {
    const faltan = jornada.contadorRutas - jornada.rutas.length;
    alertas.push({
      nivel: "bloqueo",
      codigo: "faltan-capturas-rutas",
      mensaje:
        faltan > 0
          ? `Falta una captura de Rutas: la app marca ${jornada.contadorRutas} rutas y se leyeron ${jornada.rutas.length}.`
          : `Se leyeron ${jornada.rutas.length} rutas pero la app marca ${jornada.contadorRutas}.`,
    });
  }

  const resumen = jornada.resumenOrdenes;
  if (resumen) {
    const suma = resumen.entregado + resumen.parcial + resumen.no_entregado;
    if (suma !== jornada.ordenes.length) {
      alertas.push({
        nivel: "bloqueo",
        codigo: "resumen-no-cuadra",
        mensaje: `Los contadores de estado suman ${suma} pero hay ${jornada.ordenes.length} pedidos.`,
      });
    }
  }

  /* --- horarios de las rutas (§6) --- */
  const horarioInvalido = jornada.rutas.filter(
    (r) => r.hora_inicio !== null && r.hora_fin !== null && r.hora_fin <= r.hora_inicio,
  );
  if (horarioInvalido.length > 0) {
    alertas.push({
      nivel: "bloqueo",
      codigo: "horario-invalido",
      mensaje: `La hora de fin no puede ser anterior o igual a la de inicio en ${
        horarioInvalido.length === 1 ? "la ruta" : "las rutas"
      } ${horarioInvalido.map((r) => r.numero).join(", ")}.`,
      referencias: horarioInvalido.map((r) => String(r.numero)),
    });
  }

  const solapadas = rutasSolapadas(jornada);
  if (solapadas.length > 0) {
    alertas.push({
      nivel: "bloqueo",
      codigo: "rutas-solapadas",
      mensaje: `Estas rutas se pisan en el horario: ${solapadas.join(", ")}. Corrige las horas.`,
      referencias: solapadas,
    });
  }

  /* --- coherencia entre pedidos y rutas (§6) --- */
  const numerosDeRuta = new Set(jornada.rutas.map((r) => r.numero));
  const huerfanos = jornada.ordenes.filter((o) => o.ruta !== null && !numerosDeRuta.has(o.ruta));
  if (huerfanos.length > 0) {
    alertas.push({
      nivel: "bloqueo",
      codigo: "ruta-inexistente",
      mensaje: `${huerfanos.length === 1 ? "Un pedido apunta" : `${huerfanos.length} pedidos apuntan`} a una ruta que no aparece en las capturas.`,
      referencias: huerfanos.map((o) => o.codigo),
    });
  }

  /* --- tarjetas cortadas que no llegaron completas en ninguna captura (§6) --- */
  const incompletas = [
    ...jornada.rutas.filter((r) => !r.legible_completo).map((r) => `Ruta ${r.numero}`),
    ...jornada.ordenes.filter((o) => !o.legible_completo).map((o) => o.codigo),
  ];
  if (incompletas.length > 0) {
    alertas.push({
      nivel: "bloqueo",
      codigo: "tarjeta-incompleta",
      mensaje: `${incompletas.length === 1 ? "Una tarjeta quedó cortada" : `${incompletas.length} tarjetas quedaron cortadas`} en todas las capturas. Súbela completa o complétala a mano.`,
      referencias: incompletas,
    });
  }

  /* --- avisos: no bloquean el guardado (§6) --- */
  const formatoRaro = jornada.ordenes.filter((o) => !RE_CODIGO_PEDIDO.test(o.codigo));
  if (formatoRaro.length > 0) {
    alertas.push({
      nivel: "aviso",
      codigo: "codigo-formato",
      mensaje: `${formatoRaro.length === 1 ? "Un código no tiene" : `${formatoRaro.length} códigos no tienen`} el formato habitual. Puede ser un error de lectura de la imagen: revísalo.`,
      referencias: formatoRaro.map((o) => o.codigo),
    });
  }

  const repetidos = jornada.ordenes
    .filter((o) => codigosEnOtrasFechas[o.codigo] !== undefined && codigosEnOtrasFechas[o.codigo] !== fecha)
    .map((o) => o.codigo);
  if (repetidos.length > 0) {
    alertas.push({
      nivel: "aviso",
      codigo: "codigo-en-otra-fecha",
      mensaje: `${repetidos.length === 1 ? "Un código ya está registrado" : `${repetidos.length} códigos ya están registrados`} en otra fecha.`,
      referencias: repetidos,
    });
  }

  return alertas;
}

/** ¿Hay alguna alerta que impida guardar sin intervención del usuario? */
export function hayBloqueos(alertas: readonly Alerta[]): boolean {
  return alertas.some((a) => a.nivel === "bloqueo");
}

/** Pares de rutas cuyos horarios se pisan, como "1 y 2". */
function rutasSolapadas(jornada: JornadaFusionada): string[] {
  const conHorario = jornada.rutas
    .filter((r) => r.hora_inicio !== null && r.hora_fin !== null && r.hora_fin > r.hora_inicio)
    .slice()
    .sort((a, b) => a.hora_inicio!.localeCompare(b.hora_inicio!));

  const pares: string[] = [];
  for (let i = 1; i < conHorario.length; i++) {
    const previa = conHorario[i - 1];
    const actual = conHorario[i];
    if (actual.hora_inicio! < previa.hora_fin!) {
      pares.push(`${previa.numero} y ${actual.numero}`);
    }
  }
  return pares;
}
