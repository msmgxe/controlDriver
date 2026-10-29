/**
 * Pruebas del panel de licencias: estados, cifras, series por mes, CSV,
 * validaciones, seguridad y la migración/repositorio sobre una base en memoria.
 */
import { createClient, type Client } from "@libsql/client";
import { describe, expect, it } from "vitest";

import {
  activosPorMes,
  celdaCsv,
  csvDePagos,
  csvDeUsuarios,
  estadoDe,
  formatearSoles,
  ingresosPorMes,
  mensajeParaWhatsApp,
  resumenDelTablero,
  textoDuracion,
  textoVence,
  ultimoPagoValido,
  ultimosMeses,
  vigenciaTrasAnular,
  type FilaLicencia,
  type FilaPago,
} from "./panel";
import {
  anotarIntento,
  anularPago,
  borrarIntentos,
  contarAuditoria,
  guardarContacto,
  intentosRecientes,
  listarLicencias,
  listarPagos,
  obtenerLicencia,
  registrarAuditoria,
  registrarEmision,
} from "./repositorio";
import {
  claveDeIp,
  crearToken,
  DURACION_SESION_SEGUNDOS,
  igualesEnTiempoConstante,
  ipDeCabeceras,
  resumirIp,
  tokenValido,
} from "./seguridad";
import { migrarEsquema } from "./turso";
import { aCentimos, esquemaCodigo, esquemaEmision, esquemaMetodo } from "./validar";

const HOY = "2026-10-15";
const COD_A = "11111111-1111-4111-8111-111111111111";
const COD_B = "22222222-2222-4222-8222-222222222222";

const lic = (o: Partial<FilaLicencia>): FilaLicencia => ({
  codigo: COD_A,
  nombre: "Ana",
  vigenteHasta: "2026-11-30",
  diasDeGracia: 7,
  telefono: null,
  notas: null,
  creadaEn: null,
  ...o,
});
let siguiente = 1;
const pago = (o: Partial<FilaPago>): FilaPago => ({
  id: siguiente++,
  codigo: COD_A,
  fecha: "2026-10-01",
  duracion: "1",
  hasta: "2026-11-01",
  montoCentimos: 1500,
  metodo: "Yape",
  anuladoEn: null,
  ...o,
});

describe("estadoDe", () => {
  it("clasifica por días restantes y gracia", () => {
    expect(estadoDe("2026-10-23", 7, HOY)).toBe("al_dia"); // 8 días
    expect(estadoDe("2026-10-22", 7, HOY)).toBe("por_vencer"); // 7 días
    expect(estadoDe("2026-10-15", 7, HOY)).toBe("por_vencer"); // hoy
    expect(estadoDe("2026-10-14", 7, HOY)).toBe("gracia");
    expect(estadoDe("2026-10-08", 7, HOY)).toBe("gracia"); // -7
    expect(estadoDe("2026-10-07", 7, HOY)).toBe("vencido");
  });
  it("textoVence", () => {
    expect(textoVence(0)).toBe("vence hoy");
    expect(textoVence(3)).toBe("vence en 3 días");
    expect(textoVence(-2)).toBe("venció hace 2 días");
  });
});

describe("tablero", () => {
  it("cuenta estados, ingresos del mes, acumulados y ticket medio (sin anulados)", () => {
    const licencias = [
      lic({ codigo: COD_A, vigenteHasta: "2026-12-01" }),
      lic({ codigo: COD_B, vigenteHasta: "2026-10-20" }),
      lic({ codigo: "x3", vigenteHasta: "2026-10-12" }),
      lic({ codigo: "x4", vigenteHasta: "2026-01-01" }),
    ];
    const pagos = [
      pago({ fecha: "2026-10-02", montoCentimos: 1500 }),
      pago({ fecha: "2026-09-02", montoCentimos: 3000 }),
      pago({ fecha: "2026-10-03", montoCentimos: 9900, anuladoEn: "2026-10-04" }),
      pago({ fecha: "2026-10-05", montoCentimos: null }),
    ];
    const r = resumenDelTablero(licencias, pagos, HOY);
    expect(r).toMatchObject({ usuarios: 4, activos: 2, porVencer: 1, enGracia: 1, vencidos: 1 });
    expect(r.ingresosMesCentimos).toBe(1500);
    expect(r.ingresosTotalesCentimos).toBe(4500);
    expect(r.pagosConMonto).toBe(2);
    expect(r.ticketMedioCentimos).toBe(2250);
  });
  it("sin pagos no divide por cero", () => {
    expect(resumenDelTablero([], [], HOY).ticketMedioCentimos).toBe(0);
  });
  it("formatearSoles", () => {
    expect(formatearSoles(150000)).toBe("S/ 1,500.00");
    expect(formatearSoles(0)).toBe("S/ 0.00");
  });
});

describe("series por mes", () => {
  it("ultimosMeses cruza el año y termina en el mes actual", () => {
    const m = ultimosMeses("2026-02-10", 4);
    expect(m).toEqual(["2025-11", "2025-12", "2026-01", "2026-02"]);
    expect(ultimosMeses(HOY)).toHaveLength(12);
  });
  it("ingresosPorMes agrupa por mes de pago e ignora anulados y fuera de rango", () => {
    const pagos = [
      pago({ fecha: "2026-10-02", montoCentimos: 1500 }),
      pago({ fecha: "2026-10-20", montoCentimos: 500 }),
      pago({ fecha: "2026-08-01", montoCentimos: 3000 }),
      pago({ fecha: "2026-08-01", montoCentimos: 9999, anuladoEn: "2026-08-02" }),
      pago({ fecha: "2020-01-01", montoCentimos: 7000 }),
    ];
    const s = ingresosPorMes(pagos, HOY, 12);
    expect(s.at(-1)).toEqual({ mes: "2026-10", corto: "oct", valor: 2000 });
    expect(s.find((p) => p.mes === "2026-08")?.valor).toBe(3000);
    expect(s.reduce((a, p) => a + p.valor, 0)).toBe(5000);
  });
  it("activosPorMes cuenta usuarios distintos cuyo tramo toca el mes", () => {
    const pagos = [
      pago({ codigo: COD_A, fecha: "2026-09-20", hasta: "2026-10-20" }),
      pago({ codigo: COD_A, fecha: "2026-10-18", hasta: "2026-11-20" }),
      pago({ codigo: COD_B, fecha: "2026-10-01", hasta: "2026-10-31" }),
      pago({ codigo: "anulado", fecha: "2026-10-01", hasta: "2026-10-31", anuladoEn: "2026-10-02" }),
    ];
    const s = activosPorMes(pagos, HOY, 3);
    expect(s.map((p) => p.valor)).toEqual([0, 1, 2]); // ago, sep, oct
  });
});

describe("anulación (lógica pura)", () => {
  const p1 = pago({ id: 101, fecha: "2026-08-01", hasta: "2026-09-01" });
  const p2 = pago({ id: 102, fecha: "2026-09-01", hasta: "2026-10-01" });
  it("el último válido es el de mayor id sin anular", () => {
    expect(ultimoPagoValido([p1, p2])?.id).toBe(102);
    expect(ultimoPagoValido([p1, { ...p2, anuladoEn: "2026-09-02" }])?.id).toBe(101);
    expect(ultimoPagoValido([])).toBeNull();
  });
  it("vuelve al hasta del pago anterior, o al día antes si no hay", () => {
    expect(vigenciaTrasAnular([p1, p2], p2)).toBe("2026-09-01");
    expect(vigenciaTrasAnular([p1], p1)).toBe("2026-07-31");
  });
});

describe("textos y CSV", () => {
  it("textoDuracion", () => {
    expect(textoDuracion("1")).toBe("1 mes");
    expect(textoDuracion("3")).toBe("3 meses");
    expect(textoDuracion("15d")).toBe("15 días");
  });
  it("el mensaje de WhatsApp lleva el certificado", () => {
    expect(mensajeParaWhatsApp("abc.def")).toContain("Ajustes → Tu licencia → Pegar");
    expect(mensajeParaWhatsApp("abc.def").endsWith("abc.def")).toBe(true);
  });
  it("celdaCsv entrecomilla y neutraliza fórmulas", () => {
    expect(celdaCsv('a,"b"')).toBe('"a,""b"""');
    expect(celdaCsv("=HYPERLINK(1)")).toBe("'=HYPERLINK(1)");
    expect(celdaCsv("@x")).toBe("'@x");
    expect(celdaCsv(-5)).toBe("-5");
    expect(celdaCsv(null)).toBe("");
  });
  it("csvDePagos y csvDeUsuarios", () => {
    const l = lic({ nombre: "=Evil", vigenteHasta: "2026-12-01", telefono: "+51 999" });
    const p = [pago({ montoCentimos: 1550 }), pago({ montoCentimos: null, anuladoEn: "2026-10-09" })];
    const c1 = csvDePagos(p, new Map([[COD_A, l.nombre]]));
    expect(c1.startsWith("﻿fecha,codigo,nombre")).toBe(true);
    expect(c1).toContain("15.50");
    expect(c1).toContain("'=Evil");
    const c2 = csvDeUsuarios([l], p, HOY);
    expect(c2).toContain("Al día");
    expect(c2.split("\r\n")[1]).toContain(",1,15.50,");
  });
});

describe("validaciones", () => {
  it("el código debe ser un UUID", () => {
    expect(esquemaCodigo.safeParse(COD_A).success).toBe(true);
    expect(esquemaCodigo.safeParse("hola").success).toBe(false);
    expect(esquemaCodigo.safeParse(COD_A + "x").success).toBe(false);
    expect(esquemaCodigo.safeParse("'; drop table pagos;--").success).toBe(false);
  });
  it("aCentimos", () => {
    expect(aCentimos("15")).toBe(1500);
    expect(aCentimos("15,5")).toBe(1550);
    expect(aCentimos("0")).toBe(0);
    expect(aCentimos("5000")).toBe(500000);
    expect(aCentimos("")).toBeNull();
    expect(aCentimos(undefined)).toBeNull();
    expect(aCentimos("5000.01")).toBeNaN();
    expect(aCentimos("-1")).toBeNaN();
    expect(aCentimos("abc")).toBeNaN();
    expect(aCentimos("1.234")).toBeNaN();
  });
  it("método: conocidos normalizados, texto corto, nada raro", () => {
    expect(esquemaMetodo.parse("yape")).toBe("Yape");
    expect(esquemaMetodo.parse(" BCP ")).toBe("BCP");
    expect(esquemaMetodo.parse("")).toBeNull();
    expect(esquemaMetodo.safeParse("x".repeat(21)).success).toBe(false);
    expect(esquemaMetodo.safeParse("<script>").success).toBe(false);
  });
  const base = { codigo: COD_A, nombre: "Ana", meses: "1" };
  it("emisión válida y límites de meses y monto", () => {
    const ok = esquemaEmision.parse({ ...base, monto: "15", metodo: "plin", telefono: "+51 999 888 777", notas: "ok" });
    expect(ok).toMatchObject({ meses: 1, monto: 1500, metodo: "Plin", telefono: "+51 999 888 777" });
    expect(esquemaEmision.safeParse({ ...base, meses: "0" }).success).toBe(false);
    expect(esquemaEmision.safeParse({ ...base, meses: "25" }).success).toBe(false);
    expect(esquemaEmision.safeParse({ ...base, meses: "1.5" }).success).toBe(false);
    expect(esquemaEmision.safeParse({ ...base, meses: "24" }).success).toBe(true);
    expect(esquemaEmision.safeParse({ ...base, monto: "5001" }).success).toBe(false);
    expect(esquemaEmision.safeParse({ ...base, nombre: "   " }).success).toBe(false);
    expect(esquemaEmision.safeParse({ ...base, nombre: "a\nb" }).success).toBe(false);
    expect(esquemaEmision.safeParse({ ...base, telefono: "abc" }).success).toBe(false);
    expect(esquemaEmision.safeParse({ ...base, notas: "x".repeat(501) }).success).toBe(false);
    expect(esquemaEmision.safeParse({ ...base, codigo: "no" }).success).toBe(false);
  });
});

describe("seguridad", () => {
  it("comparación en tiempo constante", () => {
    expect(igualesEnTiempoConstante("secreto", "secreto")).toBe(true);
    expect(igualesEnTiempoConstante("secreto", "secretO")).toBe(false);
    expect(igualesEnTiempoConstante("a", "aaaa")).toBe(false);
    expect(igualesEnTiempoConstante("", "x")).toBe(false);
  });
  it("token de sesión: válido, caduca, manipulado y otra contraseña", () => {
    const t0 = 1_800_000_000_000;
    const token = crearToken("clave-larga", t0);
    expect(tokenValido("clave-larga", token, t0 + 1000)).toBe(true);
    expect(tokenValido("clave-larga", token, t0 + (DURACION_SESION_SEGUNDOS + 5) * 1000)).toBe(false);
    expect(tokenValido("otra", token, t0)).toBe(false);
    const [exp, firma] = token.split(".");
    expect(tokenValido("clave-larga", `${Number(exp) + 99999}.${firma}`, t0)).toBe(false);
    expect(tokenValido("clave-larga", undefined, t0)).toBe(false);
    expect(tokenValido("clave-larga", "basura", t0)).toBe(false);
    expect(tokenValido("clave-larga", `${exp}.${firma}.x`, t0)).toBe(false);
    expect(token).not.toContain("clave-larga");
  });
  it("IP resumida y clave anónima", () => {
    expect(resumirIp("203.0.113.77")).toBe("203.0.113.x");
    expect(resumirIp("2001:db8:85a3:8d3:1319:8a2e:370:7348")).toBe("2001:db8:85a3::x");
    expect(resumirIp("")).toBe("desconocida");
    expect(resumirIp("basura")).toBe("desconocida");
    expect(claveDeIp("1.2.3.4")).toBe(claveDeIp("1.2.3.4"));
    expect(claveDeIp("1.2.3.4")).not.toContain("1.2.3.4");
    expect(ipDeCabeceras({ get: (n) => (n === "x-forwarded-for" ? "9.9.9.9, 10.0.0.1" : null) })).toBe("9.9.9.9");
  });
});

/* ------------------------------------------------ migración y repositorio */

async function baseNueva(): Promise<Client> {
  return createClient({ url: ":memory:" });
}

describe("migración", () => {
  it("es idempotente y conserva los datos de la base antigua", async () => {
    const db = await baseNueva();
    await db.execute(`create table licencias (codigo text primary key, nombre text not null, vigente_hasta text not null, dias_de_gracia integer not null default 7)`);
    await db.execute(`create table pagos (id integer primary key autoincrement, codigo text not null, fecha text not null, duracion text not null, hasta text not null)`);
    await db.execute({ sql: `insert into licencias values (?, 'Vieja', '2026-11-01', 7)`, args: [COD_A] });
    await db.execute({ sql: `insert into pagos (codigo, fecha, duracion, hasta) values (?, '2026-10-01', '1', '2026-11-01')`, args: [COD_A] });

    await migrarEsquema(db);
    await migrarEsquema(db); // repetir no rompe nada

    const cols = (await db.execute(`pragma table_info(pagos)`)).rows.map((r) => String(r.name));
    expect(cols).toEqual(expect.arrayContaining(["monto_centimos", "metodo", "anulado_en"]));
    const l = await obtenerLicencia(COD_A, db);
    expect(l).toMatchObject({ nombre: "Vieja", vigenteHasta: "2026-11-01", telefono: null, creadaEn: "2026-10-01" });
    const p = await listarPagos(db);
    expect(p).toHaveLength(1);
    expect(p[0]).toMatchObject({ montoCentimos: null, metodo: null, anuladoEn: null });
    for (const t of ["auditoria", "intentos_login"]) {
      expect((await db.execute(`select count(*) as n from ${t}`)).rows[0].n).toBe(0);
    }
  });
});

describe("repositorio (base en memoria)", () => {
  async function lista() {
    const db = await baseNueva();
    await migrarEsquema(db);
    return db;
  }
  const emision = (o: object = {}) => ({
    codigo: COD_A,
    nombre: "Ana",
    vigenteHasta: "2026-11-01",
    diasDeGracia: 7,
    fechaDePago: "2026-10-01",
    duracion: "1",
    ...o,
  });

  it("registra monto, método, contacto y fecha de alta; renovar no los pisa", async () => {
    const db = await lista();
    await registrarEmision(emision({ montoCentimos: 1500, metodo: "Yape", telefono: "+51 999111222", notas: "vip" }), db);
    await registrarEmision(emision({ vigenteHasta: "2026-12-01", fechaDePago: "2026-10-20" }), db);
    const l = (await listarLicencias(db))[0];
    expect(l).toMatchObject({ telefono: "+51 999111222", notas: "vip", creadaEn: "2026-10-01", vigenteHasta: "2026-12-01" });
    const p = await listarPagos(db);
    expect(p.map((x) => x.montoCentimos)).toEqual([1500, null]);
    expect(p[0].metodo).toBe("Yape");
  });

  it("guardarContacto", async () => {
    const db = await lista();
    await registrarEmision(emision(), db);
    expect(await guardarContacto({ codigo: COD_A, nombre: "Ana M.", telefono: "999", notas: null }, db)).toBe(true);
    expect(await guardarContacto({ codigo: COD_B, nombre: "x", telefono: null, notas: null }, db)).toBe(false);
    expect((await obtenerLicencia(COD_A, db))?.nombre).toBe("Ana M.");
  });

  it("anular el último pago devuelve la vigencia anterior y exige el id correcto", async () => {
    const db = await lista();
    await registrarEmision(emision({ montoCentimos: 1500 }), db);
    await registrarEmision(emision({ vigenteHasta: "2026-12-01", fechaDePago: "2026-10-20", montoCentimos: 1500 }), db);
    const [p1, p2] = await listarPagos(db);

    expect((await anularPago(COD_A, p1.id, "2026-10-21", db)).ok).toBe(false); // no es el último
    const r = await anularPago(COD_A, p2.id, "2026-10-21", db);
    expect(r).toEqual({ ok: true, vigenteHasta: "2026-11-01" });
    expect((await obtenerLicencia(COD_A, db))?.vigenteHasta).toBe("2026-11-01");
    expect((await listarPagos(db))[1].anuladoEn).toBe("2026-10-21");

    expect((await anularPago(COD_A, p2.id, "2026-10-22", db)).ok).toBe(false); // ya anulado
    const r2 = await anularPago(COD_A, p1.id, "2026-10-22", db); // ahora p1 es el último válido
    expect(r2).toEqual({ ok: true, vigenteHasta: "2026-09-30" });
    expect((await anularPago(COD_A, p1.id, "2026-10-22", db)).ok).toBe(false);
  });

  it("auditoría: se cuenta por acción y ventana", async () => {
    const db = await lista();
    await registrarAuditoria("emitir", COD_A, "1.2.3.x", db);
    await registrarAuditoria("renovar", COD_A, "1.2.3.x", db);
    await registrarAuditoria("exportar_pagos", null, "1.2.3.x", db);
    expect(await contarAuditoria(["emitir", "renovar", "reenviar"], "2000-01-01", db)).toBe(2);
    expect(await contarAuditoria(["emitir"], "2999-01-01", db)).toBe(0);
    expect(await contarAuditoria([], "2000-01-01", db)).toBe(0);
  });

  it("intentos de login: cuentan en la ventana y se borran", async () => {
    const db = await lista();
    const k = claveDeIp("1.1.1.1");
    for (let i = 0; i < 5; i++) await anotarIntento(k, 1_000_000 + i, db);
    await anotarIntento(claveDeIp("2.2.2.2"), 1_000_000, db);
    expect(await intentosRecientes(k, 1_000_000, db)).toBe(5);
    expect(await intentosRecientes(k, 1_000_003, db)).toBe(2);
    await borrarIntentos(k, db);
    expect(await intentosRecientes(k, 0, db)).toBe(0);
    expect(await intentosRecientes(claveDeIp("2.2.2.2"), 0, db)).toBe(1);
  });
});
