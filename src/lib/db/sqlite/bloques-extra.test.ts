/**
 * Apoyo a otra tienda y taxi libre, contra SQLite de verdad.
 */
import { beforeEach, describe, expect, it } from "vitest";

import { REGLA_INICIAL } from "@/lib/pagos/reglas";
import type { FechaISO } from "@/lib/fechas";
import type { JornadaParaGuardar } from "../tipos";

import {
  bloquesPorRango,
  borrarBloque,
  guardarApoyoHora,
  guardarApoyoTramos,
  guardarTaxi,
  listarBloquesDelDia,
} from "./bloques-extra";
import { usarMotor } from "./conexion";
import { guardarJornada, jornadaPorFecha } from "./jornadas";
import { motorEnMemoria } from "./motor-en-memoria";
import { guardarRegla, guardarTienda } from "./perfil";

const FECHA = "2026-09-16" as FechaISO;

beforeEach(() => {
  usarMotor(motorEnMemoria());
});

describe("un día sin jornada de tienda", () => {
  it("crea la jornada sola al registrar un taxi", async () => {
    expect(await jornadaPorFecha(FECHA)).toBeNull();

    await guardarTaxi({
      fecha: FECHA,
      horaInicio: "17:30",
      horaFin: "18:05",
      origen: { lat: -12.05, lng: -77.04 },
      destino: { lat: -12.09, lng: -77.02 },
      km: 8.2,
      kmFuente: "estimado",
      montoCentimos: 2200,
      notas: null,
    });

    const jornada = await jornadaPorFecha(FECHA);
    expect(jornada).not.toBeNull();
    expect(jornada!.ordenes).toHaveLength(0); // sigue sin pedidos de tienda

    const bloques = await listarBloquesDelDia(FECHA);
    expect(bloques).toHaveLength(1);
    expect(bloques[0]).toMatchObject({ tipo: "taxi", km: 8.2, montoCentimos: 2200 });
  });
});

describe("apoyo por hora", () => {
  it("guarda la tarifa tal cual la escribió el driver", async () => {
    await guardarApoyoHora({
      fecha: FECHA,
      horaInicio: "13:15",
      horaFin: "16:15",
      tiendaNombre: "Tienda Limatambo",
      tarifaHoraCentimos: 1800,
      horas: 3,
      motivo: "refuerzo pedido",
      notas: null,
    });

    const [bloque] = await listarBloquesDelDia(FECHA);
    expect(bloque).toMatchObject({
      tipo: "apoyo_hora",
      tiendaNombre: "Tienda Limatambo",
      montoCentimos: 5400, // 1800 x 3
    });
  });
});

describe("apoyo por tramos", () => {
  async function tiendaConRegla(): Promise<string> {
    const tiendaId = await guardarTienda({ nombre: "Tienda Limatambo" });
    await guardarRegla(tiendaId, "auto", "2026-01-01", REGLA_INICIAL);
    return tiendaId;
  }

  it("tarifa cada pedido con la regla vigente de la tienda elegida", async () => {
    const tiendaId = await tiendaConRegla();

    await guardarApoyoTramos({
      fecha: FECHA,
      horaInicio: "13:15",
      horaFin: "16:15",
      tiendaId,
      pedidos: [
        { km: 3.0, kmFuente: "estimado", tramo: 1 },
        { km: 5.0, kmFuente: "estimado", tramo: 2 },
      ],
      notas: null,
    });

    const [bloque] = await listarBloquesDelDia(FECHA);
    expect(bloque.tipo).toBe("apoyo_tramos");
    if (bloque.tipo !== "apoyo_tramos") throw new Error("tipo inesperado");
    expect(bloque.tiendaNombre).toBe("Tienda Limatambo");
    expect(bloque.pedidos).toHaveLength(2);
    expect(bloque.montoCentimos).toBe(1000 + 1150); // tramo 1 + tramo 2 de REGLA_INICIAL
  });
});

describe("taxi libre", () => {
  it("el monto es siempre el que escribió el driver, nunca recalculado", async () => {
    await guardarTaxi({
      fecha: FECHA,
      horaInicio: "17:30",
      horaFin: "18:05",
      origen: { lat: -12.05, lng: -77.04 },
      destino: { lat: -12.09, lng: -77.02 },
      km: 8.2,
      kmFuente: "manual",
      montoCentimos: 9999, // una cifra que no sale de ninguna tarifa
      notas: null,
    });

    const [bloque] = await listarBloquesDelDia(FECHA);
    expect(bloque.montoCentimos).toBe(9999);
  });
});

describe("borrarBloque", () => {
  const dia: JornadaParaGuardar = {
    fecha: FECHA,
    rutasDeclaradas: 1,
    ordenesDeclaradas: 1,
    validacionOk: true,
    horaEntrada: null,
    horaSalida: null,
    tiendaId: null,
    vehiculo: "auto",
    rutas: [{ numero: 1, estado: "Finalizado", horaInicio: "10:00", horaFin: "10:30" }],
    ordenes: [
      { codigo: "v11111111wofp-01", estado: "Entregado", posicion: 1, ruta: 1, tramo: 1, km: null, montoCentimos: 1000 },
    ],
  };

  it("borra en cascada sus pedidos de apoyo, sin tocar las órdenes/rutas de la jornada", async () => {
    await guardarJornada(dia, "reemplazar");
    const tiendaId = await guardarTienda({ nombre: "Tienda Limatambo" });
    await guardarRegla(tiendaId, "auto", "2026-01-01", REGLA_INICIAL);
    const { id } = await guardarApoyoTramos({
      fecha: FECHA,
      horaInicio: null,
      horaFin: null,
      tiendaId,
      pedidos: [{ km: 3.0, kmFuente: "estimado", tramo: 1 }],
      notas: null,
    });

    await borrarBloque(id);

    expect(await listarBloquesDelDia(FECHA)).toHaveLength(0);
    const jornada = await jornadaPorFecha(FECHA);
    expect(jornada!.ordenes).toHaveLength(1); // intacto
    expect(jornada!.rutas).toHaveLength(1); // intacto
  });
});

describe("bloquesPorRango", () => {
  it("agrupa los bloques por fecha, para la liquidación semanal", async () => {
    await guardarApoyoHora({
      fecha: "2026-09-14" as FechaISO,
      horaInicio: null,
      horaFin: null,
      tiendaNombre: "Tienda A",
      tarifaHoraCentimos: 1500,
      horas: 2,
      motivo: null,
      notas: null,
    });
    await guardarTaxi({
      fecha: "2026-09-15" as FechaISO,
      horaInicio: null,
      horaFin: null,
      origen: null,
      destino: null,
      km: 5,
      kmFuente: "manual",
      montoCentimos: 1800,
      notas: null,
    });

    const porFecha = await bloquesPorRango("2026-09-14" as FechaISO, "2026-09-16" as FechaISO);
    expect(porFecha.get("2026-09-14" as FechaISO)).toHaveLength(1);
    expect(porFecha.get("2026-09-15" as FechaISO)).toHaveLength(1);
    expect(porFecha.has("2026-09-16" as FechaISO)).toBe(false);
  });
});

describe("adicionales: tipos propios", () => {
  it("crea tipos sin duplicar por mayúsculas o espacios, y los taxis de siempre son «Taxi»", async () => {
    const { crearCategoria, listarCategorias, archivarCategoria, CATEGORIA_TAXI } = await import("./bloques-extra");
    expect((await listarCategorias()).map((c) => c.nombre)).toEqual(["Taxi"]);

    const a = await crearCategoria("  Expo   Vino ");
    const b = await crearCategoria("expo vino");
    expect(b.id).toBe(a.id);
    expect(a.nombre).toBe("Expo Vino");
    await expect(crearCategoria("x")).rejects.toThrow();

    await archivarCategoria(a.id);
    expect((await listarCategorias()).find((c) => c.id === a.id)!.activa).toBe(false);
    expect((await crearCategoria("Expo Vino")).activa).toBe(true); // volver a crearlo lo reactiva
    expect(CATEGORIA_TAXI).toBe("cat_taxi");
  });

  it("un adicional guarda su tipo y se lee con el nombre; sin tipo, es Taxi", async () => {
    const { crearCategoria, guardarTaxi, listarBloquesDelDia } = await import("./bloques-extra");
    const fecha = "2026-09-16" as FechaISO;
    const mov = await crearCategoria("Movilidad");
    const base = { fecha, horaInicio: null, horaFin: null, origen: null, destino: null, km: 0, kmFuente: "manual" as const, notas: null };
    await guardarTaxi({ ...base, montoCentimos: 2500, categoriaId: mov.id, descripcion: "A Barranco" });
    await guardarTaxi({ ...base, km: 6, montoCentimos: 1800 });

    const leidos = await listarBloquesDelDia(fecha);
    const nombres = leidos.map((b) => (b.tipo === "taxi" ? b.categoriaNombre : null)).sort();
    expect(nombres).toEqual(["Movilidad", "Taxi"]);
    const m = leidos.find((b) => b.tipo === "taxi" && b.categoriaNombre === "Movilidad")!;
    expect(m.tipo === "taxi" && m.descripcion).toBe("A Barranco");
  });
});
