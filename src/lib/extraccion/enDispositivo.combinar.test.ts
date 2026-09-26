/**
 * Subir una captura de un día que **ya estaba guardado**.
 *
 * Es el caso que falló con un teléfono real: se cargó el día entero, faltó un
 * pedido, y al subir una captura donde se leía mejor Revisión enseñó solo lo de
 * esa captura —«faltan 13 pedidos», «faltan rutas»— y al guardar se borró el
 * resto del día. Ahora lo guardado entra primero y lo leído se suma.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const CAPTURAS: Record<string, string[]> = {};

vi.mock("@jcesarmobile/capacitor-ocr", () => ({
  Ocr: {
    process: async ({ image }: { image: string }) => ({
      results: (CAPTURAS[image] ?? []).map((text) => ({ text })),
    }),
  },
}));

class LectorDeArchivos {
  result: string | null = null;
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  readAsDataURL(blob: Blob) {
    void blob.text().then((t) => {
      this.result = t;
      this.onload?.();
    });
  }
}
vi.stubGlobal("FileReader", LectorDeArchivos);

import { usarMotor } from "@/lib/db/sqlite/conexion";
import { guardarJornada } from "@/lib/db/sqlite/jornadas";
import { motorEnMemoria } from "@/lib/db/sqlite/motor-en-memoria";
import { guardarPerfil, sembrarSiHaceFalta } from "@/lib/db/sqlite/perfil";
import type { JornadaParaGuardar } from "@/lib/db/tipos";
import type { FechaISO } from "@/lib/fechas";

import { leerCapturas } from "./enDispositivo";

const FECHA = "2026-09-16" as FechaISO;

const imagen = (nombre: string, lineas: string[]) => {
  CAPTURAS[nombre] = lineas;
  return { lectura: new Blob([nombre]), prueba: new Blob([nombre]) };
};

const orden = (codigo: string, posicion: number, ruta: number, tramo = 1, monto = 1000) => ({
  codigo,
  estado: "Entregado",
  posicion,
  ruta,
  tramo,
  km: null,
  montoCentimos: monto,
});

/** El día tal como quedó tras la primera carga: le falta el pedido wpet. */
const DIA_GUARDADO: JornadaParaGuardar = {
  fecha: FECHA,
  rutasDeclaradas: 2,
  ordenesDeclaradas: 5,
  validacionOk: false,
  horaEntrada: "08:30",
  horaSalida: "20:00",
  tiendaId: null,
  vehiculo: "auto",
  rutas: [
    { numero: 1, estado: "Finalizado", horaInicio: "10:00", horaFin: "10:30" },
    { numero: 2, estado: "Finalizado", horaInicio: "11:00", horaFin: "11:30" },
  ],
  ordenes: [
    orden("v12268269wofp-01", 1, 1, 2, 1150),
    orden("v12269477wofp-01", 2, 1),
    orden("v12269031wofp-01", 3, 2),
    orden("v12269570wofp-01", 4, 2),
  ],
};

// Una captura de sobra: se ve mejor, pero solo trae dos pedidos y ninguna ruta.
const CAPTURA_NUEVA = [
  "Resumen del 16/09/2026",
  "Rutas 2",
  "Órdenes 5",
  "Entregado 5",
  "Entrega parcial 0",
  "No entregado 0",
  "v12269031wofp-01",
  "Ruta 2",
  "Entregado",
  "wpet-12268585-01",
  "Ruta 2",
  "Entregado",
];

beforeEach(async () => {
  for (const k of Object.keys(CAPTURAS)) delete CAPTURAS[k];
  usarMotor(motorEnMemoria());
  await sembrarSiHaceFalta();
});

describe("leer capturas de un día que ya tenía datos", () => {
  beforeEach(async () => {
    await guardarJornada(DIA_GUARDADO, "reemplazar");
  });

  it("suma lo leído a lo guardado: los cinco pedidos y las dos rutas", async () => {
    const { dias } = await leerCapturas([imagen("nueva", CAPTURA_NUEVA)]);

    expect(dias).toHaveLength(1);
    expect(dias[0].jornada.ordenes.map((o) => o.codigo).sort()).toEqual([
      "v12268269wofp-01",
      "v12269031wofp-01",
      "v12269477wofp-01",
      "v12269570wofp-01",
      "wpet-12268585-01",
    ]);
    expect(dias[0].jornada.rutas.map((r) => r.numero)).toEqual([1, 2]);
  });

  it("dice qué había y qué añade", async () => {
    const { dias } = await leerCapturas([imagen("nueva", CAPTURA_NUEVA)]);

    expect(dias[0].combinado).toEqual({
      pedidos: 4,
      rutas: 2,
      pedidosNuevos: 1,
      rutasNuevas: 0,
      porCantidad: 0,
    });
  });

  it("ya no avisa de pedidos ni rutas que faltan", async () => {
    const { dias } = await leerCapturas([imagen("nueva", CAPTURA_NUEVA)]);
    const codigos = dias[0].alertas.map((a) => a.codigo);

    expect(codigos).not.toContain("faltan-capturas-ordenes");
    expect(codigos).not.toContain("faltan-capturas-rutas");
    expect(codigos).not.toContain("ruta-inexistente");
    expect(codigos).not.toContain("codigo-formato");
  });

  it("los pedidos que ya estaban conservan su tramo y su monto", async () => {
    const { dias } = await leerCapturas([imagen("nueva", CAPTURA_NUEVA)]);
    const ordenes = dias[0].jornada.ordenes;

    expect(ordenes.find((o) => o.codigo === "v12268269wofp-01")).toMatchObject({ tramo: 2, montoCentimos: 1150 });
    expect(ordenes.find((o) => o.codigo === "wpet-12268585-01")).toMatchObject({ tramo: 1, ruta: 2 });
  });

  it("las horas de la tienda son las del día guardado, no las del perfil", async () => {
    await guardarPerfil({ nombre: "Yo", horaEntrada: "09:00", horaSalida: "22:00" });
    const { dias } = await leerCapturas([imagen("nueva", CAPTURA_NUEVA)]);

    expect(dias[0].permanencia).toMatchObject({ horaEntrada: "08:30", horaSalida: "20:00" });
  });

  it("una captura sin nada nuevo lo dice y no cambia el día", async () => {
    const igual = ["Resumen del 16/09/2026", "v12269031wofp-01", "Ruta 2", "Entregado"];
    const { dias } = await leerCapturas([imagen("igual", igual)]);

    expect(dias[0].combinado).toMatchObject({ pedidosNuevos: 0, rutasNuevas: 0 });
    expect(dias[0].jornada.ordenes).toHaveLength(4);
  });
});

describe("leer capturas de un día que no estaba guardado", () => {
  it("se lee como siempre, sin aviso de suma", async () => {
    const { dias } = await leerCapturas([imagen("nueva", CAPTURA_NUEVA)]);

    expect(dias[0].combinado).toBeUndefined();
    expect(dias[0].jornada.ordenes.map((o) => o.codigo)).toEqual(["v12269031wofp-01", "wpet-12268585-01"]);
  });

  it("y el wpet se lee con su ruta y su estado", async () => {
    const { dias } = await leerCapturas([imagen("nueva", CAPTURA_NUEVA)]);

    expect(dias[0].jornada.ordenes.find((o) => o.codigo === "wpet-12268585-01")).toMatchObject({
      ruta: 2,
      estado: "Entregado",
    });
  });
});
