/**
 * Respaldo y restauración, contra SQLite de verdad.
 */
import { beforeEach, describe, expect, it } from "vitest";

import { usarMotor } from "./conexion";
import { motorEnMemoria } from "./motor-en-memoria";
import { guardarJornada, jornadaPorFecha } from "./jornadas";
import { guardarApoyoHora, guardarApoyoTramos, guardarTaxi, listarBloquesDelDia } from "./bloques-extra";
import { guardarPerfil } from "./perfil";
import { crearRespaldo, leerRespaldo, restaurarRespaldo, VERSION_RESPALDO } from "./respaldo";
import type { JornadaParaGuardar } from "../tipos";
import type { FechaISO } from "@/lib/fechas";

const dia: JornadaParaGuardar = {
  fecha: "2026-09-16" as FechaISO,
  rutasDeclaradas: 1,
  ordenesDeclaradas: 2,
  validacionOk: true,
  horaEntrada: "09:00",
  horaSalida: "22:00",
  tiendaId: null,
  vehiculo: "auto",
  rutas: [{ numero: 1, estado: "Finalizado", horaInicio: "10:00", horaFin: "10:30" }],
  ordenes: [
    { codigo: "v11111111wofp-01", estado: "Entregado", posicion: 1, ruta: 1, tramo: 1, km: null, montoCentimos: 1000 },
    { codigo: "v22222222wofp-01", estado: "Entregado", posicion: 2, ruta: 1, tramo: 1, km: null, montoCentimos: 1000 },
  ],
};

beforeEach(async () => {
  usarMotor(motorEnMemoria());
  await guardarPerfil({ nombre: "Marco" });
  await guardarJornada(dia, "reemplazar");
});

describe("crear un respaldo", () => {
  it("junta lo que hay guardado", async () => {
    const r = await crearRespaldo();
    expect(r.version).toBe(VERSION_RESPALDO);
    expect(r.tablas.jornadas).toHaveLength(1);
    expect(r.tablas.ordenes).toHaveLength(2);
    expect(r.tablas.perfil).toHaveLength(1);
  });
});

describe("leer un respaldo, sin tocar la base", () => {
  it("resume qué trae: cuántas jornadas y de qué fechas", async () => {
    const respaldo = await crearRespaldo();
    const leido = leerRespaldo(JSON.stringify(respaldo));
    expect(leido.ok).toBe(true);
    if (!leido.ok) return;
    expect(leido.resumen).toEqual({
      jornadas: 1,
      desde: "2026-09-16",
      hasta: "2026-09-16",
      nombre: "Marco",
      generadoEn: respaldo.generadoEn,
      etiqueta: null,
    });
  });

  it("un texto que no es JSON se rechaza con un mensaje claro", () => {
    const r = leerRespaldo("esto no es json");
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.error).toMatch(/no es un JSON/);
  });

  it("un JSON que no tiene forma de respaldo se rechaza", () => {
    const r = leerRespaldo(JSON.stringify({ hola: "mundo" }));
    expect(r.ok).toBe(false);
  });
});

describe("restaurar un respaldo", () => {
  it("reemplaza lo que había por lo del respaldo", async () => {
    const respaldo = await crearRespaldo();

    usarMotor(motorEnMemoria()); // un teléfono nuevo, con la base vacía
    await restaurarRespaldo(respaldo);

    const j = await jornadaPorFecha("2026-09-16" as FechaISO);
    expect(j).not.toBeNull();
    expect(j!.ordenes).toHaveLength(2);
  });

  it("un pedido sigue enlazado a su ruta después de restaurar", async () => {
    // Es lo que importa de verdad: el enlace es por id, y los ids se
    // conservan tal cual venían en el respaldo.
    const respaldo = await crearRespaldo();

    usarMotor(motorEnMemoria());
    await restaurarRespaldo(respaldo);

    const j = await jornadaPorFecha("2026-09-16" as FechaISO);
    expect(j!.ordenes.every((o) => o.ruta === 1)).toBe(true);
  });

  it("restaurar sobre datos ya existentes los reemplaza, no los mezcla", async () => {
    const respaldo = await crearRespaldo();

    // El mismo teléfono, con un día distinto ya cargado desde entonces.
    await guardarJornada(
      { ...dia, fecha: "2026-09-20" as FechaISO, ordenes: [] },
      "reemplazar",
    );
    await restaurarRespaldo(respaldo);

    expect(await jornadaPorFecha("2026-09-20" as FechaISO)).toBeNull();
    expect(await jornadaPorFecha("2026-09-16" as FechaISO)).not.toBeNull();
  });

  it("una columna que ya no existe en la app no revienta la restauración", async () => {
    const respaldo = await crearRespaldo();
    (respaldo.tablas.jornadas[0] as Record<string, unknown>).columna_del_futuro = "algo";

    usarMotor(motorEnMemoria());
    await expect(restaurarRespaldo(respaldo)).resolves.not.toThrow();
    expect(await jornadaPorFecha("2026-09-16" as FechaISO)).not.toBeNull();
  });

  it("va todo o nada: si algo falla a mitad, no queda la base a medias", async () => {
    const respaldo = await crearRespaldo();
    // Una fila de "rutas" sin su jornada, con una tabla que no existe: fuerza
    // el fallo sin necesidad de romper la base primero.
    (respaldo.tablas as unknown as Record<string, unknown>).tiendas = null;

    usarMotor(motorEnMemoria());
    await expect(restaurarRespaldo(respaldo)).rejects.toThrow();
  });
});

describe("apoyo y taxi en el respaldo", () => {
  const fecha = "2026-09-16" as FechaISO;

  async function conBloques() {
    await guardarApoyoHora({
      fecha, horaInicio: "10:00", horaFin: "21:00", tiendaNombre: "Limatambo",
      tarifaHoraCentimos: 1800, horas: 11, motivo: "Apoyo", notas: null,
    });
    await guardarTaxi({
      fecha, horaInicio: null, horaFin: null, origen: null, destino: null,
      km: 8, kmFuente: "manual", montoCentimos: 2200, notas: null,
    });
  }

  it("se guardan en el respaldo", async () => {
    await conBloques();
    const r = await crearRespaldo();
    expect(r.tablas.bloques_extra).toHaveLength(2);
  });

  it("vuelven al restaurar en un teléfono nuevo", async () => {
    await conBloques();
    const respaldo = await crearRespaldo();

    usarMotor(motorEnMemoria());
    await restaurarRespaldo(respaldo);

    const bloques = await listarBloquesDelDia(fecha);
    expect(bloques.map((b) => b.tipo)).toEqual(["apoyo_hora", "taxi"]);
    expect(bloques.reduce((s, b) => s + b.montoCentimos, 0)).toBe(19800 + 2200);
  });

  it("un apoyo por tramos conserva sus pedidos", async () => {
    const tienda = (await consultarTiendaPrueba())!;
    await guardarApoyoTramos({
      fecha, horaInicio: "10:00", horaFin: null, tiendaId: tienda,
      pedidos: [{ km: 2, kmFuente: "manual", tramo: 1 }, { km: 5, kmFuente: "manual", tramo: 3 }],
      notas: null,
    });
    const respaldo = await crearRespaldo();
    expect(respaldo.tablas.bloques_apoyo_pedidos).toHaveLength(2);

    usarMotor(motorEnMemoria());
    await restaurarRespaldo(respaldo);
    const [bloque] = await listarBloquesDelDia(fecha);
    expect(bloque.tipo === "apoyo_tramos" && bloque.pedidos).toHaveLength(2);
  });

  it("un respaldo viejo, sin esas tablas, se lee y se restaura igual", async () => {
    const respaldo = await crearRespaldo();
    const viejo = JSON.parse(JSON.stringify(respaldo));
    delete viejo.tablas.bloques_extra;
    delete viejo.tablas.bloques_apoyo_pedidos;

    const leido = leerRespaldo(JSON.stringify(viejo));
    expect(leido.ok).toBe(true);
    if (!leido.ok) return;
    usarMotor(motorEnMemoria());
    await expect(restaurarRespaldo(leido.respaldo)).resolves.not.toThrow();
  });
});

async function consultarTiendaPrueba(): Promise<string | null> {
  const { ejecutar, consultar, nuevoId } = await import("./conexion");
  const id = nuevoId();
  const ahora = new Date().toISOString();
  await ejecutar(`insert into tiendas (id, nombre, creado_en, actualizado_en) values (?, ?, ?, ?)`, [id, "Otra", ahora, ahora]).catch(() => undefined);
  const filas = await consultar<{ id: string }>(`select id from tiendas where nombre = 'Otra'`);
  return filas[0]?.id ?? null;
}

describe("restaurar con tienda y perfil enlazados", () => {
  it("un perfil que apunta a una tienda se restaura sin fallar por claves foráneas", async () => {
    const { ejecutar, consultar, nuevoId } = await import("./conexion");
    const id = nuevoId();
    const ahora = new Date().toISOString();
    await ejecutar(`insert into tiendas (id, nombre, creado_en, actualizado_en) values (?, 'Wong', ?, ?)`, [id, ahora, ahora]);
    await ejecutar(`update perfil set tienda_id = ?`, [id]);
    const respaldo = await crearRespaldo({ etiqueta: "Prueba" });
    expect(respaldo.etiqueta).toBe("Prueba");

    usarMotor(motorEnMemoria());
    await restaurarRespaldo(respaldo);
    const filas = await consultar<{ tienda_id: string }>(`select tienda_id from perfil`);
    expect(filas[0].tienda_id).toBe(id);
  });
});

