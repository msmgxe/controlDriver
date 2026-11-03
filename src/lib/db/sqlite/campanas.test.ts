/**
 * Campañas (CyberNow…): bono por pedido automático en un rango de fechas, y bono
 * fijo que se cobra aparte al cumplir el horario.
 */
import { beforeEach, describe, expect, it } from "vitest";

import type { FechaISO } from "@/lib/fechas";

import { listarBloquesDelDia } from "./bloques-extra";
import { aplicarCampanasEnRango, borrarCampana, guardarCampana, listarCampanas, marcarBonoFijo, progresoDeHorario, resumenDeCampana } from "./campanas";
import { usarMotor } from "./conexion";
import { guardarJornada, jornadaPorFecha, jornadasPorRango } from "./jornadas";
import { motorEnMemoria } from "./motor-en-memoria";
import { aplicarBono, quitarBono } from "./pedidos";
import { guardarTienda } from "./perfil";
import type { JornadaParaGuardar } from "../tipos";

const dia = (fecha: string, codigos: string[], tiendaId: string | null = null): JornadaParaGuardar => ({
  fecha: fecha as FechaISO,
  rutasDeclaradas: 1,
  ordenesDeclaradas: codigos.length,
  validacionOk: true,
  horaEntrada: "09:00",
  horaSalida: "22:00",
  tiendaId,
  vehiculo: "auto",
  rutas: [{ numero: 1, estado: "Finalizado", horaInicio: "10:00", horaFin: "11:00" }],
  ordenes: codigos.map((c, i) => ({ codigo: c, estado: "Entregado", posicion: i + 1, ruta: 1, tramo: 1, km: null, montoCentimos: 950 })),
});

const montos = async (fecha: string) =>
  Object.fromEntries((await jornadaPorFecha(fecha as FechaISO))!.ordenes.map((o) => [o.codigo, o.montoCentimos]));

const base = { nombre: "CyberNow", tiendaId: null, desde: "2026-11-02" as FechaISO, hasta: "2026-11-08" as FechaISO, bonoPedidoCentimos: 200, bonoFijoCentimos: 0 };

beforeEach(() => usarMotor(motorEnMemoria()));

describe("bono por pedido de una campaña", () => {
  it("alcanza a los pedidos ya cargados dentro del rango y no a los de fuera", async () => {
    await guardarJornada(dia("2026-11-03", ["v10000001wofp-01", "v10000002wofp-01"]), "reemplazar");
    await guardarJornada(dia("2026-10-30", ["v10000003wofp-01"]), "reemplazar");
    const { resultado } = await guardarCampana(base);
    expect(resultado.aplicados).toBe(2);
    expect(await montos("2026-11-03")).toEqual({ "v10000001wofp-01": 1150, "v10000002wofp-01": 1150 });
    expect(await montos("2026-10-30")).toEqual({ "v10000003wofp-01": 950 });
  });

  it("alcanza a los que se cargan después, al leer el día", async () => {
    await guardarCampana(base);
    await guardarJornada(dia("2026-11-04", ["v10000004wofp-01"]), "reemplazar");
    await jornadasPorRango("2026-11-04" as FechaISO, "2026-11-04" as FechaISO);
    expect(await montos("2026-11-04")).toEqual({ "v10000004wofp-01": 1150 });
  });

  it("no se acumula al repetirse, y cambiar el monto lo ajusta", async () => {
    await guardarJornada(dia("2026-11-03", ["v10000001wofp-01"]), "reemplazar");
    const { id } = await guardarCampana(base);
    await aplicarCampanasEnRango("2026-11-03" as FechaISO, "2026-11-03" as FechaISO);
    await aplicarCampanasEnRango("2026-11-03" as FechaISO, "2026-11-03" as FechaISO);
    expect((await montos("2026-11-03"))["v10000001wofp-01"]).toBe(1150);
    await guardarCampana({ ...base, bonoPedidoCentimos: 300 }, id);
    expect((await montos("2026-11-03"))["v10000001wofp-01"]).toBe(1250);
    expect(await resumenDeCampana(id)).toEqual({ pedidos: 1, centimos: 300 });
  });

  it("respeta la tienda de la campaña", async () => {
    const aurora = await guardarTienda({ nombre: "Wong Aurora" });
    const otra = await guardarTienda({ nombre: "Wong - Aldabas" });
    await guardarJornada(dia("2026-11-03", ["v10000001wofp-01"], aurora), "reemplazar");
    await guardarJornada(dia("2026-11-04", ["v10000002wofp-01"], otra), "reemplazar");
    await guardarCampana({ ...base, tiendaId: aurora });
    expect((await montos("2026-11-03"))["v10000001wofp-01"]).toBe(1150);
    expect((await montos("2026-11-04"))["v10000002wofp-01"]).toBe(950);
  });

  it("lo que la persona quitó a mano no vuelve, y lo que puso a mano no se toca", async () => {
    await guardarJornada(dia("2026-11-03", ["v10000001wofp-01", "v10000002wofp-01"]), "reemplazar");
    const j = (await jornadaPorFecha("2026-11-03" as FechaISO))!.ordenes;
    await aplicarBono([j[1].id], 500, "Propio"); // a mano
    await guardarCampana(base);
    await quitarBono([j[0].id]); // quitado a mano: la campaña no se lo vuelve a poner
    await aplicarCampanasEnRango("2026-11-03" as FechaISO, "2026-11-03" as FechaISO, { forzar: true });
    expect(await montos("2026-11-03")).toEqual({ "v10000001wofp-01": 950, "v10000002wofp-01": 1450 });
  });

  it("una semana ya pagada no se toca", async () => {
    await guardarJornada(dia("2026-11-03", ["v10000001wofp-01"]), "reemplazar");
    const { ejecutar } = await import("./conexion");
    await ejecutar(
      `insert into liquidaciones (id, semana_inicio, semana_fin, fecha_pago, estado, monto_centimos, actualizado_en)
       values ('l1', '2026-11-02', '2026-11-08', '2026-11-13', 'pagada', 950, '2026-11-09T00:00:00Z')`,
      [],
    );
    const { resultado } = await guardarCampana(base);
    expect(resultado).toMatchObject({ aplicados: 0, omitidosPagada: 1 });
    expect((await montos("2026-11-03"))["v10000001wofp-01"]).toBe(950);
  });

  it("borrar la campaña quita los bonos que puso", async () => {
    await guardarJornada(dia("2026-11-03", ["v10000001wofp-01"]), "reemplazar");
    const { id } = await guardarCampana(base);
    await borrarCampana(id);
    expect((await montos("2026-11-03"))["v10000001wofp-01"]).toBe(950);
    expect(await listarCampanas()).toEqual([]);
  });

  it("valida fechas y montos", async () => {
    await expect(guardarCampana({ ...base, hasta: "2026-11-01" as FechaISO })).rejects.toThrow(/fechas/);
    await expect(guardarCampana({ ...base, bonoPedidoCentimos: 0, bonoFijoCentimos: 0 })).rejects.toThrow(/bono/);
  });
});

describe("bono fijo y horario (descansas martes y sábado)", () => {
  const conFijo = { ...base, bonoFijoCentimos: 10000, diasDescanso: [2, 6] }; // 2 = martes, 6 = sábado

  it("el horario son 5 días de 7: los de descanso no se exigen", async () => {
    await guardarJornada(dia("2026-11-02", ["v10000001wofp-01"]), "reemplazar"); // lunes
    await guardarJornada(dia("2026-11-04", ["v10000002wofp-01"]), "reemplazar"); // miércoles
    const { id } = await guardarCampana(conFijo);
    const c = (await listarCampanas()).find((x) => x.id === id)!;
    const p = await progresoDeHorario(c, "2026-11-05" as FechaISO);
    expect(p.requeridos).toHaveLength(5);
    expect(p.requeridos).not.toContain("2026-11-03"); // martes
    expect(p.requeridos).not.toContain("2026-11-07"); // sábado
    expect(p.cumplidos).toEqual(["2026-11-02", "2026-11-04"]);
    expect(p.faltan).toEqual(["2026-11-05", "2026-11-06", "2026-11-08"]);
    expect(p.terminada).toBe(false);
  });

  it("al marcarlo cumplido se registra como un adicional «Bono de campaña» y al desmarcarlo se quita", async () => {
    const { id } = await guardarCampana(conFijo);
    await marcarBonoFijo(id, true);
    const bloques = await listarBloquesDelDia("2026-11-08" as FechaISO);
    expect(bloques).toHaveLength(1);
    expect(bloques[0]).toMatchObject({ tipo: "taxi", montoCentimos: 10000, categoriaNombre: "Bono de campaña" });
    expect((await listarCampanas())[0].cumplido).toBe(true);

    await marcarBonoFijo(id, false);
    expect(await listarBloquesDelDia("2026-11-08" as FechaISO)).toHaveLength(0);
    expect((await listarCampanas())[0].cumplido).toBe(false);
  });

  it("borrar la campaña también quita el bono fijo ya registrado", async () => {
    const { id } = await guardarCampana(conFijo);
    await marcarBonoFijo(id, true);
    await borrarCampana(id);
    expect(await listarBloquesDelDia("2026-11-08" as FechaISO)).toHaveLength(0);
  });
});
