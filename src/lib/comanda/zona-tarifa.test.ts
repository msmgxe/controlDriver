/**
 * Tarifa por zona contra SQLite en memoria: guardar/leer la regla, empates el
 * mismo día, comanda con distancia, liquidación con tramos que ya no existen y
 * reglas viejas sin `medida`.
 */
import { beforeEach, describe, expect, it } from "vitest";

import { AJUSTES_DE_COMANDAS_POR_DEFECTO } from "@/lib/db/sqlite/ajustes";
import { usarMotor } from "@/lib/db/sqlite/conexion";
import { guardarJornada, jornadaPorFecha, reglaVigente } from "@/lib/db/sqlite/jornadas";
import { liquidacionDeSemana } from "@/lib/db/sqlite/liquidaciones";
import { motorEnMemoria } from "@/lib/db/sqlite/motor-en-memoria";
import { guardarPerfil, guardarRegla, guardarTienda } from "@/lib/db/sqlite/perfil";
import type { JornadaParaGuardar } from "@/lib/db/tipos";
import type { FechaISO } from "@/lib/fechas";
import { REGLA_INICIAL, esPorZona, etiquetaTramo, pagoDelTramo, type ReglaPago } from "@/lib/pagos/reglas";

import { guardarComanda, type ComandaParaGuardar } from "./guardar";

const FECHA = "2026-09-16" as FechaISO;

const zonas: ReglaPago = {
  moneda: "PEN",
  base: "por_pedido",
  medida: "zona",
  tramos: [
    { id: 1, desde: 0, hasta: 0, monto: 8, nombre: "Miraflores, Surquillo" },
    { id: 2, desde: 0, hasta: 0, monto: 12, nombre: "Surco" },
    { id: 3, desde: 0, hasta: 0, monto: 15, nombre: "La Molina" },
  ],
  garantiaPermanencia: null,
};

let tiendaId: string;

/** `actualizado_en` tiene resolución de milisegundo: se espera para que dos guardados no empaten. */
const pausa = () => new Promise((r) => setTimeout(r, 5));

const dia = (tramos: Array<{ tramo: number; monto: number | null }>): JornadaParaGuardar => ({
  fecha: FECHA,
  rutasDeclaradas: 1,
  ordenesDeclaradas: tramos.length,
  validacionOk: true,
  horaEntrada: "09:00",
  horaSalida: "22:00",
  tiendaId,
  vehiculo: "auto",
  rutas: [{ numero: 1, estado: "Finalizado", horaInicio: "10:00", horaFin: "10:30" }],
  ordenes: tramos.map((t, i) => ({
    codigo: `v1226${4000 + i}wofp-01`,
    estado: "Entregado",
    posicion: i + 1,
    ruta: 1,
    tramo: t.tramo,
    km: null,
    montoCentimos: t.monto as number,
  })),
});

beforeEach(async () => {
  usarMotor(motorEnMemoria());
  tiendaId = await guardarTienda({ nombre: "Tienda Z" });
  await guardarPerfil({ nombre: "Marco", tiendaId, horaEntrada: "09:00", horaSalida: "22:00" });
});

describe("(a) ida y vuelta de la regla por zona", () => {
  it("conserva medida y nombre de cada tramo", async () => {
    const id = await guardarRegla(tiendaId, "auto", "2026-01-01", zonas);
    const { id: leida, regla } = await reglaVigente(FECHA, tiendaId, "auto");
    expect(leida).toBe(id);
    expect(regla).toEqual(zonas);
    expect(esPorZona(regla)).toBe(true);
    expect(etiquetaTramo(regla, 2)).toBe("Surco");
    expect(pagoDelTramo(regla, 3)).toBe(1500);
  });

  it("el nombre con espacios se recorta al leer", async () => {
    await guardarRegla(tiendaId, "auto", "2026-01-01", { ...zonas, tramos: [{ id: 1, desde: 0, hasta: 0, monto: 8, nombre: "  Surco  " }] });
    expect((await reglaVigente(FECHA, tiendaId, "auto")).regla.tramos[0].nombre).toBe("Surco");
  });
});

describe("(b) dos reglas el mismo día", () => {
  it("gana la última guardada", async () => {
    await guardarRegla(tiendaId, "auto", "2026-01-01", REGLA_INICIAL);
    await pausa();
    const ultima = await guardarRegla(tiendaId, "auto", "2026-01-01", zonas);
    const { id, regla } = await reglaVigente(FECHA, tiendaId, "auto");
    expect(id).toBe(ultima);
    expect(esPorZona(regla)).toBe(true);
  });

  it("y a la inversa: zona primero, km después, gana km", async () => {
    await guardarRegla(tiendaId, "auto", "2026-01-01", zonas);
    await pausa();
    const ultima = await guardarRegla(tiendaId, "auto", "2026-01-01", REGLA_INICIAL);
    const { id, regla } = await reglaVigente(FECHA, tiendaId, "auto");
    expect(id).toBe(ultima);
    expect(esPorZona(regla)).toBe(false);
  });

  // BUG conocido: con el mismo `actualizado_en` (mismo ms) el desempate cae en el id uuid al azar.
  it("empate exacto de milisegundo: debería ganar el último", async () => {
    await guardarRegla(tiendaId, "auto", "2026-01-01", REGLA_INICIAL);
    await guardarRegla(tiendaId, "auto", "2026-01-01", { ...zonas, tramos: [{ id: 1, desde: 0, hasta: 0, monto: 1, nombre: "A" }] });
    await guardarRegla(tiendaId, "auto", "2026-01-01", { ...zonas, tramos: [{ id: 1, desde: 0, hasta: 0, monto: 3, nombre: "C" }] });
    const ultima = await guardarRegla(tiendaId, "auto", "2026-01-01", { ...zonas, tramos: [{ id: 1, desde: 0, hasta: 0, monto: 2, nombre: "B" }] });
    const { id, regla } = await reglaVigente(FECHA, tiendaId, "auto");
    expect(id).toBe(ultima);
    expect(regla.tramos[0].nombre).toBe("B");
  });
});

describe("(c) comanda con distancia y tarifa por zona", () => {
  const base: ComandaParaGuardar = {
    numero: "12264000",
    ordenExistenteId: null,
    fecha: FECHA,
    moverAFecha: false,
    ruta: null,
    nombre: "Ana",
    telefono: "",
    direccion: "Calle 1",
    punto: { lat: -12.1, lng: -76.99 },
    distancia: { km: 9.5, fuente: "recta", enLinea: 9.5 },
    montoManualCentimos: null,
    evidencia: null,
  } as unknown as ComandaParaGuardar;
  const deps = { guardarFoto: async () => {} };

  it("guarda los km pero no cambia el tramo ni el monto (existente)", async () => {
    await guardarRegla(tiendaId, "auto", "2000-01-01", zonas);
    await guardarJornada(dia([{ tramo: 2, monto: 1200 }]), "reemplazar");
    const o = (await jornadaPorFecha(FECHA))!.ordenes[0];
    const r = await guardarComanda({ ...base, ordenExistenteId: o.id }, AJUSTES_DE_COMANDAS_POR_DEFECTO, deps);
    expect(r).toMatchObject({ tramo: 2, montoCentimos: 1200, tramoDe: "apagado", km: 9.5 });
    expect((await jornadaPorFecha(FECHA))!.ordenes[0]).toMatchObject({ km: 9.5, tramo: 2 });
  });

  it("pedido nuevo con zona: nace en tramo 1 con el monto de la zona 1", async () => {
    await guardarRegla(tiendaId, "auto", "2000-01-01", zonas);
    const r = await guardarComanda({ ...base, numero: "12269999" }, AJUSTES_DE_COMANDAS_POR_DEFECTO, deps);
    expect(r).toMatchObject({ creado: true, tramo: 1, montoCentimos: 800, tramoDe: "apagado" });
  });

  it("más de 12 km con zona tampoco pide monto ni salta al tramo 6", async () => {
    await guardarRegla(tiendaId, "auto", "2000-01-01", zonas);
    await guardarJornada(dia([{ tramo: 1, monto: 800 }]), "reemplazar");
    const o = (await jornadaPorFecha(FECHA))!.ordenes[0];
    const r = await guardarComanda(
      { ...base, ordenExistenteId: o.id, distancia: { km: 30, fuente: "ruta", enLinea: 25 } },
      AJUSTES_DE_COMANDAS_POR_DEFECTO,
      deps,
    );
    expect(r).toMatchObject({ tramo: 1, tramoDe: "apagado" });
  });
});

describe("(d) liquidación con tramos que ya no existen", () => {
  it("no explota y señala tramo-desconocido", async () => {
    await guardarRegla(tiendaId, "auto", "2000-01-01", zonas);
    await guardarJornada(dia([{ tramo: 1, monto: 800 }, { tramo: 5, monto: 1100 }, { tramo: 4, monto: 900 }]), "reemplazar");
    const { liquidacion } = await liquidacionDeSemana(FECHA);
    expect(liquidacion.pedidosSinTarifa).toHaveLength(2);
    expect(liquidacion.pedidosSinTarifa.map((p) => p.motivo)).toEqual(["tramo-desconocido", "tramo-desconocido"]);
    expect(liquidacion.montoCalculadoCentimos).toBe(800);
  });

  it("se quita una zona de la regla y se vuelve a liquidar: el pedido queda señalado", async () => {
    await guardarRegla(tiendaId, "auto", "2000-01-01", zonas);
    await guardarJornada(dia([{ tramo: 3, monto: 1500 }]), "reemplazar");
    expect((await liquidacionDeSemana(FECHA)).liquidacion.montoCalculadoCentimos).toBe(1500);
    await pausa();
    await guardarRegla(tiendaId, "auto", "2000-01-01", { ...zonas, tramos: zonas.tramos.slice(0, 2) });
    const { liquidacion } = await liquidacionDeSemana(FECHA);
    expect(liquidacion.pedidosSinTarifa).toMatchObject([{ tramo: 3, motivo: "tramo-desconocido" }]);
  });

  // BUG conocido (calcular-liquidacion.ts:350): montoDelPedido trata el tramo 6 como «más de 12 km» también con zonas.
  it("zona número 6 (si la regla la tiene) paga la tarifa de la zona (S/ 12), no el monto guardado en el pedido (S/ 9.99)", async () => {
    const seis: ReglaPago = {
      ...zonas,
      tramos: [1, 2, 3, 4, 5, 6].map((id) => ({ id, desde: 0, hasta: 0, monto: id * 2, nombre: `Z${id}` })),
    };
    await guardarRegla(tiendaId, "auto", "2000-01-01", seis);
    await guardarJornada(dia([{ tramo: 6, monto: 999 }]), "reemplazar");
    const { liquidacion } = await liquidacionDeSemana(FECHA);
    expect(liquidacion.pedidosSinTarifa).toHaveLength(0);
    expect(liquidacion.montoCalculadoCentimos).toBe(1200);
  });

  // BUG conocido (calcular-liquidacion.ts:243): el motivo se decide por `tramo === 6`, aunque la regla sea por zona.
  it("zona 6 sin la zona en la regla se rotula como tramo-desconocido, no «más de 12 km»", async () => {
    await guardarRegla(tiendaId, "auto", "2000-01-01", zonas);
    await guardarJornada(dia([{ tramo: 6, monto: null }]), "reemplazar");
    const { liquidacion } = await liquidacionDeSemana(FECHA);
    expect(liquidacion.pedidosSinTarifa[0].motivo).toBe("tramo-desconocido");
  });
});

describe("(e) regla vieja sin medida", () => {
  it("sigue siendo por km", async () => {
    await guardarRegla(tiendaId, "auto", "2000-01-01", REGLA_INICIAL);
    const { regla } = await reglaVigente(FECHA, tiendaId, "auto");
    expect(regla.medida).toBeUndefined();
    expect(esPorZona(regla)).toBe(false);
    expect(etiquetaTramo(regla, 1)).toBe("T1");
    expect(etiquetaTramo(regla, 6)).toBe("Más de 12 km");
  });

  it("la comanda vuelve a calcular el tramo por distancia", async () => {
    await guardarRegla(tiendaId, "auto", "2000-01-01", REGLA_INICIAL);
    await guardarJornada(dia([{ tramo: 1, monto: 1000 }]), "reemplazar");
    const o = (await jornadaPorFecha(FECHA))!.ordenes[0];
    const r = await guardarComanda(
      { numero: "12264000", ordenExistenteId: o.id, fecha: FECHA, moverAFecha: false, ruta: null, nombre: "A", telefono: "", direccion: "", punto: null, distancia: { km: 4.2, fuente: "recta", enLinea: 4.2 }, montoManualCentimos: null, evidencia: null } as unknown as ComandaParaGuardar,
      AJUSTES_DE_COMANDAS_POR_DEFECTO,
      { guardarFoto: async () => {} },
    );
    expect(r).toMatchObject({ tramo: 2, tramoDe: "auto" });
  });

  it("una fila corrupta (medida inválida) cae a la regla del código sin explotar", async () => {
    await guardarRegla(tiendaId, "auto", "2000-01-01", { ...zonas, medida: "otra" } as unknown as ReglaPago);
    const { regla } = await reglaVigente(FECHA, tiendaId, "auto");
    expect(regla).toEqual(REGLA_INICIAL);
  });
});
