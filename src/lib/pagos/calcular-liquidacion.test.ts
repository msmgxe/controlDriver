import { describe, expect, it } from "vitest";
import { calcularLiquidacion, diferenciaDePago, type JornadaLiquidable } from "./calcular-liquidacion";
import {
  REGLA_INICIAL,
  TRAMO_MAS_DE_12_KM,
  aCentimos,
  formatearSoles,
  horasDePermanencia,
  tramoDeKm,
  type ReglaPago,
} from "./reglas";

/* ---------------------------------------------------------------------------
 * Caso de ejemplo de §16 — jornada del 16/09/2026
 *
 * 7 rutas, 14 pedidos, 182 min en ruta. 13 pedidos en tramo 1 y 1 en tramo 2:
 *   13 × S/ 10.00 + 1 × S/ 11.50 = S/ 141.50
 * ------------------------------------------------------------------------- */

const RUTAS_16_09 = [
  { numero: 1, inicio: "10:03", fin: "10:27", duracionMin: 24, codigos: ["v12238726wofp-01", "v12238812wofp-01"] },
  { numero: 2, inicio: "11:04", fin: "11:22", duracionMin: 18, codigos: ["v12239232wofp-01", "v12239089wofp-01"] },
  { numero: 3, inicio: "12:09", fin: "12:24", duracionMin: 15, codigos: ["v12239528wofp-01", "v12239312wofp-01"] },
  { numero: 4, inicio: "13:20", fin: "14:00", duracionMin: 40, codigos: ["v12239582wofp-01", "v12239681wofp-01"] },
  { numero: 5, inicio: "15:12", fin: "15:42", duracionMin: 30, codigos: ["v12240224wofp-01", "v12237397wofp-01"] },
  { numero: 6, inicio: "16:52", fin: "17:10", duracionMin: 18, codigos: ["v12240699wofp-01", "v12240588wofp-01"] },
  { numero: 7, inicio: "18:20", fin: "18:57", duracionMin: 37, codigos: ["v12240721wofp-01", "v12240765wofp-01"] },
];

/** El pedido de la ruta 4 que se fue más lejos: tramo 2 (3 a 8 km). */
const CODIGO_TRAMO_2 = "v12239681wofp-01";

function jornada16(): JornadaLiquidable {
  return {
    fecha: "2026-09-16",
    rutas: RUTAS_16_09.map((r) => ({ numero: r.numero, duracionMin: r.duracionMin })),
    pedidos: RUTAS_16_09.flatMap((r) =>
      r.codigos.map((codigo) => ({
        codigo,
        tramo: codigo === CODIGO_TRAMO_2 ? 2 : 1,
        estado: "Entregado",
        ruta: r.numero,
      })),
    ),
  };
}

describe("calcularLiquidacion — caso de ejemplo §16", () => {
  const l = calcularLiquidacion([jornada16()], REGLA_INICIAL, "2026-09-16", { hasta: "2026-09-16" });

  it("paga S/ 141.50 por la jornada", () => {
    expect(l.montoCalculadoCentimos).toBe(14150);
    expect(formatearSoles(l.montoCalculadoCentimos)).toBe("S/ 141.50");
  });

  it("cuenta 7 rutas y 14 pedidos", () => {
    expect(l.totalRutas).toBe(7);
    expect(l.totalOrdenes).toBe(14);
  });

  it("reparte los pedidos entre tramo 1 y tramo 2", () => {
    expect(l.ordenesPorTramo).toEqual({ "1": 13, "2": 1 });
  });

  it("suma 182 minutos en ruta", () => {
    expect(l.minutosEnRuta).toBe(182);
  });

  it("sitúa la jornada en la semana del 14 al 20 de septiembre, con pago el viernes 25", () => {
    expect(l.semana).toEqual({ inicio: "2026-09-14", fin: "2026-09-20", pago: "2026-09-25" });
  });

  it("carga el monto extra en la ruta 4, que es donde está el pedido de tramo 2", () => {
    const ruta4 = l.detalle.porRuta.find((r) => r.numero === 4);
    expect(ruta4?.montoCentimos).toBe(aCentimos(10) + aCentimos(11.5));
    const ruta1 = l.detalle.porRuta.find((r) => r.numero === 1);
    expect(ruta1?.montoCentimos).toBe(aCentimos(20));
  });

  it("marca como huecos el lunes y el martes, que no se cargaron", () => {
    expect(l.diasSinCarga).toEqual(["2026-09-14", "2026-09-15"]);
  });
});

describe("calcularLiquidacion — todos los pedidos se pagan", () => {
  it("paga igual un pedido no entregado que uno entregado", () => {
    const base: JornadaLiquidable = {
      fecha: "2026-09-16",
      rutas: [{ numero: 1, duracionMin: 20 }],
      pedidos: [
        { codigo: "v10000001wofp-01", tramo: 1, estado: "Entregado", ruta: 1 },
        { codigo: "v10000002wofp-01", tramo: 1, estado: "Entrega parcial", ruta: 1 },
        { codigo: "v10000003wofp-01", tramo: 1, estado: "No entregado", ruta: 1 },
      ],
    };
    const l = calcularLiquidacion([base], REGLA_INICIAL, "2026-09-16");
    // El driver hizo el recorrido aunque el pedido se devuelva: 3 × S/ 10.00.
    expect(l.montoCalculadoCentimos).toBe(3000);
  });
});

describe("calcularLiquidacion — bordes", () => {
  it("ignora las jornadas de otras semanas aunque se las pasen", () => {
    const l = calcularLiquidacion(
      [
        { fecha: "2026-09-13", rutas: [], pedidos: [{ codigo: "a", tramo: 1, estado: "Entregado", ruta: null }] },
        { fecha: "2026-09-14", rutas: [], pedidos: [{ codigo: "b", tramo: 1, estado: "Entregado", ruta: null }] },
        { fecha: "2026-09-21", rutas: [], pedidos: [{ codigo: "c", tramo: 1, estado: "Entregado", ruta: null }] },
      ],
      REGLA_INICIAL,
      "2026-09-16",
    );
    expect(l.totalOrdenes).toBe(1);
    expect(l.montoCalculadoCentimos).toBe(1000);
  });

  it("no tarifa un pedido de más de 12 km sin monto manual y lo deja señalado", () => {
    const l = calcularLiquidacion(
      [
        {
          fecha: "2026-09-16",
          rutas: [{ numero: 1, duracionMin: 50 }],
          pedidos: [
            { codigo: "v10000001wofp-01", tramo: 1, estado: "Entregado", ruta: 1 },
            { codigo: "v10000002wofp-01", tramo: TRAMO_MAS_DE_12_KM, estado: "Entregado", ruta: 1 },
          ],
        },
      ],
      REGLA_INICIAL,
      "2026-09-16",
    );
    expect(l.montoCalculadoCentimos).toBe(1000);
    expect(l.pedidosSinTarifa).toEqual([
      { fecha: "2026-09-16", codigo: "v10000002wofp-01", tramo: 6, motivo: "mas-de-12-km-sin-monto" },
    ]);
    // Sigue contando como pedido para las estadísticas.
    expect(l.totalOrdenes).toBe(2);
  });

  it("sí lo tarifa cuando el driver escribe el monto a mano", () => {
    const l = calcularLiquidacion(
      [
        {
          fecha: "2026-09-16",
          rutas: [],
          pedidos: [
            {
              codigo: "v10000002wofp-01",
              tramo: TRAMO_MAS_DE_12_KM,
              estado: "Entregado",
              ruta: null,
              montoManualCentimos: 1800,
            },
          ],
        },
      ],
      REGLA_INICIAL,
      "2026-09-16",
    );
    expect(l.montoCalculadoCentimos).toBe(1800);
    expect(l.pedidosSinTarifa).toEqual([]);
  });

  it("no cuenta como hueco un día que todavía no llega", () => {
    // Jueves 17: el viernes, sábado y domingo aún no ocurrieron.
    const l = calcularLiquidacion([jornada16()], REGLA_INICIAL, "2026-09-17", { hasta: "2026-09-17" });
    expect(l.diasSinCarga).toEqual(["2026-09-14", "2026-09-15", "2026-09-17"]);
  });

  it("no acumula error de coma flotante en una semana completa", () => {
    // 100 pedidos de S/ 11.50. En float esto da 1149.9999999999998.
    const pedidos = Array.from({ length: 100 }, (_, i) => ({
      codigo: `v1000${String(i).padStart(4, "0")}wofp-01`,
      tramo: 2,
      estado: "Entregado",
      ruta: 1,
    }));
    const l = calcularLiquidacion(
      [{ fecha: "2026-09-16", rutas: [{ numero: 1, duracionMin: 60 }], pedidos }],
      REGLA_INICIAL,
      "2026-09-16",
    );
    expect(l.montoCalculadoCentimos).toBe(115000);
    expect(formatearSoles(l.montoCalculadoCentimos)).toBe("S/ 1150.00");
  });
});

describe("tramoDeKm — supuesto de §13 pendiente de confirmar (§17.2)", () => {
  it("el valor exacto del límite pertenece al tramo inferior", () => {
    expect(tramoDeKm(REGLA_INICIAL, 3)).toBe(1);
    expect(tramoDeKm(REGLA_INICIAL, 3.1)).toBe(2);
    expect(tramoDeKm(REGLA_INICIAL, 8)).toBe(2);
    expect(tramoDeKm(REGLA_INICIAL, 8.1)).toBe(3);
    expect(tramoDeKm(REGLA_INICIAL, 12)).toBe(5);
  });

  it("manda al tramo abierto lo que pasa de 12 km", () => {
    expect(tramoDeKm(REGLA_INICIAL, 12.1)).toBe(TRAMO_MAS_DE_12_KM);
  });
});

describe("diferenciaDePago", () => {
  it("deja la diferencia visible cuando pagaron de menos", () => {
    expect(diferenciaDePago(92350, 91350)).toBe(-1000);
    expect(formatearSoles(-1000)).toBe("−S/ 10.00");
  });

  it("devuelve null mientras no se registre lo recibido", () => {
    expect(diferenciaDePago(92350, null)).toBeNull();
  });
});

/* ---------------------------------------------------------------------------
 * Garantía por permanencia en tienda
 *
 * Regla de "Wong - Aldabas": la tienda paga S/ 10 por hora de permanencia y al
 * cerrar el día paga el MAYOR de los dos —lo que sumaron los pedidos o lo que
 * suma la permanencia—. No se suman: compiten.
 *
 * Horario del driver: 9:00 a 22:00 → 13 h → piso de S/ 130.
 * ------------------------------------------------------------------------- */

const HORARIO = { horaEntrada: "09:00", horaSalida: "22:00" };

/** Una jornada de `cuantos` pedidos de tramo 1, todos en una ruta. */
function jornadaDe(cuantos: number, horario: Partial<JornadaLiquidable> = {}): JornadaLiquidable {
  return {
    fecha: "2026-09-16",
    rutas: [{ numero: 1, duracionMin: 120 }],
    pedidos: Array.from({ length: cuantos }, (_, i) => ({
      codigo: `v1000${String(i).padStart(4, "0")}wofp-01`,
      tramo: 1,
      estado: "Entregado",
      ruta: 1,
    })),
    ...horario,
  };
}

describe("horasDePermanencia — completas, hacia abajo", () => {
  it("cuenta 13 horas entre las 9:00 y las 22:00", () => {
    expect(horasDePermanencia("09:00", "22:00")).toBe(13);
  });

  it("trunca las fracciones en vez de redondearlas", () => {
    expect(horasDePermanencia("09:00", "21:30")).toBe(12);
    expect(horasDePermanencia("09:00", "21:59")).toBe(12);
    expect(horasDePermanencia("09:30", "22:00")).toBe(12);
  });

  it("entiende un turno que cruza la medianoche", () => {
    expect(horasDePermanencia("20:00", "02:00")).toBe(6);
  });

  it("devuelve 0 si falta alguna de las dos horas", () => {
    expect(horasDePermanencia(null, "22:00")).toBe(0);
    expect(horasDePermanencia("09:00", null)).toBe(0);
  });
});

describe("calcularLiquidacion — la garantía es un piso, no un extra", () => {
  it("paga los pedidos cuando superan la permanencia", () => {
    // El caso de §16: 14 pedidos = S/ 141.50, por encima del piso de S/ 130.
    const l = calcularLiquidacion(
      [{ ...jornada16(), ...HORARIO }],
      REGLA_INICIAL,
      "2026-09-16",
      { hasta: "2026-09-16" },
    );
    expect(l.montoCalculadoCentimos).toBe(14150);
    expect(l.detalle.porDia[0].pagaPor).toBe("pedidos");
    expect(l.diasConGarantia).toBe(0);
  });

  it("paga el piso cuando los pedidos se quedan cortos", () => {
    // 11 pedidos de tramo 1 = S/ 110.00, por debajo del piso de S/ 130.
    const l = calcularLiquidacion([jornadaDe(11, HORARIO)], REGLA_INICIAL, "2026-09-16");
    expect(l.montoCalculadoCentimos).toBe(13000);
    expect(formatearSoles(l.montoCalculadoCentimos)).toBe("S/ 130.00");

    const dia = l.detalle.porDia[0];
    expect(dia.pagaPor).toBe("permanencia");
    expect(dia.montoPedidosCentimos).toBe(11000);
    expect(dia.montoPermanenciaCentimos).toBe(13000);
    expect(dia.horasPermanencia).toBe(13);
    expect(l.diasConGarantia).toBe(1);
  });

  it("no suma las dos cosas: 11 pedidos y 13 h no son S/ 240", () => {
    const l = calcularLiquidacion([jornadaDe(11, HORARIO)], REGLA_INICIAL, "2026-09-16");
    expect(l.montoCalculadoCentimos).not.toBe(11000 + 13000);
  });

  it("empata a favor de los pedidos: 13 pedidos son exactamente el piso", () => {
    const l = calcularLiquidacion([jornadaDe(13, HORARIO)], REGLA_INICIAL, "2026-09-16");
    expect(l.montoCalculadoCentimos).toBe(13000);
    expect(l.detalle.porDia[0].pagaPor).toBe("pedidos");
  });

  it("trunca las horas también al pagar: salir a las 21:30 son 12 h, S/ 120", () => {
    const l = calcularLiquidacion(
      [jornadaDe(5, { horaEntrada: "09:00", horaSalida: "21:30" })],
      REGLA_INICIAL,
      "2026-09-16",
    );
    expect(l.montoCalculadoCentimos).toBe(12000);
    expect(l.detalle.porDia[0].horasPermanencia).toBe(12);
  });

  it("sin horario registrado no hay garantía, solo pedidos", () => {
    const l = calcularLiquidacion([jornadaDe(11)], REGLA_INICIAL, "2026-09-16");
    expect(l.montoCalculadoCentimos).toBe(11000);
    expect(l.detalle.porDia[0].pagaPor).toBe("pedidos");
    expect(l.detalle.porDia[0].montoPermanenciaCentimos).toBe(0);
  });

  it("una tienda sin permanencia paga solo por pedido", () => {
    const sinGarantia: ReglaPago = { ...REGLA_INICIAL, garantiaPermanencia: null };
    const l = calcularLiquidacion([jornadaDe(11, HORARIO)], sinGarantia, "2026-09-16");
    expect(l.montoCalculadoCentimos).toBe(11000);
    expect(l.diasConGarantia).toBe(0);
  });
});

describe("calcularLiquidacion — la comparación es día a día, no semanal", () => {
  it("un día bueno no tapa el piso de un día flojo", () => {
    // Lunes flojo: 8 pedidos = S/ 80 → cobra el piso, S/ 130.
    // Martes bueno: 20 pedidos = S/ 200 → cobra los pedidos.
    const l = calcularLiquidacion(
      [
        { ...jornadaDe(8, HORARIO), fecha: "2026-09-14" },
        { ...jornadaDe(20, HORARIO), fecha: "2026-09-15" },
      ],
      REGLA_INICIAL,
      "2026-09-16",
    );

    expect(l.montoCalculadoCentimos).toBe(13000 + 20000);
    expect(l.diasConGarantia).toBe(1);

    // Si se comparase el total de la semana, los S/ 280 de pedidos superarían
    // los S/ 260 de permanencia y el piso del lunes se perdería: S/ 50 menos.
    expect(l.montoPorPedidosCentimos).toBe(28000);
    expect(l.montoCalculadoCentimos).toBeGreaterThan(l.montoPorPedidosCentimos);
  });

  it("deja ver cuánto aportó la garantía en la semana", () => {
    const l = calcularLiquidacion(
      [
        { ...jornadaDe(8, HORARIO), fecha: "2026-09-14" },
        { ...jornadaDe(9, HORARIO), fecha: "2026-09-15" },
      ],
      REGLA_INICIAL,
      "2026-09-16",
    );
    expect(l.montoPorPedidosCentimos).toBe(17000);
    expect(l.montoCalculadoCentimos).toBe(26000);
    expect(l.diasConGarantia).toBe(2);
  });
});
