/**
 * Un teléfono con una base de una versión anterior tiene que seguir andando.
 *
 * Es el fallo que no se ve al probar: en un teléfono recién instalado todas
 * las columnas están. Aquí se simula el de quien ya usaba la app: una tabla
 * vieja, sin las columnas que se añadieron después.
 */
import { DatabaseSync } from "node:sqlite";
import { describe, expect, it } from "vitest";

import { ESQUEMA, VISTAS_A_REFRESCAR, migrar } from "./esquema";

function baseDe(db: DatabaseSync) {
  return {
    consultar: async <T,>(sql: string) => db.prepare(sql).all() as T[],
    ejecutar: async (sql: string) => db.exec(sql),
  };
}

describe("migrar una base de una versión anterior", () => {
  it("añade las columnas que le faltan a una tabla vieja", async () => {
    const db = new DatabaseSync(":memory:");
    // La tabla de pedidos tal como la creó la v5, sin la columna «manual».
    db.exec(`create table ordenes (id text primary key, jornada_id text, codigo text)`);

    const anadidas = await migrar(baseDe(db));
    expect(anadidas).toContain("ordenes.manual");

    const columnas = db.prepare(`pragma table_info(ordenes)`).all() as Array<{ name: string }>;
    expect(columnas.map((c) => c.name)).toContain("manual");
  });

  it("no toca nada en una base que ya está al día", async () => {
    const db = new DatabaseSync(":memory:");
    for (const s of ESQUEMA) db.exec(s);
    expect(await migrar(baseDe(db))).toEqual([]);
  });

  it("se puede ejecutar dos veces sin romper", async () => {
    const db = new DatabaseSync(":memory:");
    db.exec(`create table ordenes (id text primary key)`);
    await migrar(baseDe(db));
    await expect(migrar(baseDe(db))).resolves.toEqual([]);
  });

  it("los datos que había se conservan", async () => {
    const db = new DatabaseSync(":memory:");
    db.exec(`create table ordenes (id text primary key, codigo text)`);
    db.exec(`insert into ordenes values ('a', 'v11111111wofp-01')`);
    await migrar(baseDe(db));
    const fila = db.prepare(`select codigo, manual from ordenes`).get() as { codigo: string; manual: number };
    expect(fila).toEqual({ codigo: "v11111111wofp-01", manual: 0 });
  });
});

describe("la migración nunca deja fuera", () => {
  it("si leer las columnas falla, intenta añadirlas igual", async () => {
    const db = new DatabaseSync(":memory:");
    db.exec(`create table ordenes (id text primary key)`);
    const base = {
      consultar: async () => {
        throw new Error("este motor no deja pasar pragma");
      },
      ejecutar: async (sql: string) => db.exec(sql),
    };
    await migrar(base);
    const columnas = db.prepare(`pragma table_info(ordenes)`).all() as Array<{ name: string }>;
    expect(columnas.map((c) => c.name)).toContain("manual");
  });

  it("si todo falla, no lanza: la aplicación abre igual", async () => {
    const base = {
      consultar: async () => {
        throw new Error("roto");
      },
      ejecutar: async () => {
        throw new Error("roto");
      },
    };
    await expect(migrar(base)).resolves.toEqual([]);
  });
});

describe("la vista del resumen por día", () => {
  it("una vista vieja, sin apoyo ni taxi, se rehace al abrir la base", async () => {
    const db = new DatabaseSync(":memory:");
    for (const s of ESQUEMA) db.exec(s);
    // La vista tal como estaba antes de apoyo y taxi.
    db.exec(`drop view v_resumen_diario; create view v_resumen_diario as select j.fecha as fecha from jornadas j;`);
    expect(() => db.prepare(`select monto_apoyo_centimos from v_resumen_diario`).all()).toThrow();

    for (const s of VISTAS_A_REFRESCAR) db.exec(s);
    expect(() => db.prepare(`select monto_apoyo_centimos, monto_taxi_centimos from v_resumen_diario`).all()).not.toThrow();
  });
});
