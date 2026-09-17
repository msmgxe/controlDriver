import { describe, expect, it } from "vitest";
import {
  caeEnSemana,
  diasEntre,
  fechaDePago,
  formatearDuracion,
  formatearFecha,
  hoyEnLima,
  lunesDeLaSemana,
  rangoDeFechas,
  semanaDe,
  sumarDias,
} from "./fechas";

/* §15 pide pruebas de los límites de semana: domingo 23:59 frente a lunes
   00:00, carga tardía del domingo hecha el lunes, y semanas que cruzan de mes
   o de año. */

describe("semanaDe — la semana va de lunes a domingo (§13)", () => {
  it("mete el domingo en la semana que cierra, no en la que abre", () => {
    // Domingo 20/09/2026 es el último día de la semana del lunes 14.
    expect(semanaDe("2026-09-20")).toEqual({
      inicio: "2026-09-14",
      fin: "2026-09-20",
      pago: "2026-09-25",
    });
  });

  it("el lunes siguiente ya abre otra semana", () => {
    expect(semanaDe("2026-09-21").inicio).toBe("2026-09-21");
    expect(semanaDe("2026-09-20").inicio).toBe("2026-09-14");
  });

  it("paga el viernes siguiente al corte", () => {
    // El ejemplo literal de §13: semana del 14 al 20 → pago el viernes 25.
    expect(fechaDePago("2026-09-20")).toBe("2026-09-25");
    expect(new Date("2026-09-25T00:00:00Z").getUTCDay()).toBe(5); // viernes
  });

  it("da el mismo lunes para cualquier día de la semana", () => {
    const lunes = "2026-09-14";
    for (let i = 0; i < 7; i++) {
      expect(lunesDeLaSemana(sumarDias(lunes, i))).toBe(lunes);
    }
  });
});

describe("semanaDe — la carga tardía no cambia de semana", () => {
  it("un domingo subido el lunes sigue liquidando en la semana del domingo", () => {
    const fechaDeLaJornada = "2026-09-20"; // domingo
    const fechaDeCarga = "2026-09-21"; // lunes, cuando el driver sube las fotos

    // Lo que manda es la fecha de la jornada.
    expect(semanaDe(fechaDeLaJornada).inicio).toBe("2026-09-14");
    // Si se usara la fecha de carga caería en la semana siguiente: ese es el bug.
    expect(semanaDe(fechaDeCarga).inicio).toBe("2026-09-21");
    expect(caeEnSemana(fechaDeLaJornada, semanaDe(fechaDeLaJornada))).toBe(true);
    expect(caeEnSemana(fechaDeLaJornada, semanaDe(fechaDeCarga))).toBe(false);
  });
});

describe("semanaDe — cruces de mes y de año", () => {
  it("cruza de mes sin perder días", () => {
    // Lunes 28/09/2026 a domingo 04/10/2026.
    const s = semanaDe("2026-09-30");
    expect(s).toEqual({ inicio: "2026-09-28", fin: "2026-10-04", pago: "2026-10-09" });
    expect(rangoDeFechas(s.inicio, s.fin)).toHaveLength(7);
  });

  it("cruza de año sin perder días", () => {
    // Lunes 28/12/2026 a domingo 03/01/2027.
    const s = semanaDe("2026-12-31");
    expect(s).toEqual({ inicio: "2026-12-28", fin: "2027-01-03", pago: "2027-01-08" });
    expect(rangoDeFechas(s.inicio, s.fin)).toHaveLength(7);
  });

  it("cuenta bien los días de un año bisiesto", () => {
    expect(diasEntre("2028-02-28", "2028-03-01")).toBe(2); // 2028 es bisiesto
    expect(sumarDias("2028-02-28", 1)).toBe("2028-02-29");
  });
});

describe("hoyEnLima", () => {
  it("usa el día del driver, no el del servidor", () => {
    // 2026-09-18 01:30 UTC es todavía el 17 en Lima (UTC−5).
    expect(hoyEnLima(new Date("2026-09-18T01:30:00Z"))).toBe("2026-09-17");
    // A las 06:00 UTC ya es 18 en Lima.
    expect(hoyEnLima(new Date("2026-09-18T06:00:00Z"))).toBe("2026-09-18");
  });
});

describe("formato (§9)", () => {
  it("escribe las fechas como DD/MM/YYYY", () => {
    expect(formatearFecha("2026-09-16")).toBe("16/09/2026");
  });

  it("escribe las duraciones en horas y minutos", () => {
    expect(formatearDuracion(182)).toBe("3 h 02 min");
    expect(formatearDuracion(45)).toBe("45 min");
  });
});
