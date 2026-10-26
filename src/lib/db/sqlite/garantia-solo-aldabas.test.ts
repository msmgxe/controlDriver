/**
 * La garantía por permanencia (el «mínimo de S/ 130») es de Wong - Aldabas, por un
 * tiempo. No puede salir en otra tienda ni aparecer por no tener regla propia.
 */
import { beforeEach, describe, expect, it } from "vitest";

import type { FechaISO } from "@/lib/fechas";
import { REGLA_INICIAL, REGLA_SIN_GARANTIA } from "@/lib/pagos/reglas";

import { ejecutar, usarMotor } from "./conexion";
import { RELLENOS_TRAS_MIGRAR } from "./esquema";
import { guardarJornada, reglaVigente, resumenPorRango } from "./jornadas";
import { motorEnMemoria } from "./motor-en-memoria";
import { guardarPerfil, guardarRegla, guardarTienda } from "./perfil";
import type { JornadaParaGuardar } from "../tipos";

const FECHA = "2026-10-20" as FechaISO;

const dia = (tiendaId: string | null, pedidos: number): JornadaParaGuardar => ({
  fecha: FECHA,
  rutasDeclaradas: 1,
  ordenesDeclaradas: pedidos,
  validacionOk: true,
  horaEntrada: "09:00",
  horaSalida: "22:00",
  tiendaId,
  vehiculo: "auto",
  rutas: [{ numero: 1, estado: "Finalizado", horaInicio: "10:00", horaFin: "11:00" }],
  ordenes: Array.from({ length: pedidos }, (_, i) => ({
    codigo: `v1000000${i}wofp-01`,
    estado: "Entregado",
    posicion: i + 1,
    ruta: 1,
    tramo: 1,
    km: null,
    montoCentimos: 1000,
  })),
});

/** Corre los rellenos tal como el arranque: una sentencia por entrada, y las de varias partes por partes. */
async function correrRellenos() {
  for (const bloque of RELLENOS_TRAS_MIGRAR) {
    for (const parte of bloque.split(";").map((p) => p.trim()).filter(Boolean)) await ejecutar(parte, []);
  }
}

beforeEach(() => usarMotor(motorEnMemoria()));

describe("la garantía no se cuela en otras tiendas", () => {
  it("una tienda sin regla propia cobra los pedidos, sin piso", async () => {
    const aurora = await guardarTienda({ nombre: "Wong Aurora" });
    expect((await reglaVigente(FECHA, aurora, "auto")).regla).toEqual(REGLA_SIN_GARANTIA);

    await guardarPerfil({ nombre: "Yo", tiendaId: aurora, vehiculo: "auto", horaEntrada: "09:00", horaSalida: "22:00" });
    await guardarJornada(dia(aurora, 2), "reemplazar");
    const [d] = await resumenPorRango(FECHA, FECHA);
    expect(d.montoCentimos).toBe(2_000);
    expect(d.pagaPor).toBe("pedidos");
  });

  it("Aldabas, con su regla, sí cobra el piso de 13 h × S/ 10", async () => {
    const aldabas = await guardarTienda({ nombre: "Wong - Aldabas" });
    await guardarRegla(aldabas, "auto", "2000-01-01", REGLA_INICIAL);
    await guardarPerfil({ nombre: "Yo", tiendaId: aldabas, vehiculo: "auto", horaEntrada: "09:00", horaSalida: "22:00" });
    await guardarJornada(dia(aldabas, 2), "reemplazar");
    const [d] = await resumenPorRango(FECHA, FECHA);
    expect(d.montoCentimos).toBe(13_000);
    expect(d.pagaPor).toBe("permanencia");
  });

  it("terminar la garantía desde una fecha: antes cobra el piso, desde ahí no", async () => {
    const aldabas = await guardarTienda({ nombre: "Wong - Aldabas" });
    await guardarRegla(aldabas, "auto", "2000-01-01", REGLA_INICIAL);
    await guardarRegla(aldabas, "auto", "2026-10-20", { ...REGLA_INICIAL, garantiaPermanencia: null });
    expect((await reglaVigente("2026-10-19" as FechaISO, aldabas, "auto")).regla.garantiaPermanencia?.activa).toBe(true);
    expect((await reglaVigente("2026-10-20" as FechaISO, aldabas, "auto")).regla.garantiaPermanencia ?? null).toBeNull();
  });
});

describe("limpieza única de lo que ya se coló", () => {
  it("quita la garantía de las reglas de otras tiendas, deja la de Aldabas, y no repite", async () => {
    const aldabas = await guardarTienda({ nombre: "Wong - Aldabas" });
    const aurora = await guardarTienda({ nombre: "Wong Aurora" });
    await guardarRegla(aldabas, "auto", "2000-01-01", REGLA_INICIAL);
    await guardarRegla(aurora, "auto", "2026-10-19", REGLA_INICIAL); // la copia que se coló

    await correrRellenos();
    expect((await reglaVigente(FECHA, aurora, "auto")).regla.garantiaPermanencia ?? null).toBeNull();
    expect((await reglaVigente(FECHA, aldabas, "auto")).regla.garantiaPermanencia?.activa).toBe(true);

    // Si luego se activa a propósito en Aurora, el siguiente arranque no se la quita.
    await guardarRegla(aurora, "auto", "2026-10-21", REGLA_INICIAL);
    await correrRellenos();
    expect((await reglaVigente("2026-10-21" as FechaISO, aurora, "auto")).regla.garantiaPermanencia?.activa).toBe(true);
  });
});
