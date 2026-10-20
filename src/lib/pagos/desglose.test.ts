import { describe, expect, it } from "vitest";

import type { BloqueExtraFila } from "@/lib/db/tipos";

import { desglosePorFuente } from "./desglose";

const base = { posicion: 0, horaInicio: null, horaFin: null, notas: null };
const apoyoHora = (tienda: string, horas: number, centimos: number): BloqueExtraFila => ({
  ...base, id: `${tienda}${horas}`, tipo: "apoyo_hora", tiendaNombre: tienda, tarifaHoraCentimos: 1800, horas, motivo: null, montoCentimos: centimos,
});
const taxi = (km: number | null, centimos: number): BloqueExtraFila => ({
  ...base, id: `t${centimos}`, tipo: "taxi", origen: null, destino: null, km, kmFuente: "manual", montoCentimos: centimos,
});

describe("desglose por fuente", () => {
  it("separa tienda, cada tienda de apoyo y el taxi", () => {
    const filas = desglosePorFuente({
      tiendaNombre: "Wong",
      pedidosTienda: 33,
      centimosTienda: 33150,
      bloques: [apoyoHora("Limatambo", 11.25, 20250), taxi(8.2, 2200), taxi(null, 1800)],
    });
    expect(filas.map((f) => [f.categoria, f.etiqueta, f.detalle, f.centimos])).toEqual([
      ["tienda", "Tienda Wong", "33 pedidos", 33150],
      ["apoyo", "Apoyo · Limatambo", "11.25 h", 20250],
      ["taxi", "Adicionales · Taxi", "2 registros · 8.2 km", 4000],
    ]);
  });

  it("junta el apoyo de una misma tienda en varios días", () => {
    const filas = desglosePorFuente({
      tiendaNombre: null,
      pedidosTienda: 0,
      centimosTienda: 0,
      bloques: [apoyoHora("Limatambo", 4, 7200), apoyoHora("Limatambo", 6, 10800), apoyoHora("Plaza", 2, 3600)],
    });
    expect(filas).toHaveLength(2);
    expect(filas[0]).toMatchObject({ etiqueta: "Apoyo · Limatambo", detalle: "10 h", centimos: 18000 });
  });

  it("una fuente sin nada no sale", () => {
    expect(desglosePorFuente({ tiendaNombre: "Wong", pedidosTienda: 0, centimosTienda: 0, bloques: [] })).toEqual([]);
  });

  it("no repite «Tienda» si el nombre ya lo dice", () => {
    const [f] = desglosePorFuente({ tiendaNombre: "Tienda Wong", pedidosTienda: 1, centimosTienda: 1000, bloques: [] });
    expect(f.etiqueta).toBe("Tienda Wong");
  });
});
