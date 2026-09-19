/**
 * Motor de SQLite en memoria, para las pruebas.
 *
 * Usa el SQLite que Node trae de serie desde la versión 22, así que no añade
 * ninguna dependencia. Lo importante es que ejecuta **el SQL de verdad**: el
 * mismo esquema y las mismas consultas que correrán en el celular. Un simulacro
 * de la base habría dado por buenas las consultas mal escritas, que es justo lo
 * que hay que cazar aquí.
 */
import { DatabaseSync } from "node:sqlite";

import type { Motor } from "./conexion";
import { ESQUEMA } from "./esquema";

/** SQLite solo acepta estos tipos; `undefined` y `boolean` hay que traducirlos. */
function aValorSQLite(v: unknown): null | number | string | bigint | Uint8Array {
  if (v === undefined || v === null) return null;
  if (typeof v === "boolean") return v ? 1 : 0;
  if (typeof v === "number" || typeof v === "string" || typeof v === "bigint") return v;
  if (v instanceof Uint8Array) return v;
  return String(v);
}

export function motorEnMemoria(): Motor {
  const db = new DatabaseSync(":memory:");
  for (const sentencia of ESQUEMA) db.exec(sentencia);

  return {
    async consultar<T>(sql: string, valores: unknown[]): Promise<T[]> {
      return db.prepare(sql).all(...valores.map(aValorSQLite)) as T[];
    },
    async ejecutar(sql: string, valores: unknown[]): Promise<number> {
      return db.prepare(sql).run(...valores.map(aValorSQLite)).changes as number;
    },
    async enTransaccion<T>(trabajo: () => Promise<T>): Promise<T> {
      db.exec("begin");
      try {
        const resultado = await trabajo();
        db.exec("commit");
        return resultado;
      } catch (fallo) {
        db.exec("rollback");
        throw fallo;
      }
    },
  };
}
