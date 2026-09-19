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
  agregarPedidoManual,
  borrarPedido,
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
    // Enseña el número de ruta, no su id; y agrupados por la hora de su ruta.
    expect(j!.ordenes.map((o) => o.ruta)).toEqual([1, 1, 2, 2, 3, 3]);
  });

  it("ordena rutas por número y pedidos por la hora de su ruta", async () => {
    await guardarJornada(jornadaDe("2026-09-16", 4, 8), "reemplazar");
    const j = await jornadaPorFecha("2026-09-16" as FechaISO);
    expect(j!.rutas.map((r) => r.numero)).toEqual([1, 2, 3, 4]);
    // Los pedidos 1 y 5 son de la ruta 1 (09:00), el 2 y el 6 de la 2…
    expect(j!.ordenes.map((o) => o.posicion)).toEqual([1, 5, 2, 6, 3, 7, 4, 8]);
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
    expect(dia.montoPedidosCentimos).toBe(12_000); // 12 × S/ 10, no 72 × S/ 10
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

describe("pedidos añadidos a mano", () => {
  const nuevo = {
    codigo: "v99999999wofp-01",
    ruta: 2,
    estado: "Entregado",
    tramo: 1,
    km: null,
    montoCentimos: 1000,
  };

  it("se añade a una jornada que ya existe", async () => {
    await guardarJornada(jornadaDe("2026-09-16", 3, 6), "reemplazar");
    await agregarPedidoManual("2026-09-16" as FechaISO, nuevo);

    const j = await jornadaPorFecha("2026-09-16" as FechaISO);
    expect(j!.ordenes).toHaveLength(7);
    expect(j!.ordenes.some((o) => o.codigo === "v99999999wofp-01")).toBe(true);
  });

  it("queda marcado como manual, para saber de dónde salió la cifra", async () => {
    await guardarJornada(jornadaDe("2026-09-16", 3, 6), "reemplazar");
    await agregarPedidoManual("2026-09-16" as FechaISO, nuevo);

    const j = await jornadaPorFecha("2026-09-16" as FechaISO);
    expect(j!.ordenes.find((o) => o.codigo === nuevo.codigo)!.manual).toBe(true);
    expect(j!.ordenes.find((o) => o.codigo !== nuevo.codigo)!.manual).toBe(false);
  });

  it("se enlaza con la ruta que se le indica", async () => {
    await guardarJornada(jornadaDe("2026-09-16", 3, 6), "reemplazar");
    await agregarPedidoManual("2026-09-16" as FechaISO, nuevo);

    const j = await jornadaPorFecha("2026-09-16" as FechaISO);
    expect(j!.ordenes.find((o) => o.codigo === nuevo.codigo)!.ruta).toBe(2);
  });

  it("crea la jornada si ese día no existía", async () => {
    // Registrar trabajo real no puede exigir subir una captura primero.
    await agregarPedidoManual("2026-09-20" as FechaISO, { ...nuevo, ruta: null });

    const j = await jornadaPorFecha("2026-09-20" as FechaISO);
    expect(j).not.toBeNull();
    expect(j!.ordenes).toHaveLength(1);
  });

  it("actualiza los contadores de estado del día", async () => {
    await guardarJornada(jornadaDe("2026-09-16", 2, 2), "reemplazar");
    await agregarPedidoManual("2026-09-16" as FechaISO, {
      ...nuevo,
      estado: "No entregado",
    });

    const j = await jornadaPorFecha("2026-09-16" as FechaISO);
    expect(j!.entregado).toBe(2);
    expect(j!.noEntregado).toBe(1);
  });

  it("añadir dos veces el mismo código actualiza, no duplica", async () => {
    await agregarPedidoManual("2026-09-20" as FechaISO, { ...nuevo, ruta: null });
    await agregarPedidoManual("2026-09-20" as FechaISO, {
      ...nuevo,
      ruta: null,
      tramo: 2,
      montoCentimos: 1150,
    });

    const j = await jornadaPorFecha("2026-09-20" as FechaISO);
    expect(j!.ordenes).toHaveLength(1);
    expect(j!.ordenes[0].tramo).toBe(2);
    expect(j!.ordenes[0].montoCentimos).toBe(1150);
  });

  it("se puede borrar, y los contadores vuelven a cuadrar", async () => {
    await guardarJornada(jornadaDe("2026-09-16", 2, 2), "reemplazar");
    await agregarPedidoManual("2026-09-16" as FechaISO, {
      ...nuevo,
      estado: "No entregado",
    });

    const antes = await jornadaPorFecha("2026-09-16" as FechaISO);
    const aBorrar = antes!.ordenes.find((o) => o.codigo === nuevo.codigo)!;
    await borrarPedido(aBorrar.id);

    const despues = await jornadaPorFecha("2026-09-16" as FechaISO);
    expect(despues!.ordenes).toHaveLength(2);
    expect(despues!.noEntregado).toBe(0);
    expect(despues!.entregado).toBe(2);
  });

  it("el monto del pedido manual entra en el total del día", async () => {
    await guardarJornada(jornadaDe("2026-09-16", 2, 2, 1000), "reemplazar");
    await agregarPedidoManual("2026-09-16" as FechaISO, { ...nuevo, montoCentimos: 1150 });

    const [dia] = await resumenPorRango("2026-09-16" as FechaISO, "2026-09-16" as FechaISO);
    expect(dia.montoPedidosCentimos).toBe(2 * 1000 + 1150);
  });
});

describe("orden de los pedidos", () => {
  it("van por la hora de salida de su ruta, no por el orden de lectura", async () => {
    const base = jornadaDe("2026-09-16", 2, 0);
    await guardarJornada(
      {
        ...base,
        rutas: [
          { numero: 1, estado: "Finalizado", horaInicio: "15:00", horaFin: "15:30" },
          { numero: 2, estado: "Finalizado", horaInicio: "10:00", horaFin: "10:30" },
        ],
        ordenes: [
          { codigo: "v11111111wofp-01", estado: "Entregado", posicion: 1, ruta: 1, tramo: 1, km: null, montoCentimos: 1000 },
          { codigo: "v22222222wofp-01", estado: "Entregado", posicion: 2, ruta: 2, tramo: 1, km: null, montoCentimos: 1000 },
          { codigo: "v33333333wofp-01", estado: "Entregado", posicion: 3, ruta: null, tramo: 1, km: null, montoCentimos: 1000 },
        ],
      },
      "reemplazar",
    );
    const j = await jornadaPorFecha("2026-09-16" as FechaISO);
    // La ruta 2 salió a las 10:00: sus pedidos van primero. Los sin ruta, al final.
    expect(j!.ordenes.map((o) => o.codigo)).toEqual([
      "v22222222wofp-01",
      "v11111111wofp-01",
      "v33333333wofp-01",
    ]);
  });
});

describe("el monto de un día es el mismo en todas las pantallas", () => {
  /* El error del día 17: Inicio enseñaba S/ 20 —la suma de dos pedidos— y el
     detalle S/ 130 —el piso de permanencia—. El resumen diario, que es lo que
     lee Inicio, tiene que dar lo que se cobra de verdad. */
  it("un día flojo cobra el piso de permanencia, no la suma de pedidos", async () => {
    // 2 pedidos × S/ 10 = S/ 20, pero de 9:00 a 22:00 son 13 h × S/ 10 = S/ 130.
    await guardarJornada(jornadaDe("2026-09-17", 1, 2, 1000), "reemplazar");
    const [dia] = await resumenPorRango("2026-09-17" as FechaISO, "2026-09-17" as FechaISO);

    expect(dia.montoPedidosCentimos).toBe(2_000);
    expect(dia.montoCentimos).toBe(13_000);
    expect(dia.pagaPor).toBe("permanencia");
  });

  it("un día bueno cobra los pedidos", async () => {
    await guardarJornada(jornadaDe("2026-09-17", 7, 15, 1000), "reemplazar");
    const [dia] = await resumenPorRango("2026-09-17" as FechaISO, "2026-09-17" as FechaISO);
    expect(dia.montoCentimos).toBe(15_000);
    expect(dia.pagaPor).toBe("pedidos");
  });
});
