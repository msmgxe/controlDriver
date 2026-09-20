import { beforeEach, describe, expect, it } from "vitest";

import { usarMotor } from "./conexion";
import { motorEnMemoria } from "./motor-en-memoria";
import { guardarJornada, jornadaPorFecha } from "./jornadas";
import { borrarRuta, guardarRuta } from "./rutas";
import type { FechaISO } from "@/lib/fechas";

const FECHA = "2026-09-16" as FechaISO;

beforeEach(() => usarMotor(motorEnMemoria()));

describe("rutas a mano", () => {
  it("crea la jornada si ese día no existía", async () => {
    await guardarRuta(FECHA, { numero: 1, horaInicio: "10:00", horaFin: "10:30" });
    const j = await jornadaPorFecha(FECHA);
    expect(j!.rutas.map((r) => [r.numero, r.horaInicio])).toEqual([[1, "10:00"]]);
  });

  it("volver a guardar la misma ruta la corrige, no la duplica", async () => {
    await guardarRuta(FECHA, { numero: 1, horaInicio: "10:00", horaFin: "10:30" });
    await guardarRuta(FECHA, { numero: 1, horaInicio: "10:15", horaFin: "10:45" });
    const j = await jornadaPorFecha(FECHA);
    expect(j!.rutas).toHaveLength(1);
    expect(j!.rutas[0].horaInicio).toBe("10:15");
  });

  it("calcula la duración a partir del horario", async () => {
    await guardarRuta(FECHA, { numero: 1, horaInicio: "10:00", horaFin: "10:40" });
    const j = await jornadaPorFecha(FECHA);
    expect(j!.rutas[0].duracionMin).toBe(40);
  });

  it("una hora imposible se rechaza con un mensaje claro", async () => {
    await expect(
      guardarRuta(FECHA, { numero: 1, horaInicio: "25:00", horaFin: null }),
    ).rejects.toThrow(/no es una hora/);
  });

  it("un número fuera de rango se rechaza", async () => {
    await expect(
      guardarRuta(FECHA, { numero: 0, horaInicio: null, horaFin: null }),
    ).rejects.toThrow(/entre 1 y 99/);
  });

  it("borrar una ruta deja sus pedidos sin ruta, no los borra", async () => {
    await guardarJornada(
      {
        fecha: FECHA, rutasDeclaradas: 1, ordenesDeclaradas: 2, validacionOk: true,
        horaEntrada: "09:00", horaSalida: "22:00", tiendaId: null, vehiculo: "auto",
        rutas: [{ numero: 1, estado: "Finalizado", horaInicio: "10:00", horaFin: "10:30" }],
        ordenes: [
          { codigo: "v11111111wofp-01", estado: "Entregado", posicion: 1, ruta: 1, tramo: 1, km: null, montoCentimos: 1000 },
          { codigo: "v22222222wofp-01", estado: "Entregado", posicion: 2, ruta: 1, tramo: 1, km: null, montoCentimos: 1000 },
        ],
      },
      "reemplazar",
    );
    const j = await jornadaPorFecha(FECHA);
    await borrarRuta(j!.rutas[0].id);

    const despues = await jornadaPorFecha(FECHA);
    expect(despues!.rutas).toHaveLength(0);
    expect(despues!.ordenes).toHaveLength(2);
    expect(despues!.ordenes.every((o) => o.ruta === null)).toBe(true);
  });
});
