import { beforeEach, describe, expect, it } from "vitest";

import { usarMotor } from "./conexion";
import { motorEnMemoria } from "./motor-en-memoria";
import { guardarJornada, jornadaPorFecha } from "./jornadas";
import { borrarRuta, guardarRuta, reordenarPorHora, reordenarRutasDelDia } from "./rutas";
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

describe("calcular la renumeración por hora (pura)", () => {
  it("ordena de la salida más temprana a la más tardía", () => {
    const mapa = reordenarPorHora([
      { numero: 3, horaInicio: "10:00" },
      { numero: 1, horaInicio: "15:00" },
      { numero: 2, horaInicio: "12:00" },
    ]);
    expect(mapa.get(3)).toBe(1); // salió primero
    expect(mapa.get(2)).toBe(2);
    expect(mapa.get(1)).toBe(3); // salió último
  });

  it("las rutas sin hora van al final, por su propio número", () => {
    // No hay forma honesta de saber cuándo salió una ruta sin hora, así que
    // entre ellas se ordenan por su número de siempre: la 2 antes que la 5.
    const mapa = reordenarPorHora([
      { numero: 5, horaInicio: null },
      { numero: 1, horaInicio: "10:00" },
      { numero: 2, horaInicio: null },
    ]);
    expect(mapa.get(1)).toBe(1); // la única con hora, va primera
    expect(mapa.get(2)).toBe(2);
    expect(mapa.get(5)).toBe(3);
  });

  it("si ya estaban en orden, el mapa no cambia ningún número", () => {
    const rutas = [
      { numero: 1, horaInicio: "10:00" },
      { numero: 2, horaInicio: "11:00" },
    ];
    const mapa = reordenarPorHora(rutas);
    expect(rutas.every((r) => mapa.get(r.numero) === r.numero)).toBe(true);
  });
});

describe("reordenar las rutas de un día guardado", () => {
  it("renumera y no rompe la restricción de número único, aunque haya que cruzarlos", async () => {
    // La 1 y la 3 tienen que intercambiarse: sin las dos pasadas, la segunda
    // escritura chocaría con el número que todavía tiene la otra.
    await guardarRuta(FECHA, { numero: 1, horaInicio: "16:00", horaFin: "16:30" });
    await guardarRuta(FECHA, { numero: 2, horaInicio: "11:00", horaFin: "11:30" });
    await guardarRuta(FECHA, { numero: 3, horaInicio: "09:00", horaFin: "09:30" });

    const cambios = await reordenarRutasDelDia(FECHA);
    expect(cambios).toBe(2); // la 2 ya estaba bien puesta

    const j = await jornadaPorFecha(FECHA);
    expect(j!.rutas.map((r) => r.horaInicio)).toEqual(["09:00", "11:00", "16:00"]);
  });

  it("los pedidos siguen con su ruta: están enlazados por id, no por número", async () => {
    await guardarJornada(
      {
        fecha: FECHA, rutasDeclaradas: 2, ordenesDeclaradas: 1, validacionOk: true,
        horaEntrada: "09:00", horaSalida: "22:00", tiendaId: null, vehiculo: "auto",
        rutas: [
          { numero: 1, estado: "Finalizado", horaInicio: "16:00", horaFin: "16:30" },
          { numero: 2, estado: "Finalizado", horaInicio: "09:00", horaFin: "09:30" },
        ],
        ordenes: [
          { codigo: "v11111111wofp-01", estado: "Entregado", posicion: 1, ruta: 1, tramo: 1, km: null, montoCentimos: 1000 },
        ],
      },
      "reemplazar",
    );
    await reordenarRutasDelDia(FECHA);

    const j = await jornadaPorFecha(FECHA);
    // La ruta de las 16:00 pasa a ser la 2, y el pedido la sigue.
    const suRuta = j!.rutas.find((r) => r.horaInicio === "16:00")!;
    expect(suRuta.numero).toBe(2);
    expect(j!.ordenes[0].ruta).toBe(2);
  });

  it("si ya estaban en orden, no cambia nada y lo dice", async () => {
    await guardarRuta(FECHA, { numero: 1, horaInicio: "09:00", horaFin: "09:30" });
    await guardarRuta(FECHA, { numero: 2, horaInicio: "10:00", horaFin: "10:30" });
    expect(await reordenarRutasDelDia(FECHA)).toBe(0);
  });

  it("un día sin rutas no revienta", async () => {
    expect(await reordenarRutasDelDia(FECHA)).toBe(0);
  });
});
