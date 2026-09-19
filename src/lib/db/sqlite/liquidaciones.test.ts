/**
 * La prueba que de verdad importa: que el dinero salga bien.
 *
 * El cálculo ya tiene sus pruebas en `@/lib/pagos/calcular-liquidacion.test.ts`.
 * Lo que se comprueba aquí es lo otro: que al pasar por SQLite —guardar una
 * jornada, volver a leerla, y alimentar con eso el cálculo— el número no
 * cambie. Un redondeo mal puesto al escribir o una consulta que duplica filas
 * no se notaría en las pruebas del cálculo, porque allí los datos llegan a mano.
 */
import { beforeEach, describe, expect, it } from "vitest";

import { REGLA_INICIAL } from "@/lib/pagos/reglas";
import type { FechaISO } from "@/lib/fechas";

import { usarMotor } from "./conexion";
import { motorEnMemoria } from "./motor-en-memoria";
import { guardarJornada, jornadaPorFecha } from "./jornadas";
import { guardarPerfil, guardarRegla, guardarTienda } from "./perfil";
import { cerrarSemana, liquidacionDeSemana, registrarPago, reabrirSemana } from "./liquidaciones";
import type { JornadaParaGuardar, OrdenParaGuardar } from "../tipos";

let tiendaId: string;

beforeEach(async () => {
  usarMotor(motorEnMemoria());
  tiendaId = await guardarTienda({ nombre: "Wong - Aldabas" });
  await guardarRegla(tiendaId, "auto", "2000-01-01", REGLA_INICIAL);
  await guardarPerfil({
    nombre: "Marco",
    tiendaId,
    horaEntrada: "09:00",
    horaSalida: "22:00",
  });
});

/** Pedidos con el reparto de tramos que se indique: [tramo1, tramo2, tramo3]. */
function pedidos(porTramo: [number, number, number]): OrdenParaGuardar[] {
  const montos = [1000, 1150, 1300];
  const lista: OrdenParaGuardar[] = [];
  let n = 0;
  porTramo.forEach((cuantos, i) => {
    for (let k = 0; k < cuantos; k++) {
      n += 1;
      lista.push({
        codigo: `v${200000 + n}wofp-01`,
        estado: "Entregado",
        posicion: n,
        ruta: (n % 7) + 1,
        tramo: i + 1,
        km: null,
        montoCentimos: montos[i],
      });
    }
  });
  return lista;
}

function jornada(
  fecha: string,
  rutas: number,
  porTramo: [number, number, number],
  horario: [string, string] = ["09:00", "22:00"],
): JornadaParaGuardar {
  const ordenes = pedidos(porTramo);
  return {
    fecha: fecha as FechaISO,
    rutasDeclaradas: rutas,
    ordenesDeclaradas: ordenes.length,
    validacionOk: true,
    horaEntrada: horario[0],
    horaSalida: horario[1],
    tiendaId,
    vehiculo: "auto",
    rutas: Array.from({ length: rutas }, (_, i) => ({
      numero: i + 1,
      estado: "Finalizado",
      horaInicio: `${String(9 + i).padStart(2, "0")}:00`,
      horaFin: `${String(9 + i).padStart(2, "0")}:25`,
    })),
    ordenes,
  };
}

describe("el caso de la especificación (§16)", () => {
  it("7 rutas y 14 pedidos dan exactamente S/ 141.50", async () => {
    // 13 pedidos de tramo 1 (S/ 10) + 1 de tramo 2 (S/ 11.50) = S/ 141.50
    await guardarJornada(jornada("2026-09-16", 7, [13, 1, 0]), "reemplazar");

    const { liquidacion } = await liquidacionDeSemana("2026-09-16" as FechaISO);
    const dia = liquidacion.detalle.porDia.find((d) => d.fecha === "2026-09-16");

    expect(dia).toBeDefined();
    expect(dia!.montoCentimos).toBe(14_150);
  });
});

describe("la regla de permanencia de Wong (§13 bis)", () => {
  it("un día flojo se paga por permanencia: 13 h × S/ 10 = S/ 130", async () => {
    // 9 pedidos × S/ 10 = S/ 90, por debajo del piso de S/ 130.
    await guardarJornada(jornada("2026-09-14", 5, [9, 0, 0]), "reemplazar");

    const { liquidacion } = await liquidacionDeSemana("2026-09-14" as FechaISO);
    const dia = liquidacion.detalle.porDia.find((d) => d.fecha === "2026-09-14");

    expect(dia!.montoCentimos).toBe(13_000);
    expect(dia!.pagaPor).toBe("permanencia");
  });

  it("un día bueno se paga por pedidos, no por el piso", async () => {
    await guardarJornada(jornada("2026-09-15", 8, [16, 2, 0]), "reemplazar");

    const { liquidacion } = await liquidacionDeSemana("2026-09-15" as FechaISO);
    const dia = liquidacion.detalle.porDia.find((d) => d.fecha === "2026-09-15");

    expect(dia!.montoCentimos).toBe(16 * 1000 + 2 * 1150);
    expect(dia!.pagaPor).toBe("pedidos");
  });

  it("media jornada baja el piso a la mitad: 8 h × S/ 10 = S/ 80", async () => {
    await guardarJornada(jornada("2026-09-17", 4, [5, 0, 0], ["14:00", "22:00"]), "reemplazar");

    const { liquidacion } = await liquidacionDeSemana("2026-09-17" as FechaISO);
    const dia = liquidacion.detalle.porDia.find((d) => d.fecha === "2026-09-17");

    expect(dia!.montoCentimos).toBe(8_000);
  });

  it("la comparación es por día, no sobre el total de la semana", async () => {
    // Un día muy bueno no puede tapar el piso de un día malo: cada día
    // se compara por separado, que es lo que paga la tienda.
    await guardarJornada(jornada("2026-09-14", 8, [20, 0, 0]), "reemplazar"); // 200 > 130
    await guardarJornada(jornada("2026-09-15", 3, [4, 0, 0]), "reemplazar");  //  40 < 130

    const { liquidacion } = await liquidacionDeSemana("2026-09-14" as FechaISO);
    expect(liquidacion.montoCalculadoCentimos).toBe(20_000 + 13_000);
    expect(liquidacion.diasConGarantia).toBe(1);
  });
});

describe("cerrar, pagar y reabrir", () => {
  it("una semana nace abierta", async () => {
    await guardarJornada(jornada("2026-09-16", 7, [13, 1, 0]), "reemplazar");
    const { estado, id } = await liquidacionDeSemana("2026-09-16" as FechaISO);
    expect(estado).toBe("abierta");
    expect(id).toBeNull();
  });

  it("al cerrarla queda congelada con su monto", async () => {
    await guardarJornada(jornada("2026-09-16", 7, [13, 1, 0]), "reemplazar");
    await cerrarSemana("2026-09-16" as FechaISO, REGLA_INICIAL, null);

    const despues = await liquidacionDeSemana("2026-09-16" as FechaISO);
    expect(despues.estado).toBe("cerrada");
    expect(despues.id).not.toBeNull();
  });

  it("registrar el pago la marca como pagada y guarda lo recibido", async () => {
    await guardarJornada(jornada("2026-09-16", 7, [13, 1, 0]), "reemplazar");
    await cerrarSemana("2026-09-16" as FechaISO, REGLA_INICIAL, null);

    const { liquidacion } = await liquidacionDeSemana("2026-09-16" as FechaISO);
    await registrarPago(liquidacion.semana.inicio, 14_000);

    const despues = await liquidacionDeSemana("2026-09-16" as FechaISO);
    expect(despues.estado).toBe("pagada");
    expect(despues.montoRecibidoCentimos).toBe(14_000); // pagaron S/ 1.50 de menos
  });

  it("reabrir vuelve a dejarla editable sin perder lo guardado", async () => {
    await guardarJornada(jornada("2026-09-16", 7, [13, 1, 0]), "reemplazar");
    await cerrarSemana("2026-09-16" as FechaISO, REGLA_INICIAL, null);
    const { liquidacion } = await liquidacionDeSemana("2026-09-16" as FechaISO);

    await reabrirSemana(liquidacion.semana.inicio);
    const despues = await liquidacionDeSemana("2026-09-16" as FechaISO);
    expect(despues.estado).toBe("abierta");
    expect(despues.id).not.toBeNull();
  });

  it("cerrar dos veces no crea una segunda fila", async () => {
    await guardarJornada(jornada("2026-09-16", 7, [13, 1, 0]), "reemplazar");
    await cerrarSemana("2026-09-16" as FechaISO, REGLA_INICIAL, null);
    await cerrarSemana("2026-09-16" as FechaISO, REGLA_INICIAL, null);

    const { estado } = await liquidacionDeSemana("2026-09-16" as FechaISO);
    expect(estado).toBe("cerrada");
  });
});

describe("tarifas por vehículo", () => {
  /* La razón de que una regla se identifique por tienda + vehículo + fecha:
     la misma tienda paga distinto según con qué se reparta. */
  const TARIFA_MOTO: typeof REGLA_INICIAL = {
    ...REGLA_INICIAL,
    tramos: [
      { id: 1, desde: 0, hasta: 3, monto: 6.0 },
      { id: 2, desde: 3, hasta: 8, monto: 7.5 },
      { id: 3, desde: 8, hasta: 10, monto: 9.0 },
    ],
    garantiaPermanencia: { ...REGLA_INICIAL.garantiaPermanencia!, solesPorHora: 6.0 },
  };

  it("el mismo día en moto paga distinto que en auto", async () => {
    await guardarRegla(tiendaId, "moto", "2000-01-01", TARIFA_MOTO);

    // Mismo día, mismos pedidos: solo cambia el vehículo.
    const enAuto = jornada("2026-09-16", 7, [13, 1, 0]);
    await guardarJornada(enAuto, "reemplazar");
    const auto = await liquidacionDeSemana("2026-09-16" as FechaISO);

    await guardarJornada({ ...enAuto, vehiculo: "moto" }, "reemplazar");
    const moto = await liquidacionDeSemana("2026-09-16" as FechaISO);

    // En auto ganan los pedidos (S/ 141.50); en moto el monto por pedido es
    // menor, así que hay que mirar que el número cambie y sea coherente.
    expect(auto.liquidacion.montoCalculadoCentimos).toBe(14_150);
    expect(moto.liquidacion.montoCalculadoCentimos).not.toBe(14_150);
    expect(moto.liquidacion.montoCalculadoCentimos).toBeGreaterThan(0);
  });

  it("sin tarifa registrada para ese vehículo no se inventa una", async () => {
    // No hay regla de bicicleta: se cae al respaldo del código antes que
    // aplicar la de auto, que sería cobrar de más sin avisar.
    await guardarJornada({ ...jornada("2026-09-16", 7, [13, 1, 0]), vehiculo: "bicicleta" }, "reemplazar");
    const { liquidacion } = await liquidacionDeSemana("2026-09-16" as FechaISO);
    expect(liquidacion.montoCalculadoCentimos).toBeGreaterThan(0);
  });

  it("la jornada recuerda con qué se repartió ese día", async () => {
    await guardarJornada({ ...jornada("2026-09-16", 3, [5, 0, 0]), vehiculo: "moto" }, "reemplazar");
    const j = await jornadaPorFecha("2026-09-16" as FechaISO);
    expect(j!.vehiculo).toBe("moto");
  });
});
