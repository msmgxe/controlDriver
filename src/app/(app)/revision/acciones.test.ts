/**
 * Confirmar una jornada revisada, contra SQLite de verdad.
 *
 * Dos cosas que fallaron con un teléfono real y que aquí se fijan:
 *
 *   · **La moto se guardaba como auto.** La pantalla enseñaba la tarifa de la
 *     moto, pero `confirmarJornada` calculaba los montos sin decir el vehículo,
 *     y `reglaVigente` sin vehículo cae en auto.
 *   · **Subir una captura mejor de un pedido borraba el resto del día.** Lo
 *     leído se guardaba con «reemplazar» sin saber qué había ya guardado.
 */
import { beforeEach, describe, expect, it } from "vitest";

import { usarMotor } from "@/lib/db/sqlite/conexion";
import { jornadaPorFecha, reglaVigente } from "@/lib/db/sqlite/jornadas";
import { motorEnMemoria } from "@/lib/db/sqlite/motor-en-memoria";
import { guardarPerfil, guardarRegla, listarTiendas, perfilActual, sembrarSiHaceFalta } from "@/lib/db/sqlite/perfil";
import { capturaDeLoGuardado } from "@/lib/extraccion/combinar";
import { fusionarCapturas } from "@/lib/extraccion/fusionar";
import { validarJornada } from "@/lib/extraccion/validar";
import type { FechaISO } from "@/lib/fechas";
import { TARIFA_MOTO_ELECTRICA, reglaTarifaUnica } from "@/lib/pagos/reglas";

import { confirmarJornada } from "./acciones";

const FECHA = "2026-09-16" as FechaISO;

const ruta = (numero: number, inicio: string, fin: string) => ({
  numero,
  estado: "Finalizado",
  horaInicio: inicio,
  horaFin: fin,
});

const pedido = (codigo: string, posicion: number, r: number | null, tramo = 1, km: number | null = null) => ({
  codigo,
  estado: "Entregado",
  posicion,
  ruta: r,
  tramo,
  km,
  montoManualCentimos: null,
});

function envio(cambios: Record<string, unknown> = {}) {
  return {
    fecha: FECHA,
    rutasDeclaradas: 2,
    ordenesDeclaradas: 4,
    validacionOk: true,
    modo: "reemplazar",
    horaEntrada: "09:00",
    horaSalida: "22:00",
    rutas: [ruta(1, "10:00", "10:30"), ruta(2, "11:00", "11:30")],
    ordenes: [
      pedido("v12268269wofp-01", 1, 1),
      pedido("v12269477wofp-01", 2, 1),
      pedido("v12269031wofp-01", 3, 2),
      pedido("v12269570wofp-01", 4, 2),
    ],
    uso: null,
    ...cambios,
  };
}

beforeEach(async () => {
  usarMotor(motorEnMemoria());
  await sembrarSiHaceFalta();
});

async function ponerModo(vehiculo: "auto" | "moto") {
  const perfil = (await perfilActual())!;
  const [tienda] = await listarTiendas();
  if (vehiculo === "moto") {
    await guardarRegla(tienda.id, "moto", "2000-01-01", reglaTarifaUnica(TARIFA_MOTO_ELECTRICA));
  }
  await guardarPerfil({ nombre: perfil.nombre, vehiculo });
}

describe("el vehículo al confirmar", () => {
  it("un auto cobra por la tabla de tramos", async () => {
    await ponerModo("auto");
    expect(await confirmarJornada(envio())).toEqual({ ok: true, fecha: FECHA });

    const dia = (await jornadaPorFecha(FECHA))!;
    expect(dia.vehiculo).toBe("auto");
    expect(dia.ordenes.map((o) => o.montoCentimos)).toEqual([1000, 1000, 1000, 1000]);
  });

  it("una moto cobra su tarifa, no la del auto", async () => {
    await ponerModo("moto");
    expect(await confirmarJornada(envio())).toEqual({ ok: true, fecha: FECHA });

    const dia = (await jornadaPorFecha(FECHA))!;
    expect(dia.vehiculo).toBe("moto");
    expect(dia.ordenes.map((o) => o.montoCentimos)).toEqual([600, 600, 600, 600]);
  });

  it("una moto que aún no tiene tarifa guardada cobra la de la moto, no cae en auto", async () => {
    const perfil = (await perfilActual())!;
    await guardarPerfil({ nombre: perfil.nombre, vehiculo: "moto" });
    const [tienda] = await listarTiendas();
    // Sin ninguna regla de moto en la base.
    const { id, regla } = await reglaVigente(FECHA, tienda.id, "moto");
    expect(id).toBeNull();
    expect(regla.tramos).toHaveLength(1);
    expect(regla.tramos[0].monto).toBe(TARIFA_MOTO_ELECTRICA);

    expect(await confirmarJornada(envio())).toEqual({ ok: true, fecha: FECHA });
    const dia = (await jornadaPorFecha(FECHA))!;
    expect(dia.ordenes.map((o) => o.montoCentimos)).toEqual([600, 600, 600, 600]);
  });
});

describe("subir más capturas de un día que ya estaba guardado", () => {
  beforeEach(async () => {
    await ponerModo("auto");
    // El día tal como quedó tras la primera carga: 4 de 5, sin el wpet de la ruta 2.
    await confirmarJornada(envio({ ordenesDeclaradas: 5 }));
  });

  /** Una captura de sobra: solo 2 pedidos, sin rutas, con el que faltaba. */
  const captura = {
    tipo_pantalla: "ordenes" as const,
    fecha: FECHA,
    contador_rutas: null,
    contador_ordenes: 5,
    resumen_ordenes: null,
    rutas: [],
    ordenes: [
      { codigo: "v12269031wofp-01", ruta: 2, estado: "Entregado", legible_completo: true },
      { codigo: "wpet-12268585-01", ruta: 2, estado: "Entregado", legible_completo: true },
    ],
  };

  it("lo guardado entra primero y lo nuevo se suma, sin perder nada", async () => {
    const guardada = (await jornadaPorFecha(FECHA))!;
    const fusionada = fusionarCapturas([capturaDeLoGuardado(guardada), captura]);

    expect(fusionada.ordenes.map((o) => o.codigo)).toEqual([
      "v12268269wofp-01",
      "v12269477wofp-01",
      "v12269031wofp-01",
      "v12269570wofp-01",
      "wpet-12268585-01",
    ]);
    expect(fusionada.rutas.map((r) => r.numero)).toEqual([1, 2]);
    expect(fusionada.contadorOrdenes).toBe(5);
    expect(fusionada.contadorRutas).toBe(2);
  });

  it("con lo guardado, la validación ya no dice que faltan pedidos ni rutas", async () => {
    const guardada = (await jornadaPorFecha(FECHA))!;
    const fusionada = fusionarCapturas([capturaDeLoGuardado(guardada), captura]);
    const alertas = validarJornada(fusionada, { hoy: "2026-09-25" as FechaISO });

    expect(alertas.map((a) => a.codigo)).not.toContain("faltan-capturas-ordenes");
    expect(alertas.map((a) => a.codigo)).not.toContain("faltan-capturas-rutas");
    expect(alertas.map((a) => a.codigo)).not.toContain("codigo-formato");
  });

  it("solo la captura nueva, sin sumar, sí dejaba el día incompleto: por eso se suma", async () => {
    const sola = fusionarCapturas([captura]);
    const alertas = validarJornada(sola, { hoy: "2026-09-25" as FechaISO });
    expect(alertas.map((a) => a.codigo)).toContain("faltan-capturas-ordenes");
  });

  it("guardar lo sumado deja los cinco pedidos y las dos rutas", async () => {
    const guardada = (await jornadaPorFecha(FECHA))!;
    const fusionada = fusionarCapturas([capturaDeLoGuardado(guardada), captura]);

    const r = await confirmarJornada(
      envio({
        ordenesDeclaradas: 5,
        rutas: fusionada.rutas.map((x) => ({
          numero: x.numero,
          estado: x.estado,
          horaInicio: x.hora_inicio,
          horaFin: x.hora_fin,
        })),
        ordenes: fusionada.ordenes.map((o, i) => pedido(o.codigo, i + 1, o.ruta)),
      }),
    );
    expect(r).toEqual({ ok: true, fecha: FECHA });

    const dia = (await jornadaPorFecha(FECHA))!;
    expect(dia.ordenes).toHaveLength(5);
    expect(dia.ordenes.find((o) => o.codigo === "wpet-12268585-01")?.ruta).toBe(2);
    expect(dia.rutas.map((x) => x.numero)).toEqual([1, 2]);
    expect(dia.entregado).toBe(5);
  });

  it("un pedido ya guardado con su tramo lo conserva al sumar", async () => {
    // Un pedido de más de 3 km, elegido a mano antes.
    await confirmarJornada(
      envio({
        ordenesDeclaradas: 5,
        ordenes: [
          pedido("v12268269wofp-01", 1, 1, 2),
          pedido("v12269477wofp-01", 2, 1),
          pedido("v12269031wofp-01", 3, 2),
          pedido("v12269570wofp-01", 4, 2),
        ],
      }),
    );
    const guardada = (await jornadaPorFecha(FECHA))!;
    const previo = guardada.ordenes.find((o) => o.codigo === "v12268269wofp-01")!;
    expect(previo.tramo).toBe(2);
    expect(previo.montoCentimos).toBe(1150);

    // Revisión trae el tramo guardado de vuelta y el día se reemplaza con la suma.
    const fusionada = fusionarCapturas([capturaDeLoGuardado(guardada), captura]);
    await confirmarJornada(
      envio({
        ordenesDeclaradas: 5,
        rutas: fusionada.rutas.map((x) => ({ numero: x.numero, estado: x.estado, horaInicio: x.hora_inicio, horaFin: x.hora_fin })),
        ordenes: fusionada.ordenes.map((o, i) => {
          const g = guardada.ordenes.find((x) => x.codigo === o.codigo);
          return pedido(o.codigo, i + 1, o.ruta, g?.tramo ?? 1, g?.km ?? null);
        }),
      }),
    );
    const dia = (await jornadaPorFecha(FECHA))!;
    expect(dia.ordenes.find((o) => o.codigo === "v12268269wofp-01")).toMatchObject({ tramo: 2, montoCentimos: 1150 });
  });
});

describe("combinar: añade sin tocar lo que ya había", () => {
  beforeEach(async () => {
    await ponerModo("auto");
    await confirmarJornada(envio({ ordenesDeclaradas: 5 }));
  });

  it("no borra los pedidos ni las rutas que la carga no trae", async () => {
    const r = await confirmarJornada(
      envio({
        modo: "combinar",
        rutasDeclaradas: null,
        ordenesDeclaradas: null,
        horaEntrada: null,
        horaSalida: null,
        rutas: [],
        ordenes: [pedido("wpet-12268585-01", 1, 2)],
      }),
    );
    expect(r).toEqual({ ok: true, fecha: FECHA });

    const dia = (await jornadaPorFecha(FECHA))!;
    expect(dia.ordenes.map((o) => o.codigo).sort()).toEqual([
      "v12268269wofp-01",
      "v12269031wofp-01",
      "v12269477wofp-01",
      "v12269570wofp-01",
      "wpet-12268585-01",
    ]);
    expect(dia.rutas).toHaveLength(2);
  });

  it("conserva los contadores declarados y las horas de la tienda", async () => {
    await confirmarJornada(
      envio({
        modo: "combinar",
        rutasDeclaradas: null,
        ordenesDeclaradas: null,
        horaEntrada: null,
        horaSalida: null,
        rutas: [],
        ordenes: [pedido("wpet-12268585-01", 1, 2)],
      }),
    );
    const dia = (await jornadaPorFecha(FECHA))!;
    expect(dia.rutasDeclaradas).toBe(2);
    expect(dia.ordenesDeclaradas).toBe(5);
    expect(dia.horaEntrada).toBe("09:00");
    expect(dia.horaSalida).toBe("22:00");
  });

  it("un pedido que ya estaba conserva su estado y su tramo; solo se le pone la ruta que no tenía", async () => {
    await confirmarJornada(
      envio({
        modo: "reemplazar",
        ordenesDeclaradas: 5,
        ordenes: [
          { ...pedido("v12268269wofp-01", 1, null, 2), estado: "No entregado" },
          pedido("v12269477wofp-01", 2, 1),
        ],
      }),
    );
    await confirmarJornada(
      envio({
        modo: "combinar",
        ordenes: [
          // La captura lo ve «Entregado», en tramo 1 y en la ruta 1.
          pedido("v12268269wofp-01", 1, 1),
        ],
      }),
    );
    const o = (await jornadaPorFecha(FECHA))!.ordenes.find((x) => x.codigo === "v12268269wofp-01")!;
    expect(o.estado).toBe("No entregado");
    expect(o.tramo).toBe(2);
    expect(o.ruta).toBe(1);
  });

  it("recuenta los estados del día con todo lo que hay, no solo con lo que trae la carga", async () => {
    await confirmarJornada(envio({ modo: "combinar", ordenes: [pedido("wpet-12268585-01", 1, 2)] }));
    const dia = (await jornadaPorFecha(FECHA))!;
    expect(dia.entregado).toBe(5);
  });
});
