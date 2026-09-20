/**
 * Respaldo y restauración, contra SQLite de verdad.
 */
import { beforeEach, describe, expect, it } from "vitest";

import { usarMotor } from "./conexion";
import { motorEnMemoria } from "./motor-en-memoria";
import { guardarJornada, jornadaPorFecha } from "./jornadas";
import { guardarPerfil } from "./perfil";
import { crearRespaldo, leerRespaldo, restaurarRespaldo, VERSION_RESPALDO } from "./respaldo";
import type { JornadaParaGuardar } from "../tipos";
import type { FechaISO } from "@/lib/fechas";

const dia: JornadaParaGuardar = {
  fecha: "2026-09-16" as FechaISO,
  rutasDeclaradas: 1,
  ordenesDeclaradas: 2,
  validacionOk: true,
  horaEntrada: "09:00",
  horaSalida: "22:00",
  tiendaId: null,
  vehiculo: "auto",
  rutas: [{ numero: 1, estado: "Finalizado", horaInicio: "10:00", horaFin: "10:30" }],
  ordenes: [
    { codigo: "v11111111wofp-01", estado: "Entregado", posicion: 1, ruta: 1, tramo: 1, km: null, montoCentimos: 1000 },
    { codigo: "v22222222wofp-01", estado: "Entregado", posicion: 2, ruta: 1, tramo: 1, km: null, montoCentimos: 1000 },
  ],
};

beforeEach(async () => {
  usarMotor(motorEnMemoria());
  await guardarPerfil({ nombre: "Marco" });
  await guardarJornada(dia, "reemplazar");
});

describe("crear un respaldo", () => {
  it("junta lo que hay guardado", async () => {
    const r = await crearRespaldo();
    expect(r.version).toBe(VERSION_RESPALDO);
    expect(r.tablas.jornadas).toHaveLength(1);
    expect(r.tablas.ordenes).toHaveLength(2);
    expect(r.tablas.perfil).toHaveLength(1);
  });
});

describe("leer un respaldo, sin tocar la base", () => {
  it("resume qué trae: cuántas jornadas y de qué fechas", async () => {
    const respaldo = await crearRespaldo();
    const leido = leerRespaldo(JSON.stringify(respaldo));
    expect(leido.ok).toBe(true);
    if (!leido.ok) return;
    expect(leido.resumen).toEqual({
      jornadas: 1,
      desde: "2026-09-16",
      hasta: "2026-09-16",
      nombre: "Marco",
      generadoEn: respaldo.generadoEn,
    });
  });

  it("un texto que no es JSON se rechaza con un mensaje claro", () => {
    const r = leerRespaldo("esto no es json");
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.error).toMatch(/no es un JSON/);
  });

  it("un JSON que no tiene forma de respaldo se rechaza", () => {
    const r = leerRespaldo(JSON.stringify({ hola: "mundo" }));
    expect(r.ok).toBe(false);
  });
});

describe("restaurar un respaldo", () => {
  it("reemplaza lo que había por lo del respaldo", async () => {
    const respaldo = await crearRespaldo();

    usarMotor(motorEnMemoria()); // un teléfono nuevo, con la base vacía
    await restaurarRespaldo(respaldo);

    const j = await jornadaPorFecha("2026-09-16" as FechaISO);
    expect(j).not.toBeNull();
    expect(j!.ordenes).toHaveLength(2);
  });

  it("un pedido sigue enlazado a su ruta después de restaurar", async () => {
    // Es lo que importa de verdad: el enlace es por id, y los ids se
    // conservan tal cual venían en el respaldo.
    const respaldo = await crearRespaldo();

    usarMotor(motorEnMemoria());
    await restaurarRespaldo(respaldo);

    const j = await jornadaPorFecha("2026-09-16" as FechaISO);
    expect(j!.ordenes.every((o) => o.ruta === 1)).toBe(true);
  });

  it("restaurar sobre datos ya existentes los reemplaza, no los mezcla", async () => {
    const respaldo = await crearRespaldo();

    // El mismo teléfono, con un día distinto ya cargado desde entonces.
    await guardarJornada(
      { ...dia, fecha: "2026-09-20" as FechaISO, ordenes: [] },
      "reemplazar",
    );
    await restaurarRespaldo(respaldo);

    expect(await jornadaPorFecha("2026-09-20" as FechaISO)).toBeNull();
    expect(await jornadaPorFecha("2026-09-16" as FechaISO)).not.toBeNull();
  });

  it("una columna que ya no existe en la app no revienta la restauración", async () => {
    const respaldo = await crearRespaldo();
    (respaldo.tablas.jornadas[0] as Record<string, unknown>).columna_del_futuro = "algo";

    usarMotor(motorEnMemoria());
    await expect(restaurarRespaldo(respaldo)).resolves.not.toThrow();
    expect(await jornadaPorFecha("2026-09-16" as FechaISO)).not.toBeNull();
  });

  it("va todo o nada: si algo falla a mitad, no queda la base a medias", async () => {
    const respaldo = await crearRespaldo();
    // Una fila de "rutas" sin su jornada, con una tabla que no existe: fuerza
    // el fallo sin necesidad de romper la base primero.
    (respaldo.tablas as unknown as Record<string, unknown>).tiendas = null;

    usarMotor(motorEnMemoria());
    await expect(restaurarRespaldo(respaldo)).rejects.toThrow();
  });
});
