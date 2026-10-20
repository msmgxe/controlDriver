/**
 * Hojas de despacho de Metro (fotos del 01 y 02/10/2026): el número es de 7
 * cifras, la dirección no siempre empieza por «Av.» o «Jr.», y el teléfono se
 * corta por el borde derecho. Los textos y las posiciones son lo que se lee a
 * simple vista en cada foto (1200×1600).
 */
import { describe, expect, it } from "vitest";

import { codigoDeDespacho, interpretarComandas, siguienteLetra, type LineaLeida } from "./interpretar";

const L = (texto: string, x: number, y: number, w: number, h: number, confianza: number | null = 0.9): LineaLeida => ({ texto, x, y, w, h, confianza });
const TAM = { ancho: 1200, alto: 1600 };

/* Alexis Vizcarra · «Algeciras 181»: sin vía. DNI suelto: 09597255. */
const ALEXIS: LineaLeida[] = [
  L("de despacho Nº 7106635", 0, 755, 395, 40, 0.93),
  L("Alexis Vizcarra", 565, 828, 150, 22),
  L("Algeciras 181, SAN LUIS (CP 150134)", 565, 856, 335, 22),
  L("LIMA, Lima", 565, 884, 100, 22),
  L("LIMA", 565, 917, 45, 22),
  L("Teléfono:", 938, 917, 90, 22),
  L("+5199", 1135, 917, 60, 22, 0.7),
  L("Alexis Vizcarra", 568, 946, 150, 22),
  L("FACTURAL", 897, 790, 300, 55, 0.4),
  L("001H003Entrega a domicilio", 572, 1035, 270, 22),
  L("02-10-26", 572, 1073, 90, 22),
  L("Fecha de Venta:", 938, 1078, 170, 22),
  L("Ventana Horaria:", 938, 1115, 180, 22),
  L("17:00:00 -", 1130, 1155, 70, 22),
  L("H003 ENT_DOMIC (Normal)", 575, 1110, 245, 22),
  L("09597255", 577, 1158, 90, 22),
  L("S/ 211.51", 580, 1222, 80, 22),
];

/* yane vargas · «Victor Maldonado Begazo 580 903»: sin vía y partida en dos líneas. */
const YANE: LineaLeida[] = [
  L("oja de despacho Nº 7106035", 0, 730, 405, 40, 0.93),
  L("yane vargas", 567, 810, 105, 22),
  L("Victor Maldonado Begazo 580 903,", 567, 840, 335, 22),
  L("MIRAFLORES (CP 150122), LIMA, Lima", 567, 868, 345, 22),
  L("LIMA", 567, 897, 45, 22),
  L("yane vargas", 567, 927, 105, 22),
  L("Teléfono:", 962, 900, 90, 22),
  L("9879", 1150, 900, 50, 22, 0.6),
  L("40555458", 567, 1154, 90, 22),
  L("S/ 130.60", 567, 1222, 80, 22),
];

/* Dos hojas en una foto, con el voucher de Niubiz pegado en medio. */
const MONICA: LineaLeida[] = [
  L("pacho Nº 12289138", 0, 718, 275, 36, 0.9),
  L("niubiz:", 372, 685, 270, 50, 0.7),
  L("WONG LAS GARDENIAS DV - 100106971", 345, 868, 400, 22, 0.8),
  L("S/ 101.70", 440, 1018, 170, 30, 0.9),
  L("Monica Zegarra", 757, 765, 140, 22),
  L("Avenida Monterrico Sur", 757, 795, 245, 22),
  L("110 203, SANTIAGO DE", 757, 822, 215, 22),
  L("SURCO (CP 150140), LIMA,", 757, 850, 250, 22),
  L("Lima", 757, 878, 45, 22),
  L("LIMA", 757, 905, 45, 22),
  L("Teléfono: 999", 1035, 905, 160, 22),
  L("Monica Zegarra", 757, 934, 140, 22),
  L("Total", 1035, 1215, 60, 22),
  L("Productos", 1035, 1240, 100, 22),
];

describe("hojas de despacho de Metro", () => {
  it("lee el número de 7 cifras de la hoja y arma su código", () => {
    const [c] = interpretarComandas(ALEXIS, TAM);
    expect(c.numero.valor).toBe("7106635");
    expect(codigoDeDespacho(c.numero.valor!)).toBe("7106635");
  });

  it("encuentra el nombre y la dirección aunque no empiece por Av. o Jr.", () => {
    const [c] = interpretarComandas(ALEXIS, TAM);
    expect(c.nombre.valor).toBe("Alexis Vizcarra");
    expect(c.calle).toBe("Algeciras 181");
    expect(c.distrito).toBe("SAN LUIS");
  });

  it("una dirección sin vía partida en dos líneas sale entera", () => {
    const [c] = interpretarComandas(YANE, TAM);
    expect(c.numero.valor).toBe("7106035");
    expect(c.nombre.valor).toBe("yane vargas");
    expect(c.calle).toBe("Victor Maldonado Begazo 580 903");
    expect(c.distrito).toBe("MIRAFLORES");
  });

  it("no toma el DNI por teléfono", () => {
    expect(interpretarComandas(ALEXIS, TAM)[0].telefono.valor).toBeNull();
  });

  it("un teléfono cortado por el borde sale parcial y con confianza baja, o vacío si es muy poco", () => {
    const [m] = interpretarComandas(MONICA, TAM);
    expect(m.telefono.valor).toBeNull(); // «999» no alcanza
    const [y] = interpretarComandas(YANE, TAM);
    expect(y.telefono.valor).toBe("987 9");
    expect(y.telefono.confianza).toBeLessThan(0.4);
  });

  it("con el voucher en medio, la dirección sigue siendo la de la columna de la derecha", () => {
    const [c] = interpretarComandas(MONICA, TAM);
    expect(c.nombre.valor).toBe("Monica Zegarra");
    expect(c.calle).toBe("Avenida Monterrico Sur 110 203");
    expect(c.distrito).toBe("SANTIAGO DE SURCO");
  });

  it("lee la ventana de entrega partida en dos líneas", () => {
    const conVentana = [...ALEXIS, L("18:00:59", 1130, 1180, 70, 22)];
    expect(interpretarComandas(conVentana, TAM)[0].ventana.valor).toBe("17:00–18:00");
  });

  it("los números de 8 cifras de Wong siguen funcionando", () => {
    expect(interpretarComandas(MONICA, TAM)[0].numero.valor).toBe("12289138");
  });
});

describe("disposición de la hoja", () => {
  it("el teléfono partido en dos trozos en la fila de «Teléfono:» se junta", () => {
    const partido = [
      ...ALEXIS.filter((l) => l.texto !== "+5199"),
      L("+51 987", 1050, 917, 80, 22),
      L("654 321", 1135, 917, 60, 22),
    ];
    expect(interpretarComandas(partido, TAM)[0].telefono.valor).toBe("987 654 321");
  });

  it("el nombre ocupa como mucho dos líneas, justo encima de la dirección", () => {
    const [c] = interpretarComandas(
      [
        L("de despacho Nº 7106635", 0, 755, 395, 40, 0.93),
        L("Elsa Patricia", 565, 800, 150, 22),
        L("Tizon Garcia", 565, 828, 150, 22),
        L("Algeciras 181, SAN LUIS (CP 150134)", 565, 856, 335, 22),
        L("LIMA, Lima", 565, 884, 100, 22),
      ],
      TAM,
    );
    expect(c.nombre.valor).toBe("Elsa Patricia Tizon Garcia");
  });
});

describe("letra para diferenciar un pedido repetido", () => {
  it("propone la primera letra libre, empezando en «b»", () => {
    expect(siguienteLetra("7106635", ["7106635"])).toBe("b");
    expect(siguienteLetra("7106635", ["7106635", "7106635b"])).toBe("c");
  });
});
