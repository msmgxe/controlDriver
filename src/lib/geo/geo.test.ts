import { describe, expect, it } from "vitest";

import { REGLA_INICIAL } from "@/lib/pagos/reglas";

import { kmEnLinea, rumbo } from "./distancia";
import { enlaceDeMapa, esEnlaceCorto, primerEnlace, puntoDeTexto } from "./enlaces";
import { distanciaAlCliente, tramoPorDistancia, type OrigenDeMedida } from "./tramo";

const LIMA = { lat: -12.0464, lng: -77.0428 };

describe("kmEnLinea", () => {
  it("es cero entre un punto y él mismo", () => {
    expect(kmEnLinea(LIMA, LIMA)).toBe(0);
  });

  it("un grado de latitud son unos 111 km", () => {
    expect(kmEnLinea({ lat: 0, lng: 0 }, { lat: 1, lng: 0 })).toBeCloseTo(111.2, 0);
  });

  it("acierta una distancia conocida: Lima–Callao, unos 11 km", () => {
    const callao = { lat: -12.0566, lng: -77.1181 };
    expect(kmEnLinea(LIMA, callao)).toBeGreaterThan(7);
    expect(kmEnLinea(LIMA, callao)).toBeLessThan(9);
  });

  it("es simétrica", () => {
    const b = { lat: -12.1, lng: -76.98 };
    expect(kmEnLinea(LIMA, b)).toBeCloseTo(kmEnLinea(b, LIMA), 10);
  });
});

describe("rumbo", () => {
  it("al norte, 0°; al este, 90°", () => {
    expect(rumbo({ lat: 0, lng: 0 }, { lat: 1, lng: 0 })).toBeCloseTo(0, 5);
    expect(rumbo({ lat: 0, lng: 0 }, { lat: 0, lng: 1 })).toBeCloseTo(90, 5);
    expect(rumbo({ lat: 0, lng: 0 }, { lat: -1, lng: 0 })).toBeCloseTo(180, 5);
  });
});

describe("puntoDeTexto", () => {
  it("lee el @lat,lng de un enlace de Google Maps", () => {
    expect(puntoDeTexto("https://www.google.com/maps/place/Wong/@-12.1015,-76.9906,17z/data=!3m1")).toEqual({
      lat: -12.1015,
      lng: -76.9906,
    });
  });

  it("prefiere el punto exacto !3d…!4d… cuando está", () => {
    expect(puntoDeTexto("https://www.google.com/maps/place/X/data=!3d-12.11!4d-76.99")).toEqual({ lat: -12.11, lng: -76.99 });
  });

  it("lee ?q= y ll=", () => {
    expect(puntoDeTexto("https://maps.google.com/?q=-12.09,-76.97")).toEqual({ lat: -12.09, lng: -76.97 });
    expect(puntoDeTexto("https://maps.google.com/?ll=-12.09%2C-76.97&z=15")).toEqual({ lat: -12.09, lng: -76.97 });
  });

  it("lee coordenadas sueltas", () => {
    expect(puntoDeTexto("-12.0895, -76.9704")).toEqual({ lat: -12.0895, lng: -76.9704 });
    expect(puntoDeTexto("  -12.0895 -76.9704 ")).toEqual({ lat: -12.0895, lng: -76.9704 });
  });

  it("no inventa nada de un texto que no trae coordenadas", () => {
    expect(puntoDeTexto("")).toBeNull();
    expect(puntoDeTexto("Wong Aldabas, Surco")).toBeNull();
    expect(puntoDeTexto("https://maps.app.goo.gl/abc123")).toBeNull();
  });

  it("rechaza coordenadas que no existen", () => {
    expect(puntoDeTexto("95.0, 10.0")).toBeNull();
  });

  it("reconoce un enlace corto, que hay que abrir para saber adónde lleva", () => {
    expect(esEnlaceCorto("Mira: https://maps.app.goo.gl/abc123")).toBe(true);
    expect(esEnlaceCorto("https://www.google.com/maps/@-12,-77,15z")).toBe(false);
    expect(primerEnlace("Mira este lugar: https://maps.app.goo.gl/abc123 gracias")).toBe("https://maps.app.goo.gl/abc123");
  });

  it("arma el enlace para ver un punto", () => {
    expect(enlaceDeMapa({ lat: -12.1, lng: -77 })).toBe("https://www.google.com/maps/search/?api=1&query=-12.100000,-77.000000");
  });
});

const TIENDA: OrigenDeMedida = { punto: LIMA, metodo: "recta", factorCalles: 1.3 };
const A_TRES_KM = { lat: LIMA.lat, lng: LIMA.lng + 3 / 108.9 }; // ~3 km al este

describe("distanciaAlCliente", () => {
  it("en línea recta: la línea recta, sin pedir nada", async () => {
    let pidio = false;
    const d = await distanciaAlCliente(TIENDA, A_TRES_KM, async () => { pidio = true; return 9; });
    expect(pidio).toBe(false);
    expect(d.fuente).toBe("recta");
    expect(d.km).toBeCloseTo(3, 0);
  });

  it("por calles: usa la ruta cuando el servicio la da", async () => {
    const d = await distanciaAlCliente({ ...TIENDA, metodo: "calles" }, A_TRES_KM, async () => 4.37);
    expect(d).toMatchObject({ km: 4.4, fuente: "ruta" });
    expect(d.enLinea).toBeCloseTo(3, 0);
  });

  it("por calles sin señal: estima con el factor, y lo dice", async () => {
    const sinRed = async () => null;
    const d = await distanciaAlCliente({ ...TIENDA, metodo: "calles", factorCalles: 1.5 }, A_TRES_KM, sinRed);
    expect(d.fuente).toBe("estimado");
    expect(d.km).toBeCloseTo(d.enLinea * 1.5, 0);
  });

  it("por calles, si pedir la ruta revienta, también estima", async () => {
    const d = await distanciaAlCliente({ ...TIENDA, metodo: "calles" }, A_TRES_KM, async () => { throw new Error("sin red"); });
    expect(d.fuente).toBe("estimado");
  });
});

describe("tramoPorDistancia (tarifa de Wong - Aldabas)", () => {
  it("3.0 km sigue en el tramo 1 y 3.1 pasa al 2", () => {
    expect(tramoPorDistancia(REGLA_INICIAL, 3.0)).toEqual({ tramo: 1, montoCentimos: 1000 });
    expect(tramoPorDistancia(REGLA_INICIAL, 3.1)).toEqual({ tramo: 2, montoCentimos: 1150 });
  });

  it("redondea a la décima antes de decidir", () => {
    expect(tramoPorDistancia(REGLA_INICIAL, 3.04).tramo).toBe(1);
    expect(tramoPorDistancia(REGLA_INICIAL, 3.06).tramo).toBe(2);
  });

  it("los cinco tramos de la tabla", () => {
    expect([2.5, 5, 9, 10.5, 12].map((km) => tramoPorDistancia(REGLA_INICIAL, km).tramo)).toEqual([1, 2, 3, 4, 5]);
  });

  it("más de 12 km no tiene monto: lo escribe la persona", () => {
    expect(tramoPorDistancia(REGLA_INICIAL, 12.1)).toEqual({ tramo: 6, montoCentimos: null });
  });
});
