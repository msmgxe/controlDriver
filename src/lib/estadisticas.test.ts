import { describe, expect, it } from "vitest";

import type { FilaResumenDiario } from "@/lib/db/tipos";
import { lunesDeLaSemana, type FechaISO } from "@/lib/fechas";

import { comparar, diasDelRango, lunesDeLasUltimas, semanasDe, totalesDe } from "./estadisticas";

const HOY = "2026-09-26" as FechaISO;

const fila = (fecha: string, pedidos: number, centimos: number, extra: Partial<FilaResumenDiario> = {}): FilaResumenDiario => ({
  fecha: fecha as FechaISO,
  rutas: Math.ceil(pedidos / 2),
  pedidos,
  minutosEnRuta: pedidos * 8,
  primeraSalida: null,
  ultimoRegreso: null,
  montoCentimos: centimos,
  montoPedidosCentimos: centimos,
  pagaPor: "pedidos",
  pedidosFueraTramo1: 0,
  entregado: pedidos,
  parcial: 0,
  noEntregado: 0,
  validacionOk: true,
  horaEntrada: null,
  horaSalida: null,
  vehiculo: "auto",
  ...extra,
});

describe("los días de un rango", () => {
  const filas = [fila("2026-09-21", 10, 10000), fila("2026-09-23", 12, 13000, { pedidosFueraTramo1: 2 })];
  const dias = diasDelRango("2026-09-21" as FechaISO, "2026-09-27" as FechaISO, filas, new Set(["2026-09-22" as FechaISO]), HOY);

  it("da uno por día, del primero al último", () => {
    expect(dias.map((d) => d.fecha.slice(8))).toEqual(["21", "22", "23", "24", "25", "26", "27"]);
  });

  it("los cargados traen lo del resumen diario", () => {
    expect(dias[0]).toMatchObject({ cargado: true, pedidos: 10, centimos: 10000 });
    expect(dias[2]).toMatchObject({ cargado: true, pedidos: 12, fueraTramo1: 2 });
  });

  it("un descanso no es un hueco, y un día sin nada sí", () => {
    expect(dias[1]).toMatchObject({ cargado: false, descanso: true });
    expect(dias[3]).toMatchObject({ cargado: false, descanso: false, futuro: false });
  });

  it("un día que todavía no llega es futuro, no una falta", () => {
    expect(dias[6]).toMatchObject({ cargado: false, futuro: true });
    expect(dias[5].futuro).toBe(false); // hoy
  });
});

describe("los totales", () => {
  const dias = diasDelRango(
    "2026-09-21" as FechaISO,
    "2026-09-27" as FechaISO,
    [fila("2026-09-21", 10, 10000), fila("2026-09-23", 20, 23000, { pedidosFueraTramo1: 3 })],
    new Set(),
    HOY,
  );
  const t = totalesDe(dias);

  it("suman solo los días cargados", () => {
    expect(t).toMatchObject({ pedidos: 30, centimos: 33000, fueraTramo1: 3, diasTrabajados: 2 });
  });

  it("los promedios se sacan de los días trabajados, no de los siete", () => {
    expect(t.promedioPorDia).toBe(15);
    expect(t.centimosPorDia).toBe(16500);
    expect(t.centimosPorPedido).toBe(1100);
  });

  it("una semana vacía da ceros y no divide entre cero", () => {
    const vacio = totalesDe([]);
    expect(vacio).toMatchObject({ pedidos: 0, centimos: 0, promedioPorDia: 0, centimosPorDia: 0, centimosPorPedido: 0 });
  });
});

describe("agrupar por semana", () => {
  // Un mes que empieza a mitad de semana: septiembre de 2026 empieza en martes.
  const filas = [
    fila("2026-09-01", 5, 5000),
    fila("2026-09-07", 8, 8000),
    fila("2026-09-14", 9, 9000),
    fila("2026-09-30", 4, 4000),
  ];
  const dias = diasDelRango("2026-09-01" as FechaISO, "2026-09-30" as FechaISO, filas, new Set(), HOY);
  const semanas = semanasDe(dias, lunesDeLaSemana);

  it("una semana por lunes, en orden", () => {
    expect(semanas.map((s) => s.lunes)).toEqual(["2026-08-31", "2026-09-07", "2026-09-14", "2026-09-21", "2026-09-28"]);
  });

  it("la primera y la última son parciales", () => {
    expect(semanas[0]).toMatchObject({ desde: "2026-09-01", hasta: "2026-09-06" });
    expect(semanas[4]).toMatchObject({ desde: "2026-09-28", hasta: "2026-09-30" });
  });

  it("cada una suma sus pedidos, y todas juntas suman el mes", () => {
    expect(semanas.map((s) => s.totales.pedidos)).toEqual([5, 8, 9, 0, 4]);
    expect(semanas.reduce((s, x) => s + x.totales.pedidos, 0)).toBe(totalesDe(dias).pedidos);
  });
});

describe("las últimas semanas", () => {
  it("terminan en la elegida, de la más vieja a la más nueva", () => {
    expect(lunesDeLasUltimas("2026-09-21" as FechaISO, 3)).toEqual(["2026-09-07", "2026-09-14", "2026-09-21"]);
  });

  it("una sola es la propia semana", () => {
    expect(lunesDeLasUltimas("2026-09-21" as FechaISO, 1)).toEqual(["2026-09-21"]);
  });
});

describe("comparar dos semanas", () => {
  const semana = (pedidos: number, centimos: number, dias: number) =>
    totalesDe(
      Array.from({ length: dias }, (_, i) => ({
        fecha: `2026-09-${String(14 + i).padStart(2, "0")}` as FechaISO,
        cargado: true,
        pedidos: pedidos / dias,
        rutas: 1,
        minutos: 60,
        centimos: centimos / dias,
        fueraTramo1: 0,
      })),
    );
  const filas = comparar(semana(70, 70000, 5), semana(60, 66000, 6));
  const de = (clave: string) => filas.find((f) => f.clave === clave)!;

  it("trae las seis cifras en orden", () => {
    expect(filas.map((f) => f.clave)).toEqual(["pedidos", "soles", "dias", "promedio", "enRuta", "porPedido"]);
  });

  it("la diferencia es esta semana menos la otra", () => {
    expect(de("pedidos")).toMatchObject({ a: 70, b: 60, diferencia: 10 });
    expect(de("soles")).toMatchObject({ a: 70000, b: 66000, diferencia: 4000 });
  });

  it("puede bajar: menos días trabajados es una diferencia negativa", () => {
    expect(de("dias")).toMatchObject({ a: 5, b: 6, diferencia: -1 });
  });

  it("el promedio por día sube aunque se trabajen menos días", () => {
    expect(de("promedio").a).toBe(14);
    expect(de("promedio").b).toBe(10);
    expect(de("promedio").diferencia).toBe(4);
  });
});
