/**
 * Corregir un pedido de un día ya guardado, contra SQLite de verdad.
 */
import { beforeEach, describe, expect, it } from "vitest";

import { usarMotor } from "./conexion";
import { motorEnMemoria } from "./motor-en-memoria";
import { guardarJornada, jornadaPorFecha } from "./jornadas";
import { actualizarPedido } from "./pedidos";
import type { JornadaParaGuardar } from "../tipos";
import type { FechaISO } from "@/lib/fechas";

const FECHA = "2026-09-16" as FechaISO;

const dia: JornadaParaGuardar = {
  fecha: FECHA,
  rutasDeclaradas: 2,
  ordenesDeclaradas: 3,
  validacionOk: true,
  horaEntrada: "09:00",
  horaSalida: "22:00",
  tiendaId: null,
  vehiculo: "auto",
  rutas: [
    { numero: 1, estado: "Finalizado", horaInicio: "10:00", horaFin: "10:30" },
    { numero: 2, estado: "Finalizado", horaInicio: "11:00", horaFin: "11:30" },
  ],
  ordenes: [
    { codigo: "v11111111wofp-01", estado: "Entregado", posicion: 1, ruta: 1, tramo: 1, km: null, montoCentimos: 1000 },
    { codigo: "v22222222wofp-01", estado: "Entregado", posicion: 2, ruta: 1, tramo: 1, km: null, montoCentimos: 1000 },
    { codigo: "v33333333wofp-01", estado: "Entregado", posicion: 3, ruta: null, tramo: 1, km: null, montoCentimos: 1000 },
  ],
};

async function idDe(codigo: string): Promise<string> {
  const j = await jornadaPorFecha(FECHA);
  return j!.ordenes.find((o) => o.codigo === codigo)!.id;
}

beforeEach(async () => {
  usarMotor(motorEnMemoria());
  await guardarJornada(dia, "reemplazar");
});

describe("corregir la ruta", () => {
  it("mueve el pedido a otra ruta del día", async () => {
    await actualizarPedido(await idDe("v11111111wofp-01"), { ruta: 2 });
    const j = await jornadaPorFecha(FECHA);
    expect(j!.ordenes.find((o) => o.codigo === "v11111111wofp-01")!.ruta).toBe(2);
  });

  it("le pone ruta a uno que no la tenía", async () => {
    await actualizarPedido(await idDe("v33333333wofp-01"), { ruta: 2 });
    const j = await jornadaPorFecha(FECHA);
    expect(j!.ordenes.find((o) => o.codigo === "v33333333wofp-01")!.ruta).toBe(2);
  });

  it("se la puede quitar", async () => {
    await actualizarPedido(await idDe("v11111111wofp-01"), { ruta: null });
    const j = await jornadaPorFecha(FECHA);
    expect(j!.ordenes.find((o) => o.codigo === "v11111111wofp-01")!.ruta).toBeNull();
  });

  it("una ruta que ese día no tiene se rechaza", async () => {
    await expect(actualizarPedido(await idDe("v11111111wofp-01"), { ruta: 9 })).rejects.toThrow(
      /ruta 9/,
    );
  });
});

describe("corregir el código", () => {
  it("lo cambia, en minúsculas y sin espacios", async () => {
    await actualizarPedido(await idDe("v11111111wofp-01"), { codigo: " V44444444WOFP-01 " });
    const j = await jornadaPorFecha(FECHA);
    expect(j!.ordenes.some((o) => o.codigo === "v44444444wofp-01")).toBe(true);
  });

  it("uno con formato raro se rechaza", async () => {
    await expect(
      actualizarPedido(await idDe("v11111111wofp-01"), { codigo: "12345" }),
    ).rejects.toThrow(/código de pedido/);
  });

  it("repetir el código de otro pedido del día se rechaza", async () => {
    // Contaría el mismo pedido dos veces en el pago de la semana.
    await expect(
      actualizarPedido(await idDe("v11111111wofp-01"), { codigo: "v22222222wofp-01" }),
    ).rejects.toThrow(/ya está en otro pedido/);
  });
});

describe("corregir el estado", () => {
  it("cambia el estado y recuenta los contadores del día", async () => {
    await actualizarPedido(await idDe("v11111111wofp-01"), { estado: "No entregado" });
    const j = await jornadaPorFecha(FECHA);
    expect(j!.entregado).toBe(2);
    expect(j!.noEntregado).toBe(1);
  });

  it("un estado inventado se rechaza", async () => {
    await expect(
      actualizarPedido(await idDe("v11111111wofp-01"), { estado: "Perdido" }),
    ).rejects.toThrow(/no es un estado/);
  });
});

describe("si algo no vale, no se aplica nada", () => {
  it("un cambio con la ruta mala no cambia tampoco el código", async () => {
    await expect(
      actualizarPedido(await idDe("v11111111wofp-01"), { codigo: "v55555555wofp-01", ruta: 9 }),
    ).rejects.toThrow();
    const j = await jornadaPorFecha(FECHA);
    expect(j!.ordenes.some((o) => o.codigo === "v11111111wofp-01")).toBe(true);
  });
});
