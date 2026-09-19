/**
 * Pruebas de la licencia.
 *
 * De esto depende el cobro, así que se prueba lo que un atacante intentaría,
 * no solo lo que un usuario honesto hace: cambiar la fecha del certificado,
 * firmarlo con otra clave, atrasar el reloj del celular.
 */
import { beforeAll, describe, expect, it } from "vitest";

import {
  crearParDeClaves,
  emitirCertificado,
  importarClavePrivada,
  sumarMeses,
} from "./emitir";
import {
  aBase64Url,
  importarClavePublica,
  verificarCertificado,
  type Certificado,
} from "./token";
import {
  diasEntre,
  evaluarLicencia,
  fechaDeConfianza,
  mensajeDeLicencia,
} from "./estado";

let privada: CryptoKey;
let publica: CryptoKey;
let otraPublica: CryptoKey;

const BASE: Certificado = {
  usuario: "u-123",
  nombre: "Juan Pérez",
  vigenteHasta: "2026-10-31",
  emitidoEn: "2026-10-01T12:00:00.000Z",
  diasDeGracia: 7,
};

beforeAll(async () => {
  const par = await crearParDeClaves();
  privada = await importarClavePrivada(par.privada);
  publica = await importarClavePublica(par.publica);
  otraPublica = await importarClavePublica((await crearParDeClaves()).publica);
});

describe("certificados firmados", () => {
  it("uno legítimo se verifica y devuelve lo que dice", async () => {
    const texto = await emitirCertificado(BASE, privada);
    const leido = await verificarCertificado(texto, publica);

    expect(leido).not.toBeNull();
    expect(leido!.usuario).toBe("u-123");
    expect(leido!.vigenteHasta).toBe("2026-10-31");
    expect(leido!.nombre).toBe("Juan Pérez");
  });

  it("cambiar la fecha de vencimiento lo invalida", async () => {
    // El ataque evidente: alargarse el mes a mano.
    const texto = await emitirCertificado(BASE, privada);
    const [datos, firma] = texto.split(".");

    const manipulado = JSON.parse(
      new TextDecoder().decode(
        Uint8Array.from(atob(datos.replace(/-/g, "+").replace(/_/g, "/")), (c) => c.charCodeAt(0)),
      ),
    );
    manipulado.vigenteHasta = "2099-12-31";
    const datosFalsos = aBase64Url(new TextEncoder().encode(JSON.stringify(manipulado)));

    expect(await verificarCertificado(`${datosFalsos}.${firma}`, publica)).toBeNull();
  });

  it("uno firmado con otra clave se rechaza", async () => {
    // Fabricarse un par de claves propio no sirve: la app solo confía en una.
    const texto = await emitirCertificado(BASE, privada);
    expect(await verificarCertificado(texto, otraPublica)).toBeNull();
  });

  it("basura, texto vacío o formato roto devuelven null sin reventar", async () => {
    for (const malo of ["", ".", "abc", "abc.def", "no-tiene-punto"]) {
      expect(await verificarCertificado(malo, publica)).toBeNull();
    }
  });

  it("uno sin fecha válida se rechaza aunque la firma cuadre", async () => {
    const texto = await emitirCertificado(
      { ...BASE, vigenteHasta: "31 de octubre" },
      privada,
    );
    expect(await verificarCertificado(texto, publica)).toBeNull();
  });
});

describe("estados de la licencia", () => {
  const cert = (vigenteHasta: string, gracia = 7): Certificado => ({
    ...BASE,
    vigenteHasta,
    diasDeGracia: gracia,
  });

  it("dentro del mes: activa y puede trabajar", () => {
    const s = evaluarLicencia(cert("2026-10-31"), "2026-10-15");
    expect(s.estado).toBe("activa");
    expect(s.puedeEscribir).toBe(true);
    expect(s.diasRestantes).toBe(16);
  });

  it("el último día todavía está activa", () => {
    const s = evaluarLicencia(cert("2026-10-31"), "2026-10-31");
    expect(s.estado).toBe("activa");
    expect(s.puedeEscribir).toBe(true);
  });

  it("recién vencida entra en gracia y sigue pudiendo trabajar", () => {
    const s = evaluarLicencia(cert("2026-10-31"), "2026-11-03");
    expect(s.estado).toBe("gracia");
    expect(s.puedeEscribir).toBe(true);
  });

  it("el último día de gracia aún trabaja", () => {
    const s = evaluarLicencia(cert("2026-10-31"), "2026-11-07");
    expect(s.estado).toBe("gracia");
    expect(s.puedeEscribir).toBe(true);
  });

  it("pasada la gracia queda en solo lectura, no bloqueada", () => {
    const s = evaluarLicencia(cert("2026-10-31"), "2026-11-08");
    expect(s.estado).toBe("vencida");
    expect(s.puedeEscribir).toBe(false);
  });

  it("sin certificado no se puede escribir", () => {
    const s = evaluarLicencia(null, "2026-10-15");
    expect(s.estado).toBe("sin_licencia");
    expect(s.puedeEscribir).toBe(false);
  });

  it("avisa con cinco días de antelación, no antes", () => {
    expect(evaluarLicencia(cert("2026-10-31"), "2026-10-25").debeAvisar).toBe(false);
    expect(evaluarLicencia(cert("2026-10-31"), "2026-10-26").debeAvisar).toBe(true);
  });

  it("respeta una gracia distinta de la de siempre", () => {
    const sinGracia = evaluarLicencia(cert("2026-10-31", 0), "2026-11-01");
    expect(sinGracia.estado).toBe("vencida");
  });
});

describe("el reloj del celular", () => {
  it("atrasarlo no revive una licencia vencida", () => {
    // El usuario pone el celular en septiembre para volver a estar dentro.
    // La app recuerda que ya vio noviembre y no se deja.
    expect(fechaDeConfianza("2026-09-01", "2026-11-10")).toBe("2026-11-10");
  });

  it("el reloj normal, que solo avanza, no se toca", () => {
    expect(fechaDeConfianza("2026-11-11", "2026-11-10")).toBe("2026-11-11");
  });

  it("la primera vez se confía en el sistema, no hay con qué comparar", () => {
    expect(fechaDeConfianza("2026-11-10", null)).toBe("2026-11-10");
  });

  it("atrasar el reloj deja la licencia donde estaba", () => {
    const cert: Certificado = { ...BASE, vigenteHasta: "2026-10-31" };
    const hoy = fechaDeConfianza("2026-09-01", "2026-11-20");
    expect(evaluarLicencia(cert, hoy).estado).toBe("vencida");
  });
});

describe("sumar meses al vencimiento", () => {
  it("renovar antes de vencer no pierde los días que quedaban", () => {
    // Le quedan 16 días y paga: el mes nuevo se suma a lo que tenía.
    expect(sumarMeses("2026-10-31", 1, "2026-10-15")).toBe("2026-11-30");
  });

  it("renovar después de vencer cuenta desde hoy, no regala lo no pagado", () => {
    expect(sumarMeses("2026-10-31", 1, "2026-12-10")).toBe("2027-01-10");
  });

  it("activar por primera vez cuenta desde hoy", () => {
    expect(sumarMeses(null, 1, "2026-09-19")).toBe("2026-10-19");
  });

  it("el 31 de enero más un mes es el 28 de febrero, no el 3 de marzo", () => {
    // Sumado a lo bruto, JavaScript daría el 3 de marzo y regalaría días.
    expect(sumarMeses("2026-01-31", 1, "2026-01-15")).toBe("2026-02-28");
  });

  it("cruza el año sin despeinarse", () => {
    expect(sumarMeses("2026-12-15", 1, "2026-12-01")).toBe("2027-01-15");
  });

  it("varios meses de golpe, para quien paga el año", () => {
    expect(sumarMeses(null, 12, "2026-09-19")).toBe("2027-09-19");
  });
});

describe("lo que lee la persona", () => {
  const cert = (v: string): Certificado => ({ ...BASE, vigenteHasta: v });

  it("habla de días, no de fechas ISO", () => {
    expect(mensajeDeLicencia(evaluarLicencia(cert("2026-10-31"), "2026-10-28")))
      .toBe("Tu mes vence en 3 días.");
  });

  it("dice 'hoy' y 'mañana' en vez de 0 y 1 días", () => {
    expect(mensajeDeLicencia(evaluarLicencia(cert("2026-10-31"), "2026-10-31")))
      .toBe("Tu mes vence hoy.");
    expect(mensajeDeLicencia(evaluarLicencia(cert("2026-10-31"), "2026-10-30")))
      .toBe("Tu mes vence mañana.");
  });

  it("al vencer explica qué se puede seguir haciendo, no solo que se acabó", () => {
    const texto = mensajeDeLicencia(evaluarLicencia(cert("2026-10-31"), "2026-11-20"));
    expect(texto).toContain("ver y exportar");
  });
});

describe("contar días", () => {
  it("cuenta bien a través de un cambio de mes", () => {
    expect(diasEntre("2026-10-28", "2026-11-03")).toBe(6);
  });

  it("no se descuadra con el cambio de hora", () => {
    // Si se contara en horas locales, un cambio de horario daría 0.96 días.
    expect(diasEntre("2026-04-01", "2026-04-08")).toBe(7);
  });
});
