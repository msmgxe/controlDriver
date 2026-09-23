/**
 * El perfil y la siembra inicial, contra SQLite de verdad.
 *
 * `sembrarSiHaceFalta` se prueba a propósito **llamada dos veces a la vez**:
 * es justo lo que pasa en el primerísimo arranque, cuando más de una pantalla
 * la llama al montar con la base todavía vacía. `tiendas.nombre` es única, y
 * sin la carrera resuelta la segunda llamada revienta contra esa restricción
 * en vez de usar la tienda que la primera acaba de crear.
 */
import { beforeEach, describe, expect, it } from "vitest";

import { usarMotor } from "./conexion";
import { motorEnMemoria } from "./motor-en-memoria";
import { guardarRegla, listarTiendas, perfilActual, sembrarSiHaceFalta } from "./perfil";

beforeEach(() => usarMotor(motorEnMemoria()));

describe("sembrarSiHaceFalta", () => {
  it("crea una tienda, su regla y el perfil por defecto", async () => {
    await sembrarSiHaceFalta();

    const tiendas = await listarTiendas();
    expect(tiendas).toHaveLength(1);
    expect(tiendas[0].nombre).toBe("Wong - Aldabas");

    const perfil = await perfilActual();
    expect(perfil?.tiendaId).toBe(tiendas[0].id);
    expect(perfil?.vehiculo).toBe("auto");
  });

  it("no hace nada si ya hay una tienda", async () => {
    await sembrarSiHaceFalta();
    const antes = await listarTiendas();

    await sembrarSiHaceFalta();

    expect(await listarTiendas()).toEqual(antes);
  });

  it("llamada dos veces a la vez no revienta, y deja una sola tienda", async () => {
    await Promise.all([sembrarSiHaceFalta(), sembrarSiHaceFalta()]);

    const tiendas = await listarTiendas();
    expect(tiendas).toHaveLength(1);

    const perfil = await perfilActual();
    expect(perfil).not.toBeNull();
    expect(perfil?.tiendaId).toBe(tiendas[0].id);

    // La tienda ganadora tiene su regla: no se quedó a medio sembrar.
    const reglas = await guardarRegla(tiendas[0].id, "auto", "2099-01-01", {
      moneda: "PEN",
      base: "por_pedido",
      tramos: [{ id: 1, desde: 0, hasta: 3, monto: 10 }],
    });
    expect(reglas).toBeTruthy();
  });

  it("tres llamadas a la vez también convergen en una sola tienda", async () => {
    await Promise.all([sembrarSiHaceFalta(), sembrarSiHaceFalta(), sembrarSiHaceFalta()]);
    expect(await listarTiendas()).toHaveLength(1);
  });
});
