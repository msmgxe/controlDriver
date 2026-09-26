/**
 * Guardar una comanda: completar un pedido que ya estaba, o crear uno nuevo.
 */
import { beforeEach, describe, expect, it } from "vitest";

import { AJUSTES_DE_COMANDAS_POR_DEFECTO, type AjustesDeComandas } from "@/lib/db/sqlite/ajustes";
import { usarMotor } from "@/lib/db/sqlite/conexion";
import { guardarJornada, jornadaPorFecha } from "@/lib/db/sqlite/jornadas";
import { cerrarSemana, registrarPago } from "@/lib/db/sqlite/liquidaciones";
import { motorEnMemoria } from "@/lib/db/sqlite/motor-en-memoria";
import { pedidosPorNumero } from "@/lib/db/sqlite/clientes";
import type { JornadaParaGuardar } from "@/lib/db/tipos";
import type { FechaISO } from "@/lib/fechas";
import { REGLA_INICIAL } from "@/lib/pagos/reglas";

import { guardarComanda, type ComandaParaGuardar } from "./guardar";

const FECHA = "2026-09-16" as FechaISO;

const dia: JornadaParaGuardar = {
  fecha: FECHA,
  rutasDeclaradas: 1,
  ordenesDeclaradas: 2,
  validacionOk: true,
  horaEntrada: "09:00",
  horaSalida: "22:00",
  tiendaId: null,
  vehiculo: "auto",
  rutas: [{ numero: 1, estado: "Finalizado", horaInicio: "10:00", horaFin: "10:30" }],
  ordenes: [
    { codigo: "v12264655wofp-01", estado: "Entregado", posicion: 1, ruta: 1, tramo: 1, km: null, montoCentimos: 1000 },
    { codigo: "v12261836wofp-01", estado: "Entregado", posicion: 2, ruta: 1, tramo: 3, km: null, montoCentimos: 1300 },
  ],
};

const fotos: Array<{ fecha: string; ordenId: string; bytes: number }> = [];
const deps = { guardarFoto: async (fecha: FechaISO, ordenId: string, imagen: Blob) => { fotos.push({ fecha, ordenId, bytes: imagen.size }); } };

const base: ComandaParaGuardar = {
  numero: "12264655",
  ordenExistenteId: null,
  fecha: FECHA,
  ruta: null,
  nombre: "Claudia Castro",
  telefono: "987 654 321",
  direccion: "Ca. Santa Carmela 182, SANTIAGO DE SURCO (CP 150140), LIMA,",
  punto: { lat: -12.1, lng: -76.99 },
  distancia: { km: 4.2, fuente: "recta", enLinea: 4.2 },
  montoManualCentimos: null,
  evidencia: async () => new Blob(["foto"]),
};

const ajustes = (cambios: Partial<AjustesDeComandas> = {}): AjustesDeComandas => ({ ...AJUSTES_DE_COMANDAS_POR_DEFECTO, ...cambios });
const ordenes = async () => (await jornadaPorFecha(FECHA))!.ordenes;
const ordenDe = async (codigo: string) => (await ordenes()).find((o) => o.codigo === codigo)!;

beforeEach(async () => {
  usarMotor(motorEnMemoria());
  fotos.length = 0;
  await guardarJornada(dia, "reemplazar");
});

describe("completar un pedido que ya estaba", () => {
  it("le añade cliente, distancia, tramo y foto", async () => {
    const existente = await ordenDe("v12264655wofp-01");
    const r = await guardarComanda({ ...base, ordenExistenteId: existente.id }, ajustes(), deps);

    expect(r).toMatchObject({ creado: false, tramo: 2, montoCentimos: 1150, km: 4.2, tramoDe: "auto" });
    const o = await ordenDe("v12264655wofp-01");
    expect(o.cliente).toMatchObject({ nombre: "Claudia Castro", telefono: "987 654 321", lat: -12.1, lng: -76.99 });
    expect(o).toMatchObject({ km: 4.2, kmFuente: "recta", tramo: 2, tramoAuto: true });
    expect(fotos).toEqual([{ fecha: FECHA, ordenId: existente.id, bytes: 4 }]);
  });

  it("no crea un pedido de más", async () => {
    const existente = await ordenDe("v12264655wofp-01");
    await guardarComanda({ ...base, ordenExistenteId: existente.id }, ajustes(), deps);
    expect(await ordenes()).toHaveLength(2);
  });

  it("un tramo elegido a mano manda sobre la distancia, que igual se guarda", async () => {
    const existente = await ordenDe("v12261836wofp-01"); // tramo 3, puesto por la persona
    const r = await guardarComanda({ ...base, numero: "12261836", ordenExistenteId: existente.id }, ajustes(), deps);
    expect(r).toMatchObject({ tramo: 3, montoCentimos: 1300, tramoDe: "respetado" });
    expect(await ordenDe("v12261836wofp-01")).toMatchObject({ km: 4.2, tramo: 3, tramoAuto: false });
  });

  it("un tramo que puso el cálculo se vuelve a calcular con la distancia nueva", async () => {
    const existente = await ordenDe("v12264655wofp-01");
    await guardarComanda({ ...base, ordenExistenteId: existente.id }, ajustes(), deps);
    const r = await guardarComanda({ ...base, ordenExistenteId: existente.id, distancia: { km: 8.5, fuente: "ruta", enLinea: 6 } }, ajustes(), deps);
    expect(r).toMatchObject({ tramo: 3, montoCentimos: 1300, tramoDe: "auto" });
    expect(await ordenDe("v12264655wofp-01")).toMatchObject({ km: 8.5, kmFuente: "ruta" });
  });

  it("con el cálculo automático apagado, guarda la distancia y deja el tramo", async () => {
    const existente = await ordenDe("v12264655wofp-01");
    const r = await guardarComanda({ ...base, ordenExistenteId: existente.id }, ajustes({ tramoAutomatico: false }), deps);
    expect(r).toMatchObject({ tramo: 1, montoCentimos: 1000, tramoDe: "apagado", km: 4.2 });
  });

  it("sin distancia, el tramo no cambia", async () => {
    const existente = await ordenDe("v12264655wofp-01");
    const r = await guardarComanda({ ...base, ordenExistenteId: existente.id, punto: null, distancia: null }, ajustes(), deps);
    expect(r).toMatchObject({ tramo: 1, tramoDe: "sin-distancia", km: null });
    expect((await ordenDe("v12264655wofp-01")).cliente?.lat).toBeNull();
  });
});

describe("más de 12 km", () => {
  const lejos = { km: 13.4, fuente: "ruta" as const, enLinea: 10 };

  it("sin monto no cambia el tramo ni el dinero, pero guarda la distancia", async () => {
    const existente = await ordenDe("v12264655wofp-01");
    const r = await guardarComanda({ ...base, ordenExistenteId: existente.id, distancia: lejos }, ajustes(), deps);
    expect(r).toMatchObject({ tramo: 1, montoCentimos: 1000, tramoDe: "falta-monto", km: 13.4 });
  });

  it("con el monto escrito, pasa al tramo abierto", async () => {
    const existente = await ordenDe("v12264655wofp-01");
    const r = await guardarComanda({ ...base, ordenExistenteId: existente.id, distancia: lejos, montoManualCentimos: 1800 }, ajustes(), deps);
    expect(r).toMatchObject({ tramo: 6, montoCentimos: 1800, tramoDe: "auto" });
  });
});

describe("crear un pedido nuevo", () => {
  it("con el código que sale del número de despacho", async () => {
    const r = await guardarComanda({ ...base, numero: "12269999", ruta: 1 }, ajustes(), deps);
    expect(r.creado).toBe(true);
    const o = await ordenDe("v12269999wofp-01");
    expect(o).toMatchObject({ ruta: 1, estado: "Entregado", manual: true, tramo: 2, montoCentimos: 1150 });
    expect(o.cliente?.nombre).toBe("Claudia Castro");
    expect(await ordenes()).toHaveLength(3);
  });

  it("puede crear el día si no existía", async () => {
    const r = await guardarComanda({ ...base, numero: "12269999", fecha: "2026-09-10" as FechaISO }, ajustes(), deps);
    expect(r.creado).toBe(true);
    expect((await jornadaPorFecha("2026-09-10" as FechaISO))!.ordenes).toHaveLength(1);
  });

  it("no crea un pedido cuyo código ya está en otro día", async () => {
    await expect(guardarComanda({ ...base, fecha: "2026-09-10" as FechaISO }, ajustes(), deps)).rejects.toThrow(/ya está cargado/);
  });

  it("exige un número de despacho de 8 dígitos", async () => {
    await expect(guardarComanda({ ...base, numero: "1226" }, ajustes(), deps)).rejects.toThrow(/8 dígitos/);
  });

  it("no acepta una fecha futura", async () => {
    await expect(guardarComanda({ ...base, numero: "12269999", fecha: "2099-01-01" as FechaISO }, ajustes(), deps)).rejects.toThrow(/futura/);
  });

  it("el pedido nuevo se encuentra después por su número", async () => {
    await guardarComanda({ ...base, numero: "12269999" }, ajustes(), deps);
    expect((await pedidosPorNumero("12269999"))[0]).toMatchObject({ codigo: "v12269999wofp-01", tieneCliente: true });
  });
});

describe("solo se guarda lo que Ajustes permite", () => {
  it("sin teléfono, sin nombre y sin dirección", async () => {
    const existente = await ordenDe("v12264655wofp-01");
    await guardarComanda({ ...base, ordenExistenteId: existente.id }, ajustes({ guardarTelefono: false, guardarNombre: false, guardarDireccion: false }), deps);
    const o = await ordenDe("v12264655wofp-01");
    // Sin dirección tampoco se guardan las coordenadas: serían lo mismo. La distancia sí.
    expect(o.cliente).toBeNull();
    expect(o).toMatchObject({ km: 4.2, tramo: 2 });
  });

  it("sin foto, no se guarda la foto", async () => {
    const existente = await ordenDe("v12264655wofp-01");
    await guardarComanda({ ...base, ordenExistenteId: existente.id }, ajustes({ guardarFoto: false }), deps);
    expect(fotos).toEqual([]);
  });

  it("sin foto que guardar, tampoco falla", async () => {
    const existente = await ordenDe("v12264655wofp-01");
    await expect(guardarComanda({ ...base, ordenExistenteId: existente.id, evidencia: null }, ajustes(), deps)).resolves.toBeTruthy();
    expect(fotos).toEqual([]);
  });
});

describe("una semana pagada no se toca", () => {
  it("ni para completar un pedido ni para crear uno", async () => {
    await cerrarSemana(FECHA, REGLA_INICIAL, null);
    await registrarPago("2026-09-14" as FechaISO, 100000);
    const existente = await ordenDe("v12264655wofp-01");
    await expect(guardarComanda({ ...base, ordenExistenteId: existente.id }, ajustes(), deps)).rejects.toThrow(/ya está pagada/);
    await expect(guardarComanda({ ...base, numero: "12269999" }, ajustes(), deps)).rejects.toThrow(/ya está pagada/);
    expect(fotos).toEqual([]);
  });
});
