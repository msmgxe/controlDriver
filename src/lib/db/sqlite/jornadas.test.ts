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
  quitarDeDiasPosteriores,
  agregarPedidoManual,
  agregarPedidosLeidos,
  borrarPedido,
  borrarJornada,
  buscarPedidos,
  codigosYaRegistrados,
  guardarJornada,
  jornadaPorFecha,
  resumenPorRango,
} from "./jornadas";
import { REGLA_INICIAL, pagoDelTramo } from "@/lib/pagos/reglas";
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

describe("un pedido vive en el día más antiguo en que aparece", () => {
  /* La app de reparto abre cada día con las rutas de la noche anterior. Si se
     carga el 18 antes que el 17, el 18 se queda con pedidos que son del 17. Al
     guardar el 17 hay que quitárselos al 18, o se cobrarían dos veces. */
  it("al guardar un día se le quitan sus pedidos al día posterior", async () => {
    await guardarJornada(jornadaDe("2026-09-18", 2, 4), "reemplazar");
    const delDieciocho = (await jornadaPorFecha("2026-09-18" as FechaISO))!.ordenes;
    const compartido = delDieciocho[0].codigo;

    const movidos = await quitarDeDiasPosteriores("2026-09-17" as FechaISO, [compartido]);

    expect(movidos).toEqual([{ codigo: compartido, fecha: "2026-09-18" }]);
    const despues = await jornadaPorFecha("2026-09-18" as FechaISO);
    expect(despues!.ordenes.some((o) => o.codigo === compartido)).toBe(false);
    expect(despues!.ordenes).toHaveLength(3);
  });

  it("no toca los días anteriores ni el mismo día", async () => {
    await guardarJornada(jornadaDe("2026-09-16", 2, 4), "reemplazar");
    const codigos = (await jornadaPorFecha("2026-09-16" as FechaISO))!.ordenes.map((o) => o.codigo);

    expect(await quitarDeDiasPosteriores("2026-09-17" as FechaISO, codigos)).toEqual([]);
    expect(await quitarDeDiasPosteriores("2026-09-16" as FechaISO, codigos)).toEqual([]);
    expect((await jornadaPorFecha("2026-09-16" as FechaISO))!.ordenes).toHaveLength(4);
  });

  it("deja bien los contadores del día al que se le quitó", async () => {
    await guardarJornada(jornadaDe("2026-09-18", 2, 4), "reemplazar");
    const uno = (await jornadaPorFecha("2026-09-18" as FechaISO))!.ordenes[0].codigo;
    await quitarDeDiasPosteriores("2026-09-17" as FechaISO, [uno]);
    expect((await jornadaPorFecha("2026-09-18" as FechaISO))!.entregado).toBe(3);
  });
});

describe("pedidos leídos de una foto: solo los nuevos", () => {
  const FECHA = "2026-09-16" as FechaISO;
  const leido = (n: number, ruta: number | null = 1, estado = "Entregado") => ({
    codigo: `v${n}wofp-01`,
    ruta,
    estado,
  });

  it("añade los que no estaban y deja fuera los que ya estaban en el día", async () => {
    // jornadaDe crea v100000…v100005.
    await guardarJornada(jornadaDe("2026-09-16", 3, 6), "reemplazar");

    const r = await agregarPedidosLeidos(FECHA, [leido(100004), leido(100005), leido(777), leido(778)]);

    expect(r.nuevos).toBe(2);
    expect(r.repetidos.map((x) => x.codigo).sort()).toEqual(["v100004wofp-01", "v100005wofp-01"]);
    expect((await jornadaPorFecha(FECHA))!.ordenes).toHaveLength(8);
  });

  it("subir la misma foto dos veces no duplica nada", async () => {
    await guardarJornada(jornadaDe("2026-09-16", 3, 6), "reemplazar");
    const foto = [leido(777), leido(778)];

    await agregarPedidosLeidos(FECHA, foto);
    const otra = await agregarPedidosLeidos(FECHA, foto);

    expect(otra.nuevos).toBe(0);
    expect(otra.repetidos).toHaveLength(2);
    expect((await jornadaPorFecha(FECHA))!.ordenes).toHaveLength(8);
  });

  it("un pedido registrado en otro día no se añade, y dice en qué día está", async () => {
    // Un pedido no se cobra dos veces: es el caso del arrastre de la noche anterior.
    await guardarJornada(jornadaDe("2026-09-15", 2, 2), "reemplazar");
    await guardarJornada(jornadaDe("2026-09-16", 2, 0), "reemplazar");

    const r = await agregarPedidosLeidos(FECHA, [leido(100001), leido(777)]);

    expect(r.repetidos).toEqual([{ codigo: "v100001wofp-01", fecha: "2026-09-15" }]);
    expect(r.nuevos).toBe(1);
    expect((await jornadaPorFecha(FECHA))!.ordenes.map((o) => o.codigo)).toEqual(["v777wofp-01"]);
  });

  it("un mismo código dos veces en la lista entra una sola", async () => {
    const r = await agregarPedidosLeidos(FECHA, [leido(777), leido(777)]);

    expect(r.nuevos).toBe(1);
    expect((await jornadaPorFecha(FECHA))!.ordenes).toHaveLength(1);
  });

  it("nacen en tramo 1, con su monto, y no cuentan como manuales", async () => {
    await agregarPedidosLeidos(FECHA, [leido(777, null)]);

    const [o] = (await jornadaPorFecha(FECHA))!.ordenes;
    expect(o.tramo).toBe(1);
    expect(o.montoCentimos).toBe(pagoDelTramo(REGLA_INICIAL, 1));
    expect(o.manual).toBe(false);
  });

  it("se enlazan con la ruta del día; si esa ruta no existe, entran sin ruta", async () => {
    await guardarJornada(jornadaDe("2026-09-16", 3, 0), "reemplazar");

    await agregarPedidosLeidos(FECHA, [leido(777, 2), leido(778, 9)]);

    const { ordenes } = (await jornadaPorFecha(FECHA))!;
    expect(ordenes.find((o) => o.codigo === "v777wofp-01")!.ruta).toBe(2);
    expect(ordenes.find((o) => o.codigo === "v778wofp-01")!.ruta).toBeNull();
  });

  it("van al final de lo que ya hay, en el orden de la foto", async () => {
    await guardarJornada(jornadaDe("2026-09-16", 1, 2), "reemplazar");

    await agregarPedidosLeidos(FECHA, [leido(777, null), leido(778, null)]);

    const { ordenes } = (await jornadaPorFecha(FECHA))!;
    const posicion = (c: string) => ordenes.find((o) => o.codigo === c)!.posicion;
    expect(posicion("v777wofp-01")).toBe(3);
    expect(posicion("v778wofp-01")).toBe(4);
  });

  it("crea el día si no existía, con los contadores de estado al día", async () => {
    await agregarPedidosLeidos(FECHA, [leido(777, null), leido(778, null, "No entregado")]);

    const j = await jornadaPorFecha(FECHA);
    expect(j).not.toBeNull();
    expect(j!.entregado).toBe(1);
    expect(j!.noEntregado).toBe(1);
  });

  it("una foto de puros repetidos no crea un día vacío", async () => {
    await guardarJornada(jornadaDe("2026-09-15", 1, 2), "reemplazar");

    const r = await agregarPedidosLeidos(FECHA, [leido(100000), leido(100001)]);

    expect(r.nuevos).toBe(0);
    expect(await jornadaPorFecha(FECHA)).toBeNull();
  });

  it("los pedidos nuevos entran en el total del día", async () => {
    await guardarJornada(jornadaDe("2026-09-16", 2, 2, 1000), "reemplazar");
    await agregarPedidosLeidos(FECHA, [leido(777), leido(778)]);

    const [dia] = await resumenPorRango(FECHA, FECHA);
    expect(dia.pedidos).toBe(4);
  });
});

describe("buscarPedidos en un rango de días", () => {
  async function tresDias() {
    await guardarJornada(jornadaDe("2026-09-14", 2, 4), "reemplazar");
    await guardarJornada(jornadaDe("2026-09-16", 2, 4), "reemplazar");
    await guardarJornada(jornadaDe("2026-09-20", 2, 4), "reemplazar");
  }

  it("solo devuelve los pedidos de los días del rango", async () => {
    await tresDias();
    const r = await buscarPedidos("", { desde: "2026-09-15" as FechaISO, hasta: "2026-09-19" as FechaISO });
    expect(r).toHaveLength(4);
    expect(new Set(r.map((p) => p.fecha))).toEqual(new Set(["2026-09-16"]));
  });

  it("los extremos del rango cuentan", async () => {
    await tresDias();
    const r = await buscarPedidos("", { desde: "2026-09-14" as FechaISO, hasta: "2026-09-16" as FechaISO });
    expect(new Set(r.map((p) => p.fecha))).toEqual(new Set(["2026-09-14", "2026-09-16"]));
  });

  it("con rango, el texto puede ser corto: el rango ya acota", async () => {
    await tresDias();
    // Sin rango, dos caracteres no buscan nada; con rango sí.
    expect(await buscarPedidos("10")).toEqual([]);
    const r = await buscarPedidos("10", { desde: "2026-09-14" as FechaISO, hasta: "2026-09-20" as FechaISO });
    expect(r.length).toBeGreaterThan(0);
  });

  it("texto y rango juntos se exigen los dos", async () => {
    await tresDias();
    const r = await buscarPedidos("100001", { desde: "2026-09-15" as FechaISO, hasta: "2026-09-17" as FechaISO });
    expect(r.map((p) => [p.codigo, p.fecha])).toEqual([["v100001wofp-01", "2026-09-16"]]);
  });

  it("lo más reciente primero, y los pedidos de un día en el orden de la app", async () => {
    await tresDias();
    const r = await buscarPedidos("", { desde: "2026-09-14" as FechaISO, hasta: "2026-09-20" as FechaISO });
    expect(r[0].fecha).toBe("2026-09-20");
    expect(r.slice(0, 4).map((p) => p.codigo)).toEqual([
      "v100000wofp-01", "v100001wofp-01", "v100002wofp-01", "v100003wofp-01",
    ]);
  });

  it("un rango sin pedidos devuelve una lista vacía", async () => {
    await tresDias();
    expect(await buscarPedidos("", { desde: "2026-09-01" as FechaISO, hasta: "2026-09-10" as FechaISO })).toEqual([]);
  });
});
