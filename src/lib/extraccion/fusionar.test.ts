import type { ImagenExtraida } from "./esquema";
import { describe, expect, it } from "vitest";
import { parsearRespuestas } from "./esquema";
import { fusionarCapturas, fusionarPorFecha } from "./fusionar";
import { hayBloqueos, validarJornada } from "./validar";

/* ---------------------------------------------------------------------------
 * Caso de ejemplo de §16 — 5 capturas del 16/09/2026
 *
 * 2 de Rutas y 3 de Órdenes. Resultado esperado: 7 rutas y 14 pedidos.
 * Duplicados que deben colapsar: las rutas 2 a 6, y los pedidos v12237397,
 * v12240699 y v12240588.
 * ------------------------------------------------------------------------- */

const FECHA = "2026-09-16";

const RUTAS = [
  { numero: 1, estado: "Finalizado", hora_inicio: "10:03", hora_fin: "10:27" },
  { numero: 2, estado: "Finalizado", hora_inicio: "11:04", hora_fin: "11:22" },
  { numero: 3, estado: "Finalizado", hora_inicio: "12:09", hora_fin: "12:24" },
  { numero: 4, estado: "Finalizado", hora_inicio: "13:20", hora_fin: "14:00" },
  { numero: 5, estado: "Finalizado", hora_inicio: "15:12", hora_fin: "15:42" },
  { numero: 6, estado: "Finalizado", hora_inicio: "16:52", hora_fin: "17:10" },
  { numero: 7, estado: "Finalizado", hora_inicio: "18:20", hora_fin: "18:57" },
];

/** Los 14 pedidos en el orden en que aparecen en la app. */
const PEDIDOS = [
  { codigo: "v12238726wofp-01", ruta: 1 },
  { codigo: "v12238812wofp-01", ruta: 1 },
  { codigo: "v12239232wofp-01", ruta: 2 },
  { codigo: "v12239089wofp-01", ruta: 2 },
  { codigo: "v12239528wofp-01", ruta: 3 },
  { codigo: "v12239312wofp-01", ruta: 3 },
  { codigo: "v12239582wofp-01", ruta: 4 },
  { codigo: "v12239681wofp-01", ruta: 4 },
  { codigo: "v12240224wofp-01", ruta: 5 },
  { codigo: "v12237397wofp-01", ruta: 5 },
  { codigo: "v12240699wofp-01", ruta: 6 },
  { codigo: "v12240588wofp-01", ruta: 6 },
  { codigo: "v12240721wofp-01", ruta: 7 },
  { codigo: "v12240765wofp-01", ruta: 7 },
];

const encabezado = {
  fecha: FECHA,
  contador_rutas: 7,
  contador_ordenes: 14,
};

function capturaRutas(desde: number, hasta: number) {
  return {
    ...encabezado,
    tipo_pantalla: "rutas",
    resumen_ordenes: null,
    rutas: RUTAS.slice(desde - 1, hasta).map((r) => ({ ...r, legible_completo: true })),
    ordenes: [],
  };
}

function capturaOrdenes(desde: number, hasta: number, cortados: string[] = []) {
  return {
    ...encabezado,
    tipo_pantalla: "ordenes",
    resumen_ordenes: { entregado: 14, parcial: 0, no_entregado: 0 },
    rutas: [],
    ordenes: PEDIDOS.slice(desde - 1, hasta).map((p) =>
      cortados.includes(p.codigo)
        ? // Tarjeta cortada por el borde: se ve el código pero no la ruta.
          { codigo: p.codigo, ruta: null, estado: "Entregado", legible_completo: false }
        : { codigo: p.codigo, ruta: p.ruta, estado: "Entregado", legible_completo: true },
    ),
  };
}

/** Las 5 capturas tal como salen de la galería, con solapamiento al hacer scroll. */
function capturas() {
  return [
    capturaRutas(1, 6),                                     // rutas 1–6
    capturaRutas(2, 7),                                     // rutas 2–7 (2–6 repetidas)
    capturaOrdenes(1, 6),                                   // pedidos 1–6
    capturaOrdenes(7, 12),                                  // pedidos 7–12
    capturaOrdenes(10, 14, ["v12240588wofp-01"]),           // 10–12 repetidos, 12 cortado
  ];
}

function fusionarCrudas(crudas: unknown[]) {
  const { validas, descartadas } = parsearRespuestas(crudas);
  expect(descartadas).toEqual([]);
  return fusionarCapturas(validas);
}

describe("fusionarCapturas — caso de ejemplo §16", () => {
  const j = fusionarCrudas(capturas());

  it("colapsa las 5 capturas en 7 rutas y 14 pedidos", () => {
    expect(j.rutas).toHaveLength(7);
    expect(j.ordenes).toHaveLength(14);
  });

  it("lee la fecha del encabezado y no reporta conflicto", () => {
    expect(j.fecha).toBe(FECHA);
    expect(j.fechasEnConflicto).toEqual([]);
  });

  it("colapsa exactamente las rutas 2 a 6, que venían repetidas", () => {
    const repetidas = j.rutas.filter((r) => r.apariciones > 1).map((r) => r.numero);
    expect(repetidas).toEqual([2, 3, 4, 5, 6]);
  });

  it("colapsa exactamente los tres pedidos repetidos", () => {
    const repetidos = j.ordenes.filter((o) => o.apariciones > 1).map((o) => o.codigo);
    expect(repetidos).toEqual(["v12237397wofp-01", "v12240699wofp-01", "v12240588wofp-01"]);
  });

  it("conserva el orden de aparición de los pedidos", () => {
    expect(j.ordenes.map((o) => o.codigo)).toEqual(PEDIDOS.map((p) => p.codigo));
    expect(j.ordenes.map((o) => o.posicion)).toEqual(PEDIDOS.map((_, i) => i + 1));
  });

  it("recupera de la otra captura lo que faltaba en la tarjeta cortada", () => {
    const cortado = j.ordenes.find((o) => o.codigo === "v12240588wofp-01");
    // Llegó sin ruta y marcado como incompleto en una captura, completo en otra.
    expect(cortado?.ruta).toBe(6);
    expect(cortado?.legible_completo).toBe(true);
  });

  it("conserva los contadores y el resumen del encabezado", () => {
    expect(j.contadorRutas).toBe(7);
    expect(j.contadorOrdenes).toBe(14);
    expect(j.resumenOrdenes).toEqual({ entregado: 14, parcial: 0, no_entregado: 0 });
    expect(j.conteoImagenes).toEqual({ rutas: 2, ordenes: 3, desconocido: 0 });
  });
});

describe("fusionarCapturas — capturas en desorden", () => {
  it("llega al mismo resultado aunque las imágenes vengan mezcladas", () => {
    const mezcladas = [4, 0, 3, 1, 2].map((i) => capturas()[i]);
    const j = fusionarCrudas(mezcladas);

    expect(j.rutas).toHaveLength(7);
    expect(j.ordenes).toHaveLength(14);
    expect(new Set(j.ordenes.map((o) => o.codigo))).toEqual(new Set(PEDIDOS.map((p) => p.codigo)));
    // La tarjeta cortada llegó primero esta vez: igual se completa con la otra.
    expect(j.ordenes.find((o) => o.codigo === "v12240588wofp-01")?.ruta).toBe(6);
  });
});

describe("fusionarCapturas — entradas problemáticas", () => {
  it("descarta la imagen cuyo JSON no cumple el esquema, sin tumbar la carga", () => {
    const { validas, descartadas } = parsearRespuestas([
      capturas()[0],
      { tipo_pantalla: "rutas", rutas: [{ numero: "uno", estado: "Finalizado" }] },
      capturas()[2],
    ]);
    expect(validas).toHaveLength(2);
    expect(descartadas).toHaveLength(1);
    expect(descartadas[0].indice).toBe(1);
  });

  it("señala la carga mixta cuando las capturas son de días distintos", () => {
    const otroDia = { ...capturaOrdenes(1, 6), fecha: "2026-09-15" };
    const j = fusionarCrudas([capturas()[0], otroDia]);
    expect(j.fecha).toBeNull();
    expect(j.fechasEnConflicto).toEqual(["2026-09-15", "2026-09-16"]);
  });

  it("deja la fecha en null cuando ninguna captura la traía", () => {
    const sinFecha = capturas().map((c) => ({ ...c, fecha: null }));
    const j = fusionarCrudas(sinFecha);
    expect(j.fecha).toBeNull();
    expect(j.fechasEnConflicto).toEqual([]);
  });
});

/* ---------------------------------------------------------------------------
 * Validaciones (§6)
 * ------------------------------------------------------------------------- */

describe("validarJornada", () => {
  const HOY = "2026-09-17";

  it("no pone ningún reparo al caso de ejemplo", () => {
    const alertas = validarJornada(fusionarCrudas(capturas()), { hoy: HOY });
    expect(alertas).toEqual([]);
    expect(hayBloqueos(alertas)).toBe(false);
  });

  it("avisa de la captura que falta, pero deja guardar lo que hay", () => {
    const j = fusionarCrudas([capturas()[0], capturas()[1], capturaOrdenes(1, 6)]);
    const alertas = validarJornada(j, { hoy: HOY });
    const falta = alertas.find((a) => a.codigo === "faltan-capturas-ordenes");
    expect(falta?.nivel).toBe("aviso");
    expect(falta?.mensaje).toMatch(/Faltan? \d+ pedidos?/);
    expect(falta?.mensaje).toContain("cortada entre dos capturas");
    /* Lo importante del cambio: se avisa pero **se puede guardar**. Guardar
       catorce pedidos de quince es mucho mejor que no guardar ninguno, y el
       que falta se añade a mano. */
    expect(hayBloqueos(alertas)).toBe(false);
  });

  it("bloquea cuando la fecha no se leyó y el usuario no eligió ninguna", () => {
    const j = fusionarCrudas(capturas().map((c) => ({ ...c, fecha: null })));
    expect(validarJornada(j, { hoy: HOY }).some((a) => a.codigo === "sin-fecha")).toBe(true);
    // Con la fecha elegida a mano, deja de bloquear.
    const conFecha = validarJornada(j, { hoy: HOY, fechaElegida: FECHA });
    expect(conFecha.some((a) => a.codigo === "sin-fecha")).toBe(false);
  });

  it("rechaza una fecha futura y pide confirmar una muy vieja", () => {
    const futura = fusionarCrudas(capturas().map((c) => ({ ...c, fecha: "2026-09-25" })));
    expect(validarJornada(futura, { hoy: HOY }).some((a) => a.codigo === "fecha-futura")).toBe(true);

    const vieja = fusionarCrudas(capturas().map((c) => ({ ...c, fecha: "2026-09-01" })));
    const aviso = validarJornada(vieja, { hoy: HOY }).find((a) => a.codigo === "fecha-antigua");
    expect(aviso?.nivel).toBe("aviso");
  });

  it("detecta horarios imposibles y rutas que se pisan", () => {
    const rutasMalas = [
      // Fin antes del inicio: intervalo roto, queda fuera del chequeo de solapes.
      { ...RUTAS[0], hora_fin: "09:00", legible_completo: true },
      { ...RUTAS[1], legible_completo: true }, // 11:04 → 11:22
      { ...RUTAS[2], hora_inicio: "11:15", legible_completo: true }, // arranca antes de que acabe la 2
    ];
    const j = fusionarCapturas(
      parsearRespuestas([
        {
          fecha: FECHA,
          contador_rutas: 3,
          contador_ordenes: 0,
          resumen_ordenes: null,
          tipo_pantalla: "rutas",
          rutas: rutasMalas,
          ordenes: [],
        },
      ]).validas,
    );
    const codigos = validarJornada(j, { hoy: HOY }).map((a) => a.codigo);
    expect(codigos).toContain("horario-invalido");
    expect(codigos).toContain("rutas-solapadas");
  });

  it("avisa de un código con formato raro sin bloquear el guardado", () => {
    // Error de lectura típico: una letra O donde va un cero.
    const conErrata = capturas().map((c) =>
      c.tipo_pantalla === "ordenes"
        ? {
            ...c,
            ordenes: c.ordenes.map((o) =>
              o.codigo === "v12240224wofp-01" ? { ...o, codigo: "v1224O224wofp-01" } : o,
            ),
          }
        : c,
    );
    const alertas = validarJornada(fusionarCrudas(conErrata), { hoy: HOY });
    const aviso = alertas.find((a) => a.codigo === "codigo-formato");
    expect(aviso?.nivel).toBe("aviso");
    expect(aviso?.referencias).toEqual(["v1224O224wofp-01"]);
    expect(hayBloqueos(alertas)).toBe(false);
  });

  it("dice que traerá a este día un pedido guardado en uno posterior", () => {
    /* Un pedido vive en el día más antiguo en que aparece. Si está guardado en
       un día posterior es porque aquel lo traía como arrastre de la noche: al
       guardar este, se le quita a aquel. No es un error, es ordenar. */
    const alertas = validarJornada(fusionarCrudas(capturas()), {
      hoy: HOY,
      codigosEnOtrasFechas: { "v12238726wofp-01": "2026-09-20" },
    });
    const aviso = alertas.find((a) => a.codigo === "codigo-en-otra-fecha");
    expect(aviso?.nivel).toBe("info");
    expect(aviso?.referencias).toEqual(["v12238726wofp-01"]);
  });

  it("uno guardado en un día ANTERIOR no genera ese aviso: se descarta antes", () => {
    const alertas = validarJornada(fusionarCrudas(capturas()), {
      hoy: HOY,
      codigosEnOtrasFechas: { "v12238726wofp-01": "2026-09-10" },
    });
    expect(alertas.find((a) => a.codigo === "codigo-en-otra-fecha")).toBeUndefined();
  });

  it("avisa si un pedido apunta a una ruta que no está en las capturas", () => {
    const j = fusionarCrudas([capturas()[0], capturas()[1], capturaOrdenes(1, 6), capturaOrdenes(7, 12), {
      ...capturaOrdenes(10, 14),
      ordenes: capturaOrdenes(10, 14).ordenes.map((o) =>
        o.codigo === "v12240765wofp-01" ? { ...o, ruta: 9 } : o,
      ),
    }]);
    const alerta = validarJornada(j, { hoy: HOY }).find((a) => a.codigo === "ruta-inexistente");
    expect(alerta?.nivel).toBe("aviso");
    expect(alerta?.referencias).toEqual(["v12240765wofp-01"]);
  });

  it("avisa si a un pedido no se le vio la ruta, sin impedir guardar", () => {
    const j = fusionarCrudas([
      capturas()[0],
      capturas()[1],
      capturaOrdenes(1, 6),
      capturaOrdenes(7, 12, ["v12240588wofp-01"]),
      capturaOrdenes(10, 14, ["v12240588wofp-01"]),
    ]);
    const alerta = validarJornada(j, { hoy: HOY }).find((a) => a.codigo === "tarjeta-incompleta");
    expect(alerta?.nivel).toBe("aviso");
    expect(alerta?.referencias).toEqual(["v12240588wofp-01"]);
  });
});

describe("capturas de varios días", () => {
  const conFecha = (fecha: string | null, codigos: string[]): ImagenExtraida => ({
    tipo_pantalla: "ordenes",
    fecha,
    contador_rutas: null,
    contador_ordenes: null,
    resumen_ordenes: null,
    rutas: [],
    ordenes: codigos.map((codigo) => ({
      codigo,
      ruta: 1,
      estado: "Entregado",
      legible_completo: true,
    })),
  });

  it("separa dos días en dos jornadas", () => {
    const dias = fusionarPorFecha([
      conFecha("2026-09-17", ["v11111111wofp-01"]),
      conFecha("2026-09-18", ["v22222222wofp-01"]),
    ]);
    expect(dias).toHaveLength(2);
    expect(dias[0].fecha).toBe("2026-09-17");
    expect(dias[1].fecha).toBe("2026-09-18");
  });

  it("las devuelve de más antigua a más reciente aunque se suban al revés", () => {
    const dias = fusionarPorFecha([
      conFecha("2026-09-18", ["v22222222wofp-01"]),
      conFecha("2026-09-17", ["v11111111wofp-01"]),
    ]);
    expect(dias.map((d) => d.fecha)).toEqual(["2026-09-17", "2026-09-18"]);
  });

  it("una captura sin fecha va al último día visto antes de ella", () => {
    // Es el caso real: solo la primera captura de cada día trae la cabecera,
    // porque al hacer scroll para fotografiar el resto la fecha desaparece.
    const dias = fusionarPorFecha([
      conFecha("2026-09-17", ["v11111111wofp-01"]),
      conFecha(null, ["v11111112wofp-01"]),
      conFecha("2026-09-18", ["v22222222wofp-01"]),
      conFecha(null, ["v22222223wofp-01"]),
    ]);
    expect(dias).toHaveLength(2);
    expect(dias[0].ordenes.map((o) => o.codigo)).toEqual([
      "v11111111wofp-01",
      "v11111112wofp-01",
    ]);
    expect(dias[1].ordenes.map((o) => o.codigo)).toEqual([
      "v22222222wofp-01",
      "v22222223wofp-01",
    ]);
  });

  it("si solo hay un día, las capturas sin fecha caen ahí sin dudar", () => {
    const dias = fusionarPorFecha([
      conFecha(null, ["v11111112wofp-01"]),
      conFecha("2026-09-17", ["v11111111wofp-01"]),
    ]);
    expect(dias).toHaveLength(1);
    expect(dias[0].fecha).toBe("2026-09-17");
    expect(dias[0].ordenes).toHaveLength(2);
  });

  it("sigue deduplicando dentro de cada día", () => {
    const dias = fusionarPorFecha([
      conFecha("2026-09-17", ["v11111111wofp-01", "v11111112wofp-01"]),
      conFecha("2026-09-17", ["v11111112wofp-01", "v11111113wofp-01"]),
    ]);
    expect(dias).toHaveLength(1);
    expect(dias[0].ordenes).toHaveLength(3);
  });

  it("ninguna captura no produce ningún día", () => {
    expect(fusionarPorFecha([])).toEqual([]);
  });

  it("un día ya no se marca como conflicto de fechas", () => {
    // Era el error que impedía subir la semana entera de una vez.
    const dias = fusionarPorFecha([
      conFecha("2026-09-17", ["v11111111wofp-01"]),
      conFecha("2026-09-18", ["v22222222wofp-01"]),
    ]);
    expect(dias.every((d) => d.fechasEnConflicto.length === 0)).toBe(true);
  });
});
