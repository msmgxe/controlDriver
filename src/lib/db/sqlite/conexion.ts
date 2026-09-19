/**
 * Conexión a la base local.
 *
 * El resto de la capa de datos habla con `consultar`, `ejecutar` y
 * `enTransaccion`, y nunca con SQLite directamente. Detrás hay un **motor**
 * intercambiable, y eso es lo que permite tres cosas:
 *
 *   · **En el celular** el motor es el plugin de Capacitor sobre el SQLite
 *     nativo de Android. La base vive en el almacenamiento privado de la
 *     aplicación: ninguna otra app la ve, y desinstalar Rutas-A la borra.
 *
 *   · **En el navegador** es SQLite compilado a WebAssembly guardando en
 *     IndexedDB. Existe para poder desarrollar con `npm run dev` sin
 *     recompilar el APK en cada cambio.
 *
 *   · **En las pruebas** es el SQLite que Node trae de serie, en memoria. Esto
 *     importa más de lo que parece: significa que los tests ejecutan el SQL de
 *     verdad —el mismo esquema, las mismas consultas— en vez de un simulacro
 *     que siempre dice que sí.
 */
import { ESQUEMA, NOMBRE_BASE, VERSION_ESQUEMA } from "./esquema";

/** Lo mínimo que tiene que saber hacer una base para esta aplicación. */
export interface Motor {
  consultar<T>(sql: string, valores: unknown[]): Promise<T[]>;
  ejecutar(sql: string, valores: unknown[]): Promise<number>;
  enTransaccion<T>(trabajo: () => Promise<T>): Promise<T>;
}

let motor: Motor | null = null;
let arranque: Promise<Motor> | null = null;

/** Sustituye el motor. Solo lo usan las pruebas. */
export function usarMotor(nuevo: Motor | null): void {
  motor = nuevo;
  arranque = null;
}

function obtenerMotor(): Promise<Motor> {
  if (motor) return Promise.resolve(motor);
  /* Se guarda la promesa, no el motor: si dos pantallas piden la base a la vez
     mientras aún se está abriendo, ambas esperan la misma apertura. */
  arranque ??= motorDeCapacitor().then((m) => (motor = m));
  return arranque;
}

/* ---------------------------------------------------------------------------
 * Las tres funciones que usa el resto de la aplicación
 * ------------------------------------------------------------------------- */

/** Lee filas. El tipo se declara en la llamada; SQLite no lo comprueba. */
export async function consultar<T>(sql: string, valores: unknown[] = []): Promise<T[]> {
  return (await obtenerMotor()).consultar<T>(sql, valores);
}

/** Escribe una sentencia. Devuelve cuántas filas cambiaron. */
export async function ejecutar(sql: string, valores: unknown[] = []): Promise<number> {
  return (await obtenerMotor()).ejecutar(sql, valores);
}

/**
 * Varias escrituras como una sola: o entran todas o no entra ninguna.
 *
 * Importa más de lo que parece. Guardar una jornada son tres escrituras
 * —jornada, rutas, pedidos— y el celular puede quedarse sin batería entre la
 * segunda y la tercera. Sin transacción quedaría una jornada con rutas y sin
 * pedidos, que los totales darían por buena.
 */
export async function enTransaccion<T>(trabajo: () => Promise<T>): Promise<T> {
  return (await obtenerMotor()).enTransaccion(trabajo);
}

/* ---------------------------------------------------------------------------
 * Motor real: Capacitor
 * ------------------------------------------------------------------------- */

/**
 * Las importaciones son dinámicas a propósito: así un test que instala su
 * propio motor nunca llega a cargar Capacitor, que fuera de un navegador o un
 * celular no tiene nada que hacer.
 */
async function motorDeCapacitor(): Promise<Motor> {
  const { Capacitor } = await import("@capacitor/core");
  const { CapacitorSQLite, SQLiteConnection } = await import("@capacitor-community/sqlite");

  const enNavegador = Capacitor.getPlatform() === "web";
  const sqlite = new SQLiteConnection(CapacitorSQLite);

  if (enNavegador) {
    // En el navegador SQLite es un componente web que hay que plantar en el
    // DOM antes de poder usarlo. No hay forma más elegante: así está diseñado.
    const { defineCustomElements } = await import("jeep-sqlite/loader");
    defineCustomElements(window);
    await customElements.whenDefined("jeep-sqlite");
    if (!document.querySelector("jeep-sqlite")) {
      const elemento = document.createElement("jeep-sqlite");
      elemento.setAttribute("wasmPath", "/assets");
      document.body.appendChild(elemento);
      await elemento.componentOnReady();
    }
    await sqlite.initWebStore();
  }

  /* Tras un recargado en caliente la conexión anterior puede seguir viva, y el
     plugin rechaza abrir dos veces la misma base. */
  const yaExiste = (await sqlite.isConnection(NOMBRE_BASE, false)).result;
  const db = yaExiste
    ? await sqlite.retrieveConnection(NOMBRE_BASE, false)
    : await sqlite.createConnection(NOMBRE_BASE, false, "no-encryption", VERSION_ESQUEMA, false);

  if (!(await db.isDBOpen()).result) await db.open();
  await db.execute(ESQUEMA.join("\n"));

  /* En el navegador no hay disco: lo escrito vive en memoria hasta que se
     vuelca a IndexedDB a mano. En el celular esto no hace nada. */
  const persistir = async () => {
    if (enNavegador) await sqlite.saveToStore(NOMBRE_BASE);
  };
  await persistir();

  return {
    async consultar<T>(sql: string, valores: unknown[]) {
      const { values } = await db.query(sql, valores as never[]);
      return (values ?? []) as T[];
    },
    async ejecutar(sql, valores) {
      const { changes } = await db.run(sql, valores as never[], false);
      await persistir();
      return changes?.changes ?? 0;
    },
    async enTransaccion(trabajo) {
      await db.beginTransaction();
      try {
        const resultado = await trabajo();
        await db.commitTransaction();
        await persistir();
        return resultado;
      } catch (fallo) {
        await db.rollbackTransaction();
        throw fallo;
      }
    },
  };
}

/* ---------------------------------------------------------------------------
 * Ayudas
 * ------------------------------------------------------------------------- */

/** Identificadores. Los mismos que usa Postgres, para que sincronizar sea copiar. */
export const nuevoId = (): string => crypto.randomUUID();

/** SQLite no tiene booleano: 0 y 1. */
export const aBool = (v: unknown): boolean => v === 1 || v === true;
export const deBool = (v: boolean): number => (v ? 1 : 0);
