/**
 * El arrastre del día anterior.
 *
 * La lista de un día en la app de reparto suele abrir con una o dos rutas de
 * la noche anterior. Contarlas otra vez las cobraría dos veces: así salieron
 * 16 pedidos en un día en que se hicieron 12.
 */
import { describe, expect, it } from "vitest";

import { quitarArrastre, rutasDeArrastre } from "./arrastre";
import type { JornadaFusionada, OrdenFusionada, RutaFusionada } from "./fusionar";
import type { FechaISO } from "@/lib/fechas";

function ruta(numero: number, inicio: string, fin: string): RutaFusionada {
  return {
    numero,
    estado: "Finalizado",
    hora_inicio: inicio,
    hora_fin: fin,
    legible_completo: true,
    numero_deducido: false,
    apariciones: 1,
    posicion: numero,
  };
}

let siguiente = 0;
function pedido(ruta: number | null, codigo?: string): OrdenFusionada {
  siguiente++;
  return {
    codigo: codigo ?? `v${String(12230000 + siguiente)}wofp-01`,
    ruta,
    estado: "Entregado",
    legible_completo: ruta !== null,
    posicion: siguiente,
    apariciones: 1,
  };
}

function jornada(rutas: RutaFusionada[], ordenes: OrdenFusionada[]): JornadaFusionada {
  return {
    fecha: "2026-09-16" as FechaISO,
    fechasEnConflicto: [],
    contadorRutas: rutas.length,
    contadorOrdenes: ordenes.length,
    resumenOrdenes: null,
    rutas,
    ordenes,
    conteoImagenes: { rutas: 1, ordenes: 1, desconocido: 0 },
  };
}

/** Tu día: dos rutas de la noche anterior y seis de la mañana, dos pedidos cada una. */
const CON_ARRASTRE = [
  ruta(1, "20:21", "20:53"),
  ruta(2, "21:24", "21:49"),
  ruta(3, "10:03", "10:27"),
  ruta(4, "11:04", "11:22"),
  ruta(5, "12:09", "12:24"),
  ruta(6, "13:20", "14:00"),
  ruta(7, "15:12", "15:42"),
  ruta(8, "16:52", "17:10"),
];

describe("reconocer las rutas de la noche anterior", () => {
  it("dos rutas de noche antes de la mañana: son arrastre", () => {
    expect(rutasDeArrastre(CON_ARRASTRE)).toBe(2);
  });

  it("una sola ruta de noche también", () => {
    expect(
      rutasDeArrastre([ruta(1, "21:24", "21:49"), ruta(2, "10:03", "10:27"), ruta(3, "11:04", "11:22")]),
    ).toBe(1);
  });

  it("un día normal, que empieza de mañana, no tiene arrastre", () => {
    expect(
      rutasDeArrastre([ruta(1, "10:03", "10:27"), ruta(2, "11:04", "11:22"), ruta(3, "18:20", "18:57")]),
    ).toBe(0);
  });

  it("un día que termina pasada la medianoche no se confunde con arrastre", () => {
    // La hora también retrocede, pero al final y no al principio.
    expect(
      rutasDeArrastre([
        ruta(1, "10:03", "10:27"),
        ruta(2, "15:12", "15:42"),
        ruta(3, "22:30", "23:10"),
        ruta(4, "00:40", "01:05"),
      ]),
    ).toBe(0);
  });

  it("un salto de hora con una ruta de día delante no es arrastre", () => {
    // 13:20 no es de noche: lo más probable es una hora mal leída, y
    // descartar una ruta de verdad sería perder dinero sin avisar.
    expect(rutasDeArrastre([ruta(1, "13:20", "14:00"), ruta(2, "10:03", "10:27")])).toBe(0);
  });

  it("si tras la noche no viene una mañana, no se da por cambio de día", () => {
    expect(rutasDeArrastre([ruta(1, "21:24", "21:49"), ruta(2, "16:00", "16:30")])).toBe(0);
  });
});

describe("quitar el arrastre del día", () => {
  it("tu caso: 16 pedidos en la lista, 12 del día", () => {
    const pedidos = CON_ARRASTRE.flatMap((r) => [pedido(r.numero), pedido(r.numero)]);
    const limpio = quitarArrastre(jornada(CON_ARRASTRE, pedidos));

    expect(limpio.ordenes).toHaveLength(12);
    expect(limpio.rutas.map((r) => r.numero)).toEqual([3, 4, 5, 6, 7, 8]);
  });

  it("lo descartado no se pierde: se devuelve con su motivo", () => {
    const pedidos = CON_ARRASTRE.flatMap((r) => [pedido(r.numero), pedido(r.numero)]);
    const limpio = quitarArrastre(jornada(CON_ARRASTRE, pedidos));

    expect(limpio.descartes.rutas.map((r) => r.hora_inicio)).toEqual(["20:21", "21:24"]);
    expect(limpio.descartes.ordenes).toHaveLength(4);
    expect(limpio.descartes.ordenes.every((o) => o.motivo === "ruta-anterior")).toBe(true);
  });

  it("los pedidos que quedan se renumeran desde el 1", () => {
    const pedidos = CON_ARRASTRE.flatMap((r) => [pedido(r.numero), pedido(r.numero)]);
    const limpio = quitarArrastre(jornada(CON_ARRASTRE, pedidos));
    expect(limpio.ordenes.map((o) => o.posicion)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
  });

  it("un pedido sin ruta leída por encima de uno de arrastre también es arrastre", () => {
    // La lista va ordenada por ruta: lo que va antes de la Ruta 2 es de la 1 o la 2.
    const pedidos = [pedido(null), pedido(1), pedido(2), pedido(3), pedido(3)];
    const limpio = quitarArrastre(jornada(CON_ARRASTRE, pedidos));
    expect(limpio.ordenes).toHaveLength(2);
  });

  it("un pedido sin ruta después del arrastre se queda", () => {
    const pedidos = [pedido(1), pedido(2), pedido(null), pedido(3)];
    const limpio = quitarArrastre(jornada(CON_ARRASTRE, pedidos));
    expect(limpio.ordenes).toHaveLength(2);
  });

  it("un día sin arrastre no pierde nada", () => {
    const rutas = [ruta(1, "10:03", "10:27"), ruta(2, "11:04", "11:22")];
    const pedidos = [pedido(1), pedido(1), pedido(2), pedido(2)];
    const limpio = quitarArrastre(jornada(rutas, pedidos));
    expect(limpio.ordenes).toHaveLength(4);
    expect(limpio.descartes.ordenes).toHaveLength(0);
  });
});

describe("un pedido no puede repetirse", () => {
  it("un código ya guardado en otro día se descarta, aunque su ruta sea del día", () => {
    const rutas = [ruta(1, "10:03", "10:27"), ruta(2, "11:04", "11:22")];
    const pedidos = [pedido(1, "v11111111wofp-01"), pedido(1), pedido(2)];
    const limpio = quitarArrastre(jornada(rutas, pedidos), {
      "v11111111wofp-01": "2026-09-15" as FechaISO,
    });

    expect(limpio.ordenes).toHaveLength(2);
    expect(limpio.descartes.ordenes[0]).toMatchObject({
      codigo: "v11111111wofp-01",
      motivo: "ya-guardado",
      fechaPrevia: "2026-09-15",
    });
  });

  it("es la señal que salva el caso en que la hora no basta", () => {
    // Arrastre de las 16:30: demasiado temprano para la regla de la hora,
    // pero sus pedidos ya se guardaron el día 15.
    const rutas = [ruta(1, "16:30", "16:55"), ruta(2, "10:03", "10:27")];
    const pedidos = [pedido(1, "v99999991wofp-01"), pedido(2), pedido(2)];
    const limpio = quitarArrastre(jornada(rutas, pedidos), {
      "v99999991wofp-01": "2026-09-15" as FechaISO,
    });
    expect(limpio.ordenes).toHaveLength(2);
  });

  it("volver a cargar el mismo día no descarta nada", () => {
    // El código está guardado, pero en esta misma fecha: es un reemplazo.
    const rutas = [ruta(1, "10:03", "10:27")];
    const pedidos = [pedido(1, "v11111111wofp-01")];
    const limpio = quitarArrastre(jornada(rutas, pedidos), {
      "v11111111wofp-01": "2026-09-16" as FechaISO,
    });
    expect(limpio.ordenes).toHaveLength(1);
  });
});
