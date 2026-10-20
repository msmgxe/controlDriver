import { describe, expect, it } from "vitest";

import type { BloqueExtraFila } from "@/lib/db/tipos";
import type { FechaISO } from "@/lib/fechas";

import { describirBloque, fuentesDe, totalesDe, tramosDe, type DatosExportacion } from "./datos";
import { generarPdf } from "./pdf";

const base = { posicion: 0, horaInicio: "10:00", horaFin: "12:00", notas: null };
const taxi: BloqueExtraFila = { ...base, id: "t", tipo: "taxi", origen: null, destino: null, km: 8.2, kmFuente: "manual", montoCentimos: 2200 };
const apoyo: BloqueExtraFila = { ...base, id: "a", tipo: "apoyo_hora", tiendaNombre: "Limatambo", tarifaHoraCentimos: 1800, horas: 2, motivo: null, montoCentimos: 3600 };

const datos: DatosExportacion = {
  driver: "Marco",
  tienda: "Wong",
  desde: "2026-09-28" as FechaISO,
  hasta: "2026-10-04" as FechaISO,
  bloques: [
    { fecha: "2026-10-02" as FechaISO, bloque: apoyo },
    { fecha: "2026-10-03" as FechaISO, bloque: taxi },
  ],
  jornadas: [
    {
      fecha: "2026-10-02" as FechaISO,
      rutas: [{ numero: 1, horaInicio: "10:00", horaFin: "11:00", duracionMin: 60, pedidos: 2 }],
      pedidos: [
        { posicion: 1, codigo: "v1", ruta: 1, horarioRuta: "10:00–11:00", estado: "Entregado", tramo: 1, km: 1, montoCentimos: 1000 },
        { posicion: 2, codigo: "v2", ruta: 1, horarioRuta: "10:00–11:00", estado: "Entregado", tramo: 2, km: 3, montoCentimos: 1150 },
      ],
      minutosEnRuta: 60,
      montoPedidosCentimos: 2150,
      montoPermanenciaCentimos: 0,
      montoCentimos: 2150,
      horasPermanencia: 0,
      pagaPor: "pedidos",
    },
  ],
};

describe("exportar con apoyo y taxi", () => {
  it("el total suma tienda, apoyo y taxi y dice cuánto es de cada uno", () => {
    expect(totalesDe(datos)).toMatchObject({ centimosTienda: 2150, centimosApoyo: 3600, centimosTaxi: 2200, centimos: 7950 });
  });

  it("las fuentes salen separadas", () => {
    expect(fuentesDe(datos).map((f) => [f.etiqueta, f.centimos])).toEqual([
      ["Tienda Wong", 2150],
      ["Apoyo · Limatambo", 3600],
      ["Adicionales · Taxi", 2200],
    ]);
  });

  it("los pedidos se reparten por tramo", () => {
    expect(tramosDe(datos)).toEqual([
      { tramo: 1, pedidos: 1, centimos: 1000 },
      { tramo: 2, pedidos: 1, centimos: 1150 },
    ]);
  });

  it("describe cada bloque", () => {
    expect(describirBloque(taxi)).toMatchObject({ tipo: "Adicional", detalle: "8.2 km", horario: "10:00–12:00" });
    expect(describirBloque(apoyo).detalle).toBe("2 h × S/ 18.00");
  });

  it("el PDF se genera con apoyo y taxi", async () => {
    const blob = await generarPdf(datos);
    expect(blob.size).toBeGreaterThan(2000);
  });
});
