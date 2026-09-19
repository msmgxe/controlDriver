/**
 * El flujo real de un día, de punta a punta: capturas → lectura → fusión.
 *
 * Reproduce cómo se capturan de verdad las pantallas, que es lo que hizo
 * fallar las primeras versiones:
 *
 *   · **dos tipos de pantalla**: la de rutas y la de pedidos agrupados por ruta;
 *   · **se solapan** por el scroll: la misma ruta y el mismo pedido salen en
 *     dos capturas seguidas;
 *   · **la cabecera solo sale arriba**: las capturas de más abajo no traen la
 *     fecha ni, a veces, la `Ruta N` bajo la que siguen los pedidos;
 *   · **el lector no ve el círculo** con el número de ruta.
 *
 * El resultado tiene que ser exactamente el caso de §16.
 */
import { describe, expect, it } from "vitest";

import { fusionarCapturas } from "./fusionar";
import { interpretarConContexto, type ContextoEntreCapturas } from "./ocr";
import type { ImagenExtraida } from "./esquema";

/** Lee una serie de capturas pasando el contexto de una a otra, como el teléfono. */
function leerSerie(capturas: string[][]): ImagenExtraida[] {
  let contexto: ContextoEntreCapturas | undefined;
  return capturas.map((lineas) => {
    const r = interpretarConContexto(lineas, contexto);
    contexto = r.contexto;
    return r.imagen;
  });
}

const CABECERA = ["Resumen del 16/09/2026", "Rutas 7", "Órdenes 14"];

// Rutas, sin los números del círculo: el caso difícil.
const RUTAS_ARRIBA = [
  ...CABECERA,
  "Finalizado", "De: 10:03 a 10:27 horas",
  "Finalizado", "De: 11:04 a 11:22 horas",
  "Finalizado", "De: 12:09 a 12:24 horas",
  "Finalizado", "De: 13:20 a 14:00 horas",
];
// Se solapa con la anterior en las rutas de 12:09 y 13:20.
const RUTAS_ABAJO = [
  "Finalizado", "De: 12:09 a 12:24 horas",
  "Finalizado", "De: 13:20 a 14:00 horas",
  "Finalizado", "De: 15:12 a 15:42 horas",
  "Finalizado", "De: 16:52 a 17:10 horas",
  "Finalizado", "De: 18:20 a 18:57 horas",
];

// Pedidos agrupados por ruta: `Ruta N` una vez, arriba de su bloque.
const PEDIDOS_1 = [
  ...CABECERA,
  "14", "Entregado", "0", "Entrega parcial", "0", "No entregado",
  "Ruta 1",
  "v12238726wofp-01", "Entregado",
  "v12238812wofp-01", "Entregado",
  "Ruta 2",
  "v12239232wofp-01", "Entregado",
  "v12239089wofp-01", "Entregado",
  "Ruta 3",
  "v12239528wofp-01", "Entregado",
];
// Empieza a mitad de la ruta 3, sin su cabecera: la hereda de la anterior.
const PEDIDOS_2 = [
  "v12239528wofp-01", "Entregado",
  "v12239312wofp-01", "Entregado",
  "Ruta 4",
  "v12239582wofp-01", "Entregado",
  "v12239681wofp-01", "Entregado",
  "Ruta 5",
  "v12240224wofp-01", "Entregado",
  "v12237397wofp-01", "Entregado",
];
const PEDIDOS_3 = [
  "v12237397wofp-01", "Entregado",
  "Ruta 6",
  "v12240699wofp-01", "Entregado",
  "v12240588wofp-01", "Entregado",
  "Ruta 7",
  "v12240721wofp-01", "Entregado",
  "v12240765wofp-01", "Entregado",
];

const dia = fusionarCapturas(
  leerSerie([RUTAS_ARRIBA, RUTAS_ABAJO, PEDIDOS_1, PEDIDOS_2, PEDIDOS_3]),
);

describe("un día real, capturado como se captura", () => {
  it("siete rutas, ni una más ni una menos, aunque se solapen", () => {
    expect(dia.rutas).toHaveLength(7);
  });

  it("cada ruta conserva su horario: las solapadas no se pisan", () => {
    expect(dia.rutas.map((r) => `${r.numero} ${r.hora_inicio}`)).toEqual([
      "1 10:03",
      "2 11:04",
      "3 12:09",
      "4 13:20",
      "5 15:12",
      "6 16:52",
      "7 18:20",
    ]);
  });

  it("catorce pedidos: los repetidos por el scroll cuentan una vez", () => {
    expect(dia.ordenes).toHaveLength(14);
  });

  it("dos pedidos por ruta, como dice §16", () => {
    const porRuta = new Map<number | null, number>();
    for (const o of dia.ordenes) porRuta.set(o.ruta, (porRuta.get(o.ruta) ?? 0) + 1);
    expect([...porRuta.entries()].sort()).toEqual([
      [1, 2], [2, 2], [3, 2], [4, 2], [5, 2], [6, 2], [7, 2],
    ]);
  });

  it("ningún pedido queda sin ruta", () => {
    expect(dia.ordenes.filter((o) => o.ruta === null)).toEqual([]);
  });

  it("el pedido que empieza una captura sin cabecera hereda la ruta de la anterior", () => {
    expect(dia.ordenes.find((o) => o.codigo === "v12239312wofp-01")!.ruta).toBe(3);
  });

  it("todos entregados: ni uno en rojo", () => {
    expect(dia.ordenes.every((o) => o.estado === "Entregado")).toBe(true);
  });

  it("182 minutos en ruta, como dice §16", () => {
    const minutos = dia.rutas.reduce((s, r) => {
      const [hi, mi] = r.hora_inicio!.split(":").map(Number);
      const [hf, mf] = r.hora_fin!.split(":").map(Number);
      return s + (hf * 60 + mf) - (hi * 60 + mi);
    }, 0);
    expect(minutos).toBe(182);
  });

  it("la fecha sale de la cabecera", () => {
    expect(dia.fecha).toBe("2026-09-16");
  });
});

describe("las capturas pueden llegar desordenadas en tipo", () => {
  it("pedidos antes que rutas dan el mismo resultado", () => {
    const alReves = fusionarCapturas(
      leerSerie([PEDIDOS_1, PEDIDOS_2, PEDIDOS_3, RUTAS_ARRIBA, RUTAS_ABAJO]),
    );
    expect(alReves.rutas).toHaveLength(7);
    expect(alReves.ordenes).toHaveLength(14);
    expect(alReves.ordenes.every((o) => o.ruta !== null)).toBe(true);
  });

  it("una captura de rutas en medio no corta la cadena de pedidos", () => {
    const intercalado = fusionarCapturas(
      leerSerie([PEDIDOS_1, RUTAS_ARRIBA, PEDIDOS_2, RUTAS_ABAJO, PEDIDOS_3]),
    );
    expect(intercalado.ordenes.find((o) => o.codigo === "v12239312wofp-01")!.ruta).toBe(3);
  });
});

describe("con los números del círculo sí leídos", () => {
  it("se respetan tal cual", () => {
    const conNumeros = fusionarCapturas(
      leerSerie([
        [...CABECERA, "1", "Finalizado", "De: 10:03 a 10:27 horas",
          "2", "Finalizado", "De: 11:04 a 11:22 horas"],
      ]),
    );
    expect(conNumeros.rutas.map((r) => r.numero)).toEqual([1, 2]);
  });

  it("y rellenan los huecos de los que no se leyeron", () => {
    const mezclado = fusionarCapturas(
      leerSerie([
        ["5", "Finalizado", "De: 15:12 a 15:42 horas",
          "Finalizado", "De: 16:52 a 17:10 horas",
          "7", "Finalizado", "De: 18:20 a 18:57 horas"],
      ]),
    );
    expect(mezclado.rutas.map((r) => r.numero)).toEqual([5, 6, 7]);
  });
});
