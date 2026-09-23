/**
 * Los días de descanso, contra SQLite de verdad.
 *
 * Lo que se vigila es la promesa de la pantalla de Pagos: «no trabajé esos
 * días» los saca de los huecos, sin inventar dinero ni contradecir a una
 * jornada que sí se cargó.
 */
import { beforeEach, describe, expect, it } from "vitest";

import type { FechaISO } from "@/lib/fechas";

import type { JornadaParaGuardar } from "../tipos";
import { usarMotor } from "./conexion";
import { descansosPorRango, marcarDescanso, quitarDescanso } from "./descansos";
import { guardarJornada } from "./jornadas";
import { liquidacionDeSemana } from "./liquidaciones";
import { motorEnMemoria } from "./motor-en-memoria";
import { crearRespaldo } from "./respaldo";

beforeEach(() => usarMotor(motorEnMemoria()));

const F = (d: number) => `2026-09-${String(d).padStart(2, "0")}` as FechaISO;

function jornada(fecha: FechaISO, pedidos = 3): JornadaParaGuardar {
  return {
    fecha,
    rutasDeclaradas: 1,
    ordenesDeclaradas: pedidos,
    validacionOk: true,
    horaEntrada: "09:00",
    horaSalida: "22:00",
    tiendaId: null,
    vehiculo: "auto",
    rutas: [{ numero: 1, estado: "Finalizado", horaInicio: "10:00", horaFin: "10:30" }],
    ordenes: Array.from({ length: pedidos }, (_, i) => ({
      codigo: `v${200000 + i}wofp-01`,
      estado: "Entregado",
      posicion: i + 1,
      ruta: 1,
      tramo: 1,
      km: null,
      montoCentimos: 1000,
    })),
  };
}

describe("marcar y quitar descansos", () => {
  it("marca varios días y los devuelve ordenados", async () => {
    expect(await marcarDescanso([F(17), F(15)])).toEqual([F(15), F(17)]);
    expect(await descansosPorRango(F(14), F(20))).toEqual([F(15), F(17)]);
  });

  it("marcar dos veces el mismo día no lo duplica ni falla", async () => {
    await marcarDescanso([F(15)]);
    await marcarDescanso([F(15), F(15)]);
    expect(await descansosPorRango(F(14), F(20))).toEqual([F(15)]);
  });

  it("no marca un día que tiene jornada: se trabajó", async () => {
    await guardarJornada(jornada(F(16)), "reemplazar");

    const marcadas = await marcarDescanso([F(15), F(16)]);

    expect(marcadas).toEqual([F(15)]);
    expect(await descansosPorRango(F(14), F(20))).toEqual([F(15)]);
  });

  it("se puede quitar", async () => {
    await marcarDescanso([F(15), F(17)]);
    await quitarDescanso([F(15)]);
    expect(await descansosPorRango(F(14), F(20))).toEqual([F(17)]);
  });

  it("solo devuelve los del rango pedido", async () => {
    await marcarDescanso([F(10), F(15), F(25)]);
    expect(await descansosPorRango(F(14), F(20))).toEqual([F(15)]);
  });

  it("si el día llega a cargarse, el descanso se quita solo", async () => {
    await marcarDescanso([F(15)]);

    await guardarJornada(jornada(F(15)), "reemplazar");

    expect(await descansosPorRango(F(14), F(20))).toEqual([]);
  });
});

describe("en la liquidación de la semana", () => {
  // Semana del 14 al 20 de septiembre de 2026. Se cargan el 14 y el 16.
  async function semanaConHuecos() {
    await guardarJornada(jornada(F(14)), "reemplazar");
    await guardarJornada(jornada(F(16)), "reemplazar");
  }

  it("sin descansos, los días sin cargar son huecos", async () => {
    await semanaConHuecos();
    const { liquidacion } = await liquidacionDeSemana(F(20), F(20));
    expect(liquidacion.diasSinCarga).toEqual([F(15), F(17), F(18), F(19), F(20)]);
    expect(liquidacion.diasDescanso).toEqual([]);
  });

  it("los días marcados salen de los huecos y se cuentan aparte", async () => {
    await semanaConHuecos();
    await marcarDescanso([F(15), F(17), F(18)]);

    const { liquidacion } = await liquidacionDeSemana(F(20), F(20));

    expect(liquidacion.diasSinCarga).toEqual([F(19), F(20)]);
    expect(liquidacion.diasDescanso).toEqual([F(15), F(17), F(18)]);
  });

  it("marcar descanso no cambia lo que se cobra", async () => {
    await semanaConHuecos();
    const antes = (await liquidacionDeSemana(F(20), F(20))).liquidacion.montoCalculadoCentimos;

    await marcarDescanso([F(15), F(17)]);
    const despues = (await liquidacionDeSemana(F(20), F(20))).liquidacion.montoCalculadoCentimos;

    expect(despues).toBe(antes);
  });

  it("una marca de descanso sobre un día con jornada se ignora", async () => {
    await semanaConHuecos();
    // Se fuerza la marca por la puerta de atrás, como la dejaría un respaldo viejo.
    const { ejecutar } = await import("./conexion");
    await ejecutar(`insert into dias_descanso (fecha, creado_en) values (?, ?)`, [F(14), "x"]);

    const { liquidacion } = await liquidacionDeSemana(F(20), F(20));

    expect(liquidacion.diasDescanso).not.toContain(F(14));
  });
});

describe("en el respaldo", () => {
  it("los días de descanso viajan en el respaldo", async () => {
    await marcarDescanso([F(15)]);
    const respaldo = await crearRespaldo();
    expect(respaldo.tablas.dias_descanso.map((f) => f.fecha)).toEqual([F(15)]);
  });
});
