import { describe, expect, it } from "vitest";

import type { JornadaCompleta, OrdenFila } from "@/lib/db/tipos";
import type { FechaISO } from "@/lib/fechas";
import { esquemaReglaPago } from "@/lib/pagos/reglas";

import { generarPdfSemana } from "./pdf-semana";
import { armarSemana, destinoDe, nombreArchivoDeSemana, origenDe } from "./semana";

const aurora = esquemaReglaPago.parse({
  moneda: "PEN",
  base: "por_pedido",
  medida: "zona",
  tramos: [
    { id: 1, desde: 0, hasta: 0, monto: 9.5, nombre: "Miraflores" },
    { id: 2, desde: 0, hasta: 0, monto: 13, nombre: "Chorrillos" },
  ],
});

const pedido = (n: number, extra: Partial<OrdenFila> = {}): OrdenFila => ({
  id: `o${n}`,
  codigo: `v1000000${n}wofp-01`,
  estado: "Entregado",
  posicion: n,
  ruta: 1,
  tramo: 1,
  km: null,
  kmFuente: null,
  montoCentimos: 950,
  manual: false,
  cliente: null,
  tramoAuto: false,
  fotos: 0,
  origen: "captura",
  contado: false,
  bonoCentimos: 0,
  bonoNombre: null,
  ...extra,
});

const dia = (fecha: string, ordenes: OrdenFila[]): JornadaCompleta => ({
  id: fecha,
  fecha: fecha as FechaISO,
  rutasDeclaradas: 1,
  ordenesDeclaradas: ordenes.length,
  entregado: ordenes.length,
  parcial: 0,
  noEntregado: 0,
  validacionOk: true,
  horaEntrada: null,
  horaSalida: null,
  tiendaId: null,
  vehiculo: "auto",
  rutas: [],
  ordenes,
});

const semana = (jornadas: JornadaCompleta[]) =>
  armarSemana({ conductor: "Marco", tienda: "Wong Aurora", desde: "2026-11-02" as FechaISO, hasta: "2026-11-08" as FechaISO, jornadas, regla: aurora });

describe("reporte de pagos de la semana", () => {
  const jornadas = [
    dia("2026-11-03", [pedido(1, { contado: true }), pedido(2, { tramo: 2, montoCentimos: 1300, contado: true })]),
    dia("2026-11-02", [pedido(3, { manual: true, origen: "manual" }), pedido(4, { origen: "comanda", bonoCentimos: 200, bonoNombre: "CyberNow", montoCentimos: 1150, contado: true })]),
  ];

  it("ordena los días, calcula el subtotal por día y el total de la semana", () => {
    const s = semana(jornadas);
    expect(s.dias.map((d) => d.fecha)).toEqual(["2026-11-02", "2026-11-03"]);
    expect(s.dias.map((d) => d.subtotalCentimos)).toEqual([950 + 1150, 950 + 1300]);
    expect(s.totales).toMatchObject({ pedidos: 4, subtotalCentimos: 4350, pagadoCentimos: 4350 });
  });

  it("separa lo que la empresa contó de lo que no figura", () => {
    const s = semana(jornadas);
    expect(s.cotejado).toBe(true);
    expect(s.totales).toMatchObject({ contados: 3, noFiguran: 1, noFiguranCentimos: 950 });
    expect(semana([dia("2026-11-02", [pedido(1)])]).cotejado).toBe(false);
  });

  it("dice a dónde fue y cómo entró cada pedido", () => {
    expect(destinoDe(aurora, { tramo: 2 })).toBe("Chorrillos");
    expect(origenDe({ origen: "captura", manual: false })).toBe("Sistema");
    expect(origenDe({ origen: "comanda", manual: false })).toBe("Comanda");
    expect(origenDe({ origen: "captura", manual: true })).toBe("Manual");
  });

  it("un pedido sin código sale como «Sin código» y un día vacío no sale", () => {
    const s = semana([dia("2026-11-02", [pedido(1, { codigo: "pendiente-abc" })]), dia("2026-11-03", [])]);
    expect(s.dias).toHaveLength(1);
    expect(s.dias[0].pedidos[0].codigo).toBe("Sin código");
  });

  it("genera el PDF, completo y solo con los que no figuran", async () => {
    const s = semana(jornadas);
    const completo = await generarPdfSemana(s);
    const corto = await generarPdfSemana(s, { soloNoFiguran: true });
    expect(completo.size).toBeGreaterThan(1500);
    expect(corto.size).toBeGreaterThan(1500);
    expect(nombreArchivoDeSemana(s)).toBe("pagos_semana_2026-11-02_a_2026-11-08.pdf");
  });
});
