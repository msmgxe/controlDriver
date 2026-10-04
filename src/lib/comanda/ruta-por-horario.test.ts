/**
 * La ventana de la hoja de despacho es el horario de la ruta: el pedido va a la
 * ruta de esa hora, y se crea (en su orden lógico) si es la primera vez.
 */
import { beforeEach, describe, expect, it } from "vitest";

import { AJUSTES_DE_COMANDAS_POR_DEFECTO } from "@/lib/db/sqlite/ajustes";
import { usarMotor } from "@/lib/db/sqlite/conexion";
import { guardarJornada, jornadaPorFecha } from "@/lib/db/sqlite/jornadas";
import { motorEnMemoria } from "@/lib/db/sqlite/motor-en-memoria";
import { pedidosPorNumero } from "@/lib/db/sqlite/clientes";
import type { JornadaParaGuardar } from "@/lib/db/tipos";
import type { FechaISO } from "@/lib/fechas";

import { guardarComanda, type ComandaParaGuardar } from "./guardar";

const FECHA = "2026-09-16" as FechaISO;
const deps = { guardarFoto: async () => undefined };

const dia: JornadaParaGuardar = {
  fecha: FECHA,
  rutasDeclaradas: 2,
  ordenesDeclaradas: 1,
  validacionOk: true,
  horaEntrada: "09:00",
  horaSalida: "22:00",
  tiendaId: null,
  vehiculo: "auto",
  rutas: [
    { numero: 1, estado: "Finalizado", horaInicio: "10:00", horaFin: "11:00" },
    { numero: 2, estado: "Finalizado", horaInicio: "19:00", horaFin: "20:00" },
  ],
  ordenes: [{ codigo: "v12264655wofp-01", estado: "Entregado", posicion: 1, ruta: 1, tramo: 1, km: null, montoCentimos: 1000 }],
};

const base: ComandaParaGuardar = {
  numero: "7106635",
  ordenExistenteId: null,
  fecha: FECHA,
  moverAFecha: false,
  ruta: null,
  ventana: "17:00–18:00",
  nombre: "Alexis Vizcarra",
  telefono: "",
  direccion: "Algeciras 181, SAN LUIS",
  punto: null,
  distancia: null,
  montoManualCentimos: null,
  evidencia: null,
};

const ajustes = { ...AJUSTES_DE_COMANDAS_POR_DEFECTO };

beforeEach(async () => {
  usarMotor(motorEnMemoria());
  await guardarJornada(dia, "reemplazar");
});

describe("ruta por el horario de la hoja", () => {
  it("crea la ruta que no existía y la pone en su orden por hora", async () => {
    const r = await guardarComanda(base, ajustes, deps);
    expect(r.ruta).toEqual({ numero: 2, creada: true }); // 10:00 · 17:00 · 19:00

    const j = (await jornadaPorFecha(FECHA))!;
    expect(j.rutas.map((x) => [x.numero, x.horaInicio, x.horaFin])).toEqual([
      [1, "10:00", "11:00"],
      [2, "17:00", "18:00"],
      [3, "19:00", "20:00"],
    ]);
    expect(j.ordenes.find((o) => o.codigo === "7106635")!.ruta).toBe(2);
  });

  it("si ya hay una ruta a esa hora, usa esa", async () => {
    await guardarComanda(base, ajustes, deps);
    const r = await guardarComanda({ ...base, numero: "7106730" }, ajustes, deps);
    expect(r.ruta).toEqual({ numero: 2, creada: false });
    expect((await jornadaPorFecha(FECHA))!.rutas).toHaveLength(3);
  });

  it("el primer pedido del día crea la ruta 1", async () => {
    usarMotor(motorEnMemoria());
    const r = await guardarComanda({ ...base, ventana: "08:00–09:00" }, ajustes, deps);
    expect(r.ruta).toEqual({ numero: 1, creada: true });
  });

  it("una ruta que ya traía el pedido no se toca", async () => {
    const existente = (await jornadaPorFecha(FECHA))!.ordenes[0];
    const r = await guardarComanda({ ...base, numero: "12264655", ordenExistenteId: existente.id }, ajustes, deps);
    expect(r.ruta).toBeNull();
    expect((await jornadaPorFecha(FECHA))!.ordenes[0].ruta).toBe(1);
  });

  it("sin ventana, no se asigna ninguna", async () => {
    const r = await guardarComanda({ ...base, ventana: null }, ajustes, deps);
    expect(r.ruta).toBeNull();
  });
});

describe("el código se guarda según el origen", () => {
  it("una hoja de Metro (7 cifras) queda como está impresa y con origen «comanda»", async () => {
    await guardarComanda(base, ajustes, deps);
    const o = (await jornadaPorFecha(FECHA))!.ordenes.find((x) => x.codigo === "7106635")!;
    expect(o.origen).toBe("comanda");
  });

  it("el pedido de una hoja de 7 cifras se encuentra por su número", async () => {
    await guardarComanda(base, ajustes, deps);
    expect((await pedidosPorNumero("7106635")).map((p) => p.codigo)).toEqual(["7106635"]);
  });

  it("una hoja de Wong (8 cifras) sigue siendo vNNNNNNNNwofp-01", async () => {
    await guardarComanda({ ...base, numero: "12289138", ventana: null }, ajustes, deps);
    const o = (await jornadaPorFecha(FECHA))!.ordenes.find((x) => x.codigo === "v12289138wofp-01")!;
    expect(o.origen).toBe("comanda");
  });

  it("los pedidos de las capturas quedan con origen «captura»", async () => {
    expect((await jornadaPorFecha(FECHA))!.ordenes[0].origen).toBe("captura");
  });
});
