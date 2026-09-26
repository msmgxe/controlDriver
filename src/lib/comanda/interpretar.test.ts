/**
 * Las hojas de despacho de verdad.
 *
 * Los textos y las posiciones salen de las dos fotos que mandó el repartidor
 * (tres hojas: una en una foto y dos en otra). No son lo que devolvió el lector
 * de un teléfono —eso solo se ve en el teléfono—, sino lo que se lee a simple
 * vista en cada foto, con la disposición real: etiquetas vacías a la izquierda,
 * valores en una columna a la derecha, un sello en medio y la etiqueta de
 * «DESPACHO» con letra a mano debajo.
 */
import { describe, expect, it } from "vitest";

import { codigoDeDespacho, consultaParaMapa, interpretarComandas, partirDireccion, type LineaLeida } from "./interpretar";

const L = (texto: string, x: number, y: number, w: number, h: number, confianza: number | null = 0.9): LineaLeida => ({ texto, x, y, w, h, confianza });

/* Foto 1 · 1200×1600 · Claudia Castro · el teléfono se cortó por el borde derecho. */
const FOTO_1: LineaLeida[] = [
  L("Hoja de despacho Nº 12264655", 36, 580, 465, 40, 0.95),
  L("Nombre del Cliente:", 45, 660, 190, 25),
  L("Dirección de Despacho:", 48, 725, 225, 25),
  L("Distrito:", 50, 790, 90, 25),
  L("Persona Autorizada para Recibir:", 52, 815, 315, 25),
  L("FACTURADO", 650, 600, 300, 50, 0.5),
  L("X", 630, 690, 30, 30, 0.3),
  L("24 SEP. 2026", 710, 715, 190, 45, 0.5),
  L("WONG ONLINE", 710, 790, 190, 25, 0.4),
  L("CENCOSUD RETAIL PERÚ S.A.", 625, 805, 340, 35, 0.5),
  L("T-115", 765, 830, 75, 20, 0.5),
  L("Claudia Castro", 963, 643, 190, 25, 0.97),
  L("Ca. Santa Carmela 182,", 963, 673, 205, 25, 0.96),
  L("SANTIAGO DE SURCO", 963, 695, 200, 25, 0.96),
  L("(CP 150140), LIMA,", 963, 720, 190, 25, 0.92),
  L("Lima", 963, 745, 45, 25, 0.95),
  L("LIMA", 963, 775, 45, 25, 0.95),
  L("Te", 1175, 775, 25, 25, 0.5),
  L("Claudia Castro", 963, 800, 190, 25, 0.96),
  L("ONG.PE", 0, 868, 130, 45, 0.6),
  L("DESPACHO", 325, 845, 180, 35, 0.9),
  L("MOCHILAS:", 433, 888, 130, 25, 0.8),
  L("24/09", 10, 935, 90, 40, 0.4),
  L("VENTANA: 11-12", 130, 925, 130, 45, 0.4),
  L("NÚMERO DE PEDIDO:", 5, 990, 200, 25, 0.7),
  L("Claudia Castro", 95, 1190, 290, 60, 0.35),
  L("001T115Entrega a", 962, 890, 210, 25, 0.9),
  L("domicilio", 962, 915, 90, 25, 0.9),
  L("24-09-26", 960, 955, 90, 25, 0.9),
  L("T115 ENT_DOMIC", 960, 995, 150, 25, 0.9),
  L("09869635", 960, 1055, 90, 25, 0.9),
  L("S/ 62.98", 960, 1145, 80, 25, 0.9),
  L("7027661000303143198", 960, 1172, 240, 25, 0.9),
  L("Descripción", 115, 1437, 130, 25, 0.9),
  L("Pierna con Encuentro de Pollo x kg", 118, 1470, 285, 25, 0.9),
  L("227891", 565, 1470, 60, 25, 0.9),
];

/* Foto 2 · 1200×1600 · dos hojas, una debajo de la otra. */
const FOTO_2: LineaLeida[] = [
  // Ruido del voucher y del dedo, encima de la primera hoja.
  L("BEL 4253", 540, 505, 90, 20, 0.2),
  L("TEL 1000350", 560, 525, 140, 20, 0.2),
  // Hoja A
  L("espacho Nº 12261836", 0, 625, 370, 40, 0.9),
  L("liente:", 0, 715, 70, 25, 0.8),
  L("Despacho:", 0, 785, 105, 25, 0.9),
  L("rizada para Recibir:", 0, 885, 200, 25, 0.9),
  L("FACTURADO", 400, 650, 340, 60, 0.4),
  L("Omar Cisneros", 847, 697, 135, 25, 0.96),
  L("Avenida Caminos del", 848, 728, 190, 25, 0.95),
  L("Inca 2685 Dpto 4C,", 848, 753, 190, 25, 0.95),
  L("Santiago De Surco (CP", 848, 777, 205, 25, 0.93),
  L("150140), Lima, Lima", 848, 802, 200, 25, 0.93),
  L("LIMA", 852, 835, 45, 25, 0.95),
  L("Teléfono: +", 1078, 830, 120, 25, 0.9),
  L("Omar Cisneros", 852, 866, 140, 25, 0.95),
  // Hoja B
  L("despacho Nº 12261815", 0, 1050, 385, 40, 0.94),
  L("l Cliente:", 0, 1160, 100, 25, 0.8),
  L("le Despacho:", 0, 1260, 135, 25, 0.8),
  L("utorizada para Recibir:", 0, 1395, 245, 25, 0.8),
  L("FACTURADO", 475, 1100, 350, 60, 0.5),
  L("23 SEP. 2026", 555, 1230, 215, 45, 0.5),
  L("Elsa Patricia", 962, 1145, 125, 25, 0.96),
  L("Tizon", 962, 1172, 55, 25, 0.96),
  L("Jirón Los Molles", 962, 1208, 160, 25, 0.95),
  L("167, SANTIAGO", 962, 1235, 155, 25, 0.95),
  L("DE SURCO (CP", 962, 1262, 150, 25, 0.93),
  L("150140), LIMA,", 962, 1288, 150, 25, 0.93),
  L("Lima", 962, 1315, 45, 25, 0.95),
  L("LIMA", 962, 1350, 45, 25, 0.95),
  L("Teléf", 1140, 1350, 60, 25, 0.6),
  L("Elsa Patricia", 962, 1385, 125, 25, 0.96),
  L("Tizon", 962, 1412, 55, 25, 0.96),
  L("DESPACHO", 205, 1462, 210, 40, 0.9),
];

const TAMANO = { ancho: 1200, alto: 1600 };

describe("una hoja de despacho en una foto", () => {
  const [hoja] = interpretarComandas(FOTO_1, TAMANO);

  it("saca el número de despacho, que es parte del código del pedido", () => {
    expect(hoja.numero.valor).toBe("12264655");
    expect(codigoDeDespacho(hoja.numero.valor!)).toBe("v12264655wofp-01");
  });

  it("saca el nombre de la columna de la derecha, no el escrito a mano de la etiqueta", () => {
    expect(hoja.nombre.valor).toBe("Claudia Castro");
    expect(hoja.nombre.confianza).toBeGreaterThan(0.85);
  });

  it("junta la dirección de varias líneas y la parte en calle y distrito", () => {
    expect(hoja.direccion.valor).toBe("Ca. Santa Carmela 182, SANTIAGO DE SURCO (CP 150140), LIMA,");
    expect(hoja.calle).toBe("Ca. Santa Carmela 182");
    expect(hoja.distrito).toBe("SANTIAGO DE SURCO");
    expect(hoja.consultaDeMapa).toBe("Ca. Santa Carmela 182, SANTIAGO DE SURCO, Lima, Perú");
  });

  it("no inventa un teléfono que se cortó por el borde de la foto", () => {
    expect(hoja.telefono.valor).toBeNull();
    expect(hoja.telefono.confianza).toBe(0);
  });

  it("lee la fecha del renglón «24-09-26»", () => {
    expect(hoja.fecha.valor).toBe("2026-09-24");
  });
});

describe("dos hojas en la misma foto", () => {
  const hojas = interpretarComandas(FOTO_2, TAMANO);

  it("las separa por su título", () => {
    expect(hojas).toHaveLength(2);
    expect(hojas.map((h) => h.numero.valor)).toEqual(["12261836", "12261815"]);
  });

  it("lee la primera aunque a la etiqueta le falte la mitad y haya ruido encima", () => {
    const [a] = hojas;
    expect(a.nombre.valor).toBe("Omar Cisneros");
    expect(a.calle).toBe("Avenida Caminos del Inca 2685 Dpto 4C");
    expect(a.distrito).toBe("Santiago De Surco");
    expect(a.telefono.valor).toBeNull();
  });

  it("une un nombre partido en dos líneas y no arrastra el que se repite abajo", () => {
    const b = hojas[1];
    expect(b.nombre.valor).toBe("Elsa Patricia Tizon");
    expect(b.calle).toBe("Jirón Los Molles 167");
    expect(b.distrito).toBe("SANTIAGO DE SURCO");
  });

  it("toma la fecha del sello cuando es lo único que hay, con menos confianza", () => {
    const b = hojas[1];
    expect(b.fecha.valor).toBe("2026-09-23");
    expect(b.fecha.confianza).toBeLessThan(0.6);
  });
});

describe("sin posiciones, solo con el orden del texto", () => {
  it("lee lo mismo", () => {
    const sinCajas = FOTO_2.map((l) => ({ ...l, x: 0, y: 0, w: 0, h: 0 }));
    const hojas = interpretarComandas(sinCajas, TAMANO);
    expect(hojas.map((h) => h.numero.valor)).toEqual(["12261836", "12261815"]);
    expect(hojas[0].nombre.valor).toBe("Omar Cisneros");
    expect(hojas[1].nombre.valor).toBe("Elsa Patricia Tizon");
    expect(hojas[1].calle).toBe("Jirón Los Molles 167");
  });
});

describe("el teléfono", () => {
  const conTelefono = (texto: string) =>
    interpretarComandas([...FOTO_1, L(texto, 1050, 775, 150, 25, 0.9)], TAMANO)[0].telefono.valor;

  it("acepta el formato de Lima con o sin +51", () => {
    expect(conTelefono("Teléfono: +51 987 654 321")).toBe("987 654 321");
    expect(conTelefono("Teléfono: 987654321")).toBe("987 654 321");
    expect(conTelefono("987-654-321")).toBe("987 654 321");
  });

  it("no toma por teléfono un número largo cualquiera", () => {
    // La hoja ya trae «7027661000303143198» y no es un teléfono.
    expect(interpretarComandas(FOTO_1, TAMANO)[0].telefono.valor).toBeNull();
  });
});

describe("una foto que no se pudo leer", () => {
  it("devuelve una comanda vacía, no nada", () => {
    const [c] = interpretarComandas([L("▒▒ ▒▒▒", 100, 100, 80, 20, 0.1)], TAMANO);
    expect(c.numero.valor).toBeNull();
    expect(c.nombre.valor).toBeNull();
    expect(c.direccion.valor).toBeNull();
    expect(c.consultaDeMapa).toBeNull();
  });

  it("también sin ninguna línea", () => {
    expect(interpretarComandas([], TAMANO)).toHaveLength(1);
  });

  it("baja la confianza cuando el lector duda", () => {
    const dudosa = FOTO_1.map((l) => ({ ...l, confianza: l.texto === "Claudia Castro" ? 0.4 : l.confianza }));
    expect(interpretarComandas(dudosa, TAMANO)[0].nombre.confianza).toBeLessThan(0.5);
  });

  it("si el lector no da confianza, se fía de la forma del dato", () => {
    const sinConfianza = FOTO_1.map((l) => ({ ...l, confianza: null }));
    const [h] = interpretarComandas(sinConfianza, TAMANO);
    expect(h.nombre.confianza).toBeGreaterThan(0.8);
    expect(h.direccion.confianza).toBeGreaterThan(0.8);
  });

  it("corrige letras que se leyeron en vez de cifras en el número", () => {
    const c = interpretarComandas([L("Hoja de despacho Nº 1226465S", 36, 580, 465, 40)], TAMANO)[0];
    expect(c.numero.valor).toBe("12264655");
  });
});

describe("partir una dirección", () => {
  it("quita el código postal y la provincia", () => {
    expect(partirDireccion("Jirón Los Molles 167, SANTIAGO DE SURCO (CP 150140), LIMA, Lima")).toEqual({
      calle: "Jirón Los Molles 167",
      distrito: "SANTIAGO DE SURCO",
    });
  });

  it("sin distrito, deja todo como calle", () => {
    expect(partirDireccion("Av. Primavera 1234")).toEqual({ calle: "Av. Primavera 1234", distrito: null });
  });

  it("el departamento no es un distrito", () => {
    expect(partirDireccion("Av. Uno 12, Dpto 4")).toEqual({ calle: "Av. Uno 12, Dpto 4", distrito: null });
  });
});

describe("la consulta para el mapa", () => {
  it("quita el departamento, que el buscador no entiende", () => {
    expect(consultaParaMapa("Avenida Caminos del Inca 2685 Dpto 4C", "Santiago De Surco")).toBe(
      "Avenida Caminos del Inca 2685, Santiago De Surco, Lima, Perú",
    );
  });

  it("sin calle no hay consulta", () => {
    expect(consultaParaMapa(null, "Surco")).toBeNull();
  });
});
