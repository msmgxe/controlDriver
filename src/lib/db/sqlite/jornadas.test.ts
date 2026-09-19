/**
 * Pruebas de la capa de datos del celular, contra SQLite de verdad.
 *
 * No hay simulacros: cada prueba crea una base en memoria con el esquema real
 * y ejecuta las mismas consultas que correrán en el teléfono. Si una consulta
 * está mal escrita, aquí falla.
 */
import { beforeEach, describe, expect, it } from "vitest";

import { usarMotor } from "./conexion";
import { motorEnMemoria } from "./motor-en-memoria";
import {
  actualizarTramo,
  borrarJornada,
  buscarPedidos,
  codigosYaRegistrados,
  guardarJornada,
  jornadaPorFecha,
  resumenPorRango,
} from "./jornadas";
import type { JornadaParaGuardar } from "../tipos";
import type { FechaISO } from "@/lib/fechas";

beforeEach(() => usarMotor(motorEnMemoria()));

/** Una jornada de forma realista: N rutas y M pedidos repartidos entre ellas. */
function jornadaDe(
  fecha: string,
  rutas: number,
  pedidos: number,
  centimosPorPedido = 1000,
): JornadaParaGuardar {
  return {
    fecha: fecha as FechaISO,
    rutasDeclaradas: rutas,
    ordenesDeclaradas: pedidos,
    validacionOk: true,
    horaEntrada: "09:00",
    horaSalida: "22:00",
    tiendaId: null,
    vehiculo: "auto",
    rutas: Array.from({ length: rutas }, (_, i) => ({
      numero: i + 1,
      estado: "Finalizado",
      horaInicio: `${String(9 + i).padStart(2, "0")}:00`,
      horaFin: `${String(9 + i).padStart(2, "0")}:30`,
    })),
    ordenes: Array.from({ length: pedidos }, (_, i) => ({
      codigo: `v${100000 + i}wofp-01`,
      estado: "Entregado",
      posicion: i + 1,
      ruta: (i % rutas) + 1,
      tramo: 1,
      km: null,
      montoCentimos: centimosPorPedido,
    })),
  };
}

describe("guardar y leer", () => {
  it("devuelve la jornada tal como se guardó", async () => {
    await guardarJornada(jornadaDe("2026-09-16", 7, 14), "reemplazar");
    const j = await jornadaPorFecha("2026-09-16" as FechaISO);

    expect(j).not.toBeNull();
    expect(j!.rutas).toHaveLength(7);
    expect(j!.ordenes).toHaveLength(14);
    expect(j!.entregado).toBe(14);
    expect(j!.validacionOk).toBe(true);
    expect(j!.horaEntrada).toBe("09:00");
  });

  it("numera los pedidos con la ruta a la que pertenecen, no con su id", async () => {
    await guardarJornada(jornadaDe("2026-09-16", 3, 6), "reemplazar");
    const j = await jornadaPorFecha("2026-09-16" as FechaISO);
    expect(j!.ordenes.map((o) => o.ruta)).toEqual([1, 2, 3, 1, 2, 3]);
  });

  it("ordena rutas por número y pedidos por posición", async () => {
    await guardarJornada(jornadaDe("2026-09-16", 4, 8), "reemplazar");
    const j = await jornadaPorFecha("2026-09-16" as FechaISO);
    expect(j!.rutas.map((r) => r.numero)).toEqual([1, 2, 3, 4]);
    expect(j!.ordenes.map((o) => o.posicion)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
  });

  it("calcula la duración de cada ruta", async () => {
    await guardarJornada(jornadaDe("2026-09-16", 2, 2), "reemplazar");
    const j = await jornadaPorFecha("2026-09-16" as FechaISO);
    expect(j!.rutas.map((r) => r.duracionMin)).toEqual([30, 30]);
  });

  it("devuelve null si ese día no está cargado", async () => {
    expect(await jornadaPorFecha("2026-09-16" as FechaISO)).toBeNull();
  });
});

describe("el resumen diario no infla los totales", () => {
  /* Este es el error que hay que cazar: unir rutas y pedidos en una sola
     consulta multiplica las filas —12 × 6 = 72— y todas las sumas salen mal.
     El resultado parece plausible, que es lo que lo hace peligroso. */
  it("con 6 rutas y 12 pedidos cuenta 6 y 12, no 72", async () => {
    await guardarJornada(jornadaDe("2026-09-16", 6, 12, 1000), "reemplazar");
    const [dia] = await resumenPorRango("2026-09-16" as FechaISO, "2026-09-16" as FechaISO);

    expect(dia.rutas).toBe(6);
    expect(dia.pedidos).toBe(12);
    expect(dia.montoCentimos).toBe(12_000); // 12 × S/ 10, no 72 × S/ 10
  });

  it("suma los minutos en ruta una sola vez", async () => {
    await guardarJornada(jornadaDe("2026-09-16", 6, 12), "reemplazar");
    const [dia] = await resumenPorRango("2026-09-16" as FechaISO, "2026-09-16" as FechaISO);
    expect(dia.minutosEnRuta).toBe(6 * 30);
  });

  it("devuelve los días del rango en orden y solo esos", async () => {
    for (const f of ["2026-09-14", "2026-09-15", "2026-09-16", "2026-09-17"]) {
      await guardarJornada(jornadaDe(f, 2, 2), "reemplazar");
    }
    const filas = await resumenPorRango("2026-09-15" as FechaISO, "2026-09-16" as FechaISO);
    expect(filas.map((f) => f.fecha)).toEqual(["2026-09-15", "2026-09-16"]);
  });
});

describe("volver a cargar el mismo día", () => {
  it("reemplazar deja solo los pedidos de la carga nueva", async () => {
    await guardarJornada(jornadaDe("2026-09-16", 6, 12), "reemplazar");
    await guardarJornada(jornadaDe("2026-09-16", 3, 5), "reemplazar");

    const j = await jornadaPorFecha("2026-09-16" as FechaISO);
    expect(j!.ordenes).toHaveLength(5);
    expect(j!.rutas).toHaveLength(3);
  });

  it("combinar conserva los pedidos anteriores que no vuelven a venir", async () => {
    await guardarJornada(jornadaDe("2026-09-16", 6, 12), "reemplazar");
    await guardarJornada(jornadaDe("2026-09-16", 6, 5), "combinar");

    const j = await jornadaPorFecha("2026-09-16" as FechaISO);
    expect(j!.ordenes).toHaveLength(12);
  });

  it("no duplica la jornada: sigue habiendo una sola fila para esa fecha", async () => {
    await guardarJornada(jornadaDe("2026-09-16", 6, 12), "reemplazar");
    await guardarJornada(jornadaDe("2026-09-16", 6, 12), "reemplazar");
    const filas = await resumenPorRango("2026-09-16" as FechaISO, "2026-09-16" as FechaISO);
    expect(filas).toHaveLength(1);
  });
});

describe("búsqueda de pedidos", () => {
  beforeEach(async () => {
    await guardarJornada(jornadaDe("2026-09-16", 2, 4), "reemplazar");
  });

  it("encuentra por coincidencia parcial", async () => {
    const encontrados = await buscarPedidos("100001");
    expect(encontrados).toHaveLength(1);
    expect(encontrados[0].fecha).toBe("2026-09-16");
    expect(encontrados[0].ruta).toBe(2);
  });

  it("no busca con menos de tres caracteres", async () => {
    expect(await buscarPedidos("10")).toEqual([]);
  });

  it("trata el guion bajo como texto, no como comodín", async () => {
    // Sin escapar, `_` casa con cualquier carácter y esto devolvería todo.
    expect(await buscarPedidos("v10000_")).toEqual([]);
  });
});

describe("avisos y correcciones", () => {
  it("avisa de un código ya registrado en otra fecha", async () => {
    await guardarJornada(jornadaDe("2026-09-15", 2, 4), "reemplazar");
    const ya = await codigosYaRegistrados(["v100001wofp-01", "vNUEVOwofp-01"]);
    expect(ya["v100001wofp-01"]).toBe("2026-09-15");
    expect(ya["vNUEVOwofp-01"]).toBeUndefined();
  });

  it("cambiar el tramo de un pedido cambia su monto", async () => {
    await guardarJornada(jornadaDe("2026-09-16", 2, 4), "reemplazar");
    const antes = await jornadaPorFecha("2026-09-16" as FechaISO);
    await actualizarTramo(antes!.ordenes[0].id, 2, 1150, 8.4);

    const despues = await jornadaPorFecha("2026-09-16" as FechaISO);
    expect(despues!.ordenes[0].tramo).toBe(2);
    expect(despues!.ordenes[0].montoCentimos).toBe(1150);
    expect(despues!.ordenes[0].km).toBe(8.4);
  });

  it("borrar una jornada se lleva sus rutas y pedidos", async () => {
    await guardarJornada(jornadaDe("2026-09-16", 6, 12), "reemplazar");
    await borrarJornada("2026-09-16" as FechaISO);

    expect(await jornadaPorFecha("2026-09-16" as FechaISO)).toBeNull();
    expect(await buscarPedidos("100001")).toEqual([]);
  });
});
