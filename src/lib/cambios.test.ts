import { describe, expect, it, vi } from "vitest";

import { alHaberCambios, avisarDeCambios } from "./cambios";

describe("avisar de cambios", () => {
  it("llega a todas las pantallas que escuchan", () => {
    const a = vi.fn();
    const b = vi.fn();
    const quitarA = alHaberCambios(a);
    const quitarB = alHaberCambios(b);

    avisarDeCambios();

    expect(a).toHaveBeenCalledTimes(1);
    expect(b).toHaveBeenCalledTimes(1);
    quitarA();
    quitarB();
  });

  it("una pantalla que se cierra deja de recibirlos", () => {
    const oyente = vi.fn();
    const quitar = alHaberCambios(oyente);
    quitar();

    avisarDeCambios();

    expect(oyente).not.toHaveBeenCalled();
  });

  it("un oyente que se da de baja durante el aviso no rompe a los demás", () => {
    const b = vi.fn();
    let quitarA = () => {};
    quitarA = alHaberCambios(() => quitarA());
    const quitarB = alHaberCambios(b);

    expect(() => avisarDeCambios()).not.toThrow();
    expect(b).toHaveBeenCalledTimes(1);
    quitarB();
  });
});
