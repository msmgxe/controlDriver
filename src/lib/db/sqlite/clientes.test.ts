/**
 * El cliente de un pedido, contra SQLite de verdad.
 */
import { beforeEach, describe, expect, it } from "vitest";

import { usarMotor } from "./conexion";
import { motorEnMemoria } from "./motor-en-memoria";
import { buscarPedidos, guardarJornada, jornadaPorFecha } from "./jornadas";
import { guardarCliente, guardarDistancia, pedidosPorNumero, quitarCliente } from "./clientes";
import { AJUSTES_DE_COMANDAS_POR_DEFECTO, guardarAjusteDeComandas, leerAjustesDeComandas } from "./ajustes";
import { crearRespaldo } from "./respaldo";
import { guardarMetodoDeDistancia, guardarUbicacionDeTienda, listarTiendas, guardarTienda } from "./perfil";
import type { JornadaParaGuardar } from "../tipos";
import type { FechaISO } from "@/lib/fechas";

const FECHA = "2026-09-16" as FechaISO;

const dia: JornadaParaGuardar = {
  fecha: FECHA,
  rutasDeclaradas: 1,
  ordenesDeclaradas: 3,
  validacionOk: true,
  horaEntrada: "09:00",
  horaSalida: "22:00",
  tiendaId: null,
  vehiculo: "auto",
  rutas: [{ numero: 1, estado: "Finalizado", horaInicio: "10:00", horaFin: "10:30" }],
  ordenes: [
    { codigo: "v12264655wofp-01", estado: "Entregado", posicion: 1, ruta: 1, tramo: 1, km: null, montoCentimos: 1000 },
    { codigo: "v12261836wofp-01", estado: "Entregado", posicion: 2, ruta: 1, tramo: 1, km: null, montoCentimos: 1000 },
    { codigo: "v12261836wofp-02", estado: "Entregado", posicion: 3, ruta: 1, tramo: 1, km: null, montoCentimos: 1000 },
  ],
};

async function idDe(codigo: string): Promise<string> {
  return (await jornadaPorFecha(FECHA))!.ordenes.find((o) => o.codigo === codigo)!.id;
}

beforeEach(async () => {
  usarMotor(motorEnMemoria());
  await guardarJornada(dia, "reemplazar");
});

describe("guardar el cliente", () => {
  it("un pedido nace sin cliente", async () => {
    const o = (await jornadaPorFecha(FECHA))!.ordenes[0];
    expect(o.cliente).toBeNull();
    expect(o.kmFuente).toBeNull();
    expect(o.tramoAuto).toBe(false);
    expect(o.fotos).toBe(0);
  });

  it("guarda solo lo que llega y deja lo demás como estaba", async () => {
    const id = await idDe("v12264655wofp-01");
    await guardarCliente(id, { nombre: "Claudia Castro", direccion: "Ca. Santa Carmela 182" });
    await guardarCliente(id, { telefono: "987 654 321" });
    const o = (await jornadaPorFecha(FECHA))!.ordenes.find((x) => x.id === id)!;
    expect(o.cliente).toEqual({
      nombre: "Claudia Castro",
      telefono: "987 654 321",
      direccion: "Ca. Santa Carmela 182",
      lat: null,
      lng: null,
    });
  });

  it("un texto vacío borra el dato", async () => {
    const id = await idDe("v12264655wofp-01");
    await guardarCliente(id, { nombre: "Claudia", telefono: "987 654 321" });
    await guardarCliente(id, { telefono: "   " });
    expect((await jornadaPorFecha(FECHA))!.ordenes.find((x) => x.id === id)!.cliente).toMatchObject({ nombre: "Claudia", telefono: null });
  });

  it("una ubicación necesita las dos coordenadas y que existan", async () => {
    const id = await idDe("v12264655wofp-01");
    await expect(guardarCliente(id, { lat: -12.1 })).rejects.toThrow(/latitud y longitud/);
    await expect(guardarCliente(id, { lat: 95, lng: 10 })).rejects.toThrow(/no es válida/);
    await guardarCliente(id, { lat: -12.1, lng: -77 });
    expect((await jornadaPorFecha(FECHA))!.ordenes.find((x) => x.id === id)!.cliente).toMatchObject({ lat: -12.1, lng: -77 });
  });

  it("no inventa un pedido que no existe", async () => {
    await expect(guardarCliente("no-existe", { nombre: "X" })).rejects.toThrow(/ya no existe/);
  });

  it("quitar al cliente borra sus datos y su distancia, pero no mueve el dinero", async () => {
    const id = await idDe("v12264655wofp-01");
    await guardarCliente(id, { nombre: "Claudia", lat: -12.1, lng: -77 });
    await guardarDistancia(id, { km: 4.2, kmFuente: "recta", tramo: 2, montoCentimos: 1150, tramoAuto: true });
    await quitarCliente(id);
    const o = (await jornadaPorFecha(FECHA))!.ordenes.find((x) => x.id === id)!;
    expect(o.cliente).toBeNull();
    expect(o.km).toBeNull();
    expect(o.tramoAuto).toBe(false);
    expect([o.tramo, o.montoCentimos]).toEqual([2, 1150]);
  });
});

describe("la distancia de un pedido", () => {
  it("guarda los km y de dónde salieron, y opcionalmente el tramo", async () => {
    const id = await idDe("v12264655wofp-01");
    await guardarDistancia(id, { km: 4.24, kmFuente: "ruta", tramo: 2, montoCentimos: 1150, tramoAuto: true });
    const o = (await jornadaPorFecha(FECHA))!.ordenes.find((x) => x.id === id)!;
    expect(o).toMatchObject({ km: 4.24, kmFuente: "ruta", tramo: 2, montoCentimos: 1150, tramoAuto: true });
  });

  it("solo los km, sin tocar el tramo", async () => {
    const id = await idDe("v12264655wofp-01");
    await guardarDistancia(id, { km: 2, kmFuente: "manual" });
    const o = (await jornadaPorFecha(FECHA))!.ordenes.find((x) => x.id === id)!;
    expect([o.km, o.tramo, o.montoCentimos, o.tramoAuto]).toEqual([2, 1, 1000, false]);
  });

  it("cambiar el tramo exige el monto", async () => {
    const id = await idDe("v12264655wofp-01");
    await expect(guardarDistancia(id, { km: 4, kmFuente: "recta", tramo: 2 })).rejects.toThrow(/monto/);
  });

  it("rechaza una distancia imposible", async () => {
    const id = await idDe("v12264655wofp-01");
    await expect(guardarDistancia(id, { km: -1, kmFuente: "recta" })).rejects.toThrow();
    await expect(guardarDistancia(id, { km: 5000, kmFuente: "recta" })).rejects.toThrow();
  });
});

describe("encontrar los pedidos de un despacho", () => {
  it("por el número, que es la parte del medio del código", async () => {
    const r = await pedidosPorNumero("12261836");
    expect(r.map((x) => x.codigo).sort()).toEqual(["v12261836wofp-01", "v12261836wofp-02"]);
    expect(r[0]).toMatchObject({ fecha: FECHA, ruta: 1, horaRuta: "10:00", tieneCliente: false });
  });

  it("los que ya tienen cliente van después de los que faltan", async () => {
    await guardarCliente(await idDe("v12261836wofp-01"), { nombre: "Omar" });
    const r = await pedidosPorNumero("12261836");
    expect(r.map((x) => x.codigo)).toEqual(["v12261836wofp-02", "v12261836wofp-01"]);
  });

  it("no encuentra lo que no existe, ni se deja engañar por comodines", async () => {
    expect(await pedidosPorNumero("99999999")).toEqual([]);
    expect(await pedidosPorNumero("%")).toEqual([]);
    expect(await pedidosPorNumero("1226")).toEqual([]);
  });
});

describe("buscar por lo que se sabe del cliente", () => {
  beforeEach(async () => {
    await guardarCliente(await idDe("v12264655wofp-01"), { nombre: "José Peña", telefono: "987 654 321", direccion: "Av. Los Álamos 120" });
    await guardarCliente(await idDe("v12261836wofp-01"), { nombre: "Omar Cisneros", telefono: "999 111 222" });
  });
  const rango = { desde: FECHA, hasta: FECHA };

  it("por nombre, sin importar tildes ni mayúsculas", async () => {
    expect((await buscarPedidos("jose pena", { ...rango, campo: "cliente" })).map((p) => p.codigo)).toEqual(["v12264655wofp-01"]);
    expect((await buscarPedidos("CISNEROS", { ...rango, campo: "cliente" })).map((p) => p.codigo)).toEqual(["v12261836wofp-01"]);
  });

  it("por teléfono, con o sin espacios y guiones", async () => {
    expect((await buscarPedidos("987-654", { ...rango, campo: "telefono" })).map((p) => p.codigo)).toEqual(["v12264655wofp-01"]);
    expect(await buscarPedidos("98", { ...rango, campo: "telefono" })).toEqual([]);
  });

  it("por dirección", async () => {
    expect((await buscarPedidos("alamos", { ...rango, campo: "direccion" })).map((p) => p.codigo)).toEqual(["v12264655wofp-01"]);
  });

  it("solo entre los pedidos que guardaron ese dato", async () => {
    expect(await buscarPedidos("", { ...rango, campo: "cliente" })).toHaveLength(2);
  });

  it("por código sigue igual, y trae el cliente si lo hay", async () => {
    const r = await buscarPedidos("12264655");
    expect(r).toHaveLength(1);
    expect(r[0].cliente?.nombre).toBe("José Peña");
  });
});

describe("volver a subir las capturas de un día", () => {
  it("conserva el cliente, la distancia y el tramo de los pedidos que siguen", async () => {
    const id = await idDe("v12264655wofp-01");
    await guardarCliente(id, { nombre: "Claudia", lat: -12.1, lng: -77 });
    await guardarDistancia(id, { km: 4.2, kmFuente: "recta", tramo: 2, montoCentimos: 1150, tramoAuto: true });

    // La misma carga otra vez, con todos los pedidos en tramo 1, como llegan de una captura.
    await guardarJornada(dia, "reemplazar");

    const o = (await jornadaPorFecha(FECHA))!.ordenes.find((x) => x.codigo === "v12264655wofp-01")!;
    expect(o.id).toBe(id);
    expect(o.cliente?.nombre).toBe("Claudia");
    expect([o.km, o.tramo, o.montoCentimos]).toEqual([4.2, 2, 1150]);
  });

  it("los que ya no vienen se borran, como siempre", async () => {
    await guardarJornada({ ...dia, ordenes: dia.ordenes.slice(0, 1) }, "reemplazar");
    expect((await jornadaPorFecha(FECHA))!.ordenes.map((o) => o.codigo)).toEqual(["v12264655wofp-01"]);
  });

  it("un pedido sin distancia sí toma el tramo que trae la captura", async () => {
    await guardarJornada(
      { ...dia, ordenes: dia.ordenes.map((o, i) => (i === 0 ? { ...o, tramo: 3, montoCentimos: 1300 } : o)) },
      "reemplazar",
    );
    const o = (await jornadaPorFecha(FECHA))!.ordenes.find((x) => x.codigo === "v12264655wofp-01")!;
    expect([o.tramo, o.montoCentimos]).toEqual([3, 1300]);
  });
});

describe("los ajustes de las comandas", () => {
  it("lo que nunca se tocó vale lo de por defecto: todo se guarda, menos en el respaldo", async () => {
    const a = await leerAjustesDeComandas();
    expect(a).toEqual(AJUSTES_DE_COMANDAS_POR_DEFECTO);
    expect(a).toMatchObject({ guardarNombre: true, guardarDireccion: true, guardarTelefono: true, clientesEnRespaldo: false });
  });

  it("se guardan uno a uno y se conservan", async () => {
    await guardarAjusteDeComandas("guardarTelefono", false);
    await guardarAjusteDeComandas("confirmarSiempre", false);
    expect(await leerAjustesDeComandas()).toMatchObject({ guardarTelefono: false, confirmarSiempre: false, guardarNombre: true });
    await guardarAjusteDeComandas("guardarTelefono", true);
    expect((await leerAjustesDeComandas()).guardarTelefono).toBe(true);
  });
});

describe("el respaldo", () => {
  beforeEach(async () => {
    await guardarCliente(await idDe("v12264655wofp-01"), { nombre: "Claudia", telefono: "987 654 321", direccion: "Ca. X 1", lat: -12.1, lng: -77 });
    await guardarDistancia(await idDe("v12264655wofp-01"), { km: 4.2, kmFuente: "recta", tramo: 2, montoCentimos: 1150, tramoAuto: true });
  });

  it("por defecto no lleva ningún dato del cliente, pero sí la distancia y el tramo", async () => {
    const r = await crearRespaldo();
    const fila = r.tablas.ordenes.find((o) => o.codigo === "v12264655wofp-01")!;
    expect(fila).not.toHaveProperty("cliente_nombre");
    expect(fila).not.toHaveProperty("cliente_telefono");
    expect(fila).not.toHaveProperty("direccion");
    expect(fila).not.toHaveProperty("lat");
    expect(fila).not.toHaveProperty("lng");
    expect(fila).toMatchObject({ km: 4.2, tramo: 2, monto_centimos: 1150 });
  });

  it("con incluirClientes, todo", async () => {
    const r = await crearRespaldo({ incluirClientes: true });
    expect(r.tablas.ordenes.find((o) => o.codigo === "v12264655wofp-01")).toMatchObject({
      cliente_nombre: "Claudia",
      cliente_telefono: "987 654 321",
      direccion: "Ca. X 1",
    });
  });
});

describe("la ubicación de la tienda", () => {
  it("nace sin ubicar y midiendo en línea recta", async () => {
    const id = await guardarTienda({ nombre: "Wong - Aldabas" });
    expect((await listarTiendas())[0]).toMatchObject({ id, lat: null, lng: null, metodoDistancia: "recta", factorCalles: 1.3 });
  });

  it("se ubica, se cambia el método y se puede volver a quitar", async () => {
    const id = await guardarTienda({ nombre: "Wong - Aldabas" });
    await guardarUbicacionDeTienda(id, { lat: -12.1, lng: -76.99, direccion: "Aldabas" });
    await guardarMetodoDeDistancia(id, "calles", 1.4);
    expect((await listarTiendas())[0]).toMatchObject({ lat: -12.1, lng: -76.99, direccion: "Aldabas", metodoDistancia: "calles", factorCalles: 1.4 });

    await guardarMetodoDeDistancia(id, "recta");
    expect((await listarTiendas())[0]).toMatchObject({ metodoDistancia: "recta", factorCalles: 1.4 });

    await guardarUbicacionDeTienda(id, null);
    expect((await listarTiendas())[0]).toMatchObject({ lat: null, lng: null });
  });

  it("no acepta un factor de calles absurdo", async () => {
    const id = await guardarTienda({ nombre: "Wong - Aldabas" });
    await expect(guardarMetodoDeDistancia(id, "calles", 0.5)).rejects.toThrow(/entre 1 y 3/);
    await expect(guardarMetodoDeDistancia(id, "calles", 9)).rejects.toThrow(/entre 1 y 3/);
  });
});
