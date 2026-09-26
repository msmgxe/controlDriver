/**
 * Reparar los días de moto que se guardaron con los montos del auto.
 *
 * Hasta la v33, confirmar una carga calculaba los montos sin decir el
 * vehículo: un día de moto quedaba con S/ 10 por pedido —la tabla del auto— en
 * vez de S/ 6. Lo que se prueba aquí es que el arreglo corrige eso y **solo**
 * eso.
 */
import { beforeEach, describe, expect, it } from "vitest";

import type { JornadaParaGuardar } from "@/lib/db/tipos";
import type { FechaISO } from "@/lib/fechas";
import { REGLA_INICIAL, TARIFA_MOTO_ELECTRICA, reglaTarifaUnica } from "@/lib/pagos/reglas";

import { consultar, ejecutar, usarMotor } from "./conexion";
import { guardarJornada, jornadaPorFecha, repararMontosDeMoto } from "./jornadas";
import { cerrarSemana } from "./liquidaciones";
import { motorEnMemoria } from "./motor-en-memoria";
import { guardarRegla, listarTiendas, sembrarSiHaceFalta } from "./perfil";

const LUNES = "2026-09-14" as FechaISO;
const MARTES = "2026-09-15" as FechaISO;
const SEMANA_SIGUIENTE = "2026-09-21" as FechaISO;

let tiendaId: string;

const dia = (fecha: FechaISO, vehiculo: "auto" | "moto", ordenes: JornadaParaGuardar["ordenes"]): JornadaParaGuardar => ({
  fecha,
  rutasDeclaradas: 1,
  ordenesDeclaradas: ordenes.length,
  validacionOk: true,
  horaEntrada: null,
  horaSalida: null,
  tiendaId,
  vehiculo,
  rutas: [{ numero: 1, estado: "Finalizado", horaInicio: "10:00", horaFin: "10:30" }],
  ordenes,
});

const pedido = (codigo: string, tramo: number, montoCentimos: number, posicion = 1) => ({
  codigo,
  estado: "Entregado",
  posicion,
  ruta: 1,
  tramo,
  km: null,
  montoCentimos,
});

const montos = async (fecha: FechaISO) =>
  (await jornadaPorFecha(fecha))!.ordenes.map((o) => o.montoCentimos);

beforeEach(async () => {
  usarMotor(motorEnMemoria());
  await sembrarSiHaceFalta();
  tiendaId = (await listarTiendas())[0].id;
  await guardarRegla(tiendaId, "moto", "2000-01-01", reglaTarifaUnica(TARIFA_MOTO_ELECTRICA));
});

describe("repararMontosDeMoto", () => {
  it("cambia los S/ 10 del auto por los S/ 6 de la moto en un día de moto", async () => {
    await guardarJornada(dia(MARTES, "moto", [pedido("v12268269wofp-01", 1, 1000, 1), pedido("v12269477wofp-01", 1, 1000, 2)]), "reemplazar");

    expect(await repararMontosDeMoto()).toBe(2);
    expect(await montos(MARTES)).toEqual([600, 600]);
  });

  it("no toca los días de auto", async () => {
    await guardarJornada(dia(MARTES, "auto", [pedido("v12268269wofp-01", 1, 1000)]), "reemplazar");

    expect(await repararMontosDeMoto()).toBe(0);
    expect(await montos(MARTES)).toEqual([1000]);
  });

  it("es idempotente: la segunda vez no corrige nada", async () => {
    await guardarJornada(dia(MARTES, "moto", [pedido("v12268269wofp-01", 1, 1000)]), "reemplazar");

    expect(await repararMontosDeMoto()).toBe(1);
    expect(await repararMontosDeMoto()).toBe(0);
    expect(await montos(MARTES)).toEqual([600]);
  });

  it("no toca un día de moto que ya tenía los montos bien", async () => {
    await guardarJornada(dia(MARTES, "moto", [pedido("v12268269wofp-01", 1, 600)]), "reemplazar");
    expect(await repararMontosDeMoto()).toBe(0);
  });

  it("no toca los pedidos de más de 12 km: su monto lo escribió la persona", async () => {
    await guardarJornada(dia(MARTES, "moto", [pedido("v12268269wofp-01", 6, 2500)]), "reemplazar");

    expect(await repararMontosDeMoto()).toBe(0);
    expect(await montos(MARTES)).toEqual([2500]);
  });

  it("no toca una semana ya cerrada: ahí manda lo que se cobró", async () => {
    await guardarJornada(dia(LUNES, "moto", [pedido("v12268269wofp-01", 1, 1000)]), "reemplazar");
    await guardarJornada(dia(SEMANA_SIGUIENTE, "moto", [pedido("v12269477wofp-01", 1, 1000)]), "reemplazar");
    await cerrarSemana(LUNES, REGLA_INICIAL, null);

    expect(await repararMontosDeMoto()).toBe(1);
    expect(await montos(LUNES)).toEqual([1000]);
    expect(await montos(SEMANA_SIGUIENTE)).toEqual([600]);
  });

  it("marca el día como cambiado para que se vuelva a sincronizar", async () => {
    await guardarJornada(dia(MARTES, "moto", [pedido("v12268269wofp-01", 1, 1000)]), "reemplazar");
    await ejecutar(`update jornadas set sincronizado = 1`);

    await repararMontosDeMoto();

    const [fila] = await consultar<{ sincronizado: number }>(`select sincronizado from jornadas`);
    expect(fila.sincronizado).toBe(0);
  });

  it("usa la tarifa de moto que tenga la tienda, no solo la del código", async () => {
    await guardarRegla(tiendaId, "moto", "2026-09-01", reglaTarifaUnica(7.5));
    await guardarJornada(dia(MARTES, "moto", [pedido("v12268269wofp-01", 1, 1000)]), "reemplazar");

    expect(await repararMontosDeMoto()).toBe(1);
    expect(await montos(MARTES)).toEqual([750]);
  });
});
