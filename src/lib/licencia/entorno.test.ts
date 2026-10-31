import { afterEach, describe, expect, it } from "vitest";

import { entorno } from "./entorno";

afterEach(() => {
  delete process.env.PRUEBA_ENTORNO;
});

describe("entorno", () => {
  it("quita comillas y espacios que se cuelan al copiar de .env.local a Vercel", () => {
    process.env.PRUEBA_ENTORNO = ' "libsql://base.turso.io" \n';
    expect(entorno("PRUEBA_ENTORNO")).toBe("libsql://base.turso.io");
    process.env.PRUEBA_ENTORNO = "'Clave123'";
    expect(entorno("PRUEBA_ENTORNO")).toBe("Clave123");
  });
  it("no toca un JSON ni comillas que no envuelven todo", () => {
    process.env.PRUEBA_ENTORNO = '{"kty":"EC","x":"a"}';
    expect(entorno("PRUEBA_ENTORNO")).toBe('{"kty":"EC","x":"a"}');
    process.env.PRUEBA_ENTORNO = 'a"b"';
    expect(entorno("PRUEBA_ENTORNO")).toBe('a"b"');
  });
  it("vacío o ausente es undefined", () => {
    expect(entorno("PRUEBA_ENTORNO")).toBeUndefined();
    process.env.PRUEBA_ENTORNO = '  ""  ';
    expect(entorno("PRUEBA_ENTORNO")).toBeUndefined();
  });
});
