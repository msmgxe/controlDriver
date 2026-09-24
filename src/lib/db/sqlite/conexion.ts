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
import { ESQUEMA, NOMBRE_BASE, VERSION_ESQUEMA, migrar } from "./esquema";

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
  /* Si la apertura falla, se olvida el intento: el siguiente vuelve a probar.
     Antes el fallo quedaba guardado y cualquier reintento devolvía el mismo
     error hasta cerrar la aplicación del todo. */
  arranque ??= motorDeCapacitor().then(
    (m) => (motor = m),
    (fallo) => {
      arranque = null;
      throw fallo;
    },
  );
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

  /* La base se abre en la parte nativa de Android, y esa parte **sobrevive a
     que la página se recargue**. Tras un recargado —que la app hace al pasar
     de un día al siguiente en una carga de varios, o al activar la licencia—,
     la página empieza de cero sin saber que Android ya la tiene abierta, pide
     abrirla otra vez, y el plugin se niega: "Connection rutas-a already
     exists". Eso dejaba la app en la pantalla de "no se pudo abrir la base",
     justo al terminar de cargar un día.

     La receta del propio plugin: poner de acuerdo las dos partes primero
     (`checkConnectionsConsistency`) y, si la conexión existe, recuperarla en
     vez de crearla. Y por si aun así se cuela, un "ya existe" al crear se
     trata como lo que es —una conexión que se puede reutilizar—, no como un
     error. */
  const consistentes = await sqlite
    .checkConnectionsConsistency()
    .then((r) => r.result ?? false)
    .catch(() => false);
  const yaExiste = await sqlite
    .isConnection(NOMBRE_BASE, false)
    .then((r) => r.result ?? false)
    .catch(() => false);

  let db;
  if (consistentes && yaExiste) {
    db = await sqlite.retrieveConnection(NOMBRE_BASE, false);
  } else {
    try {
      db = await sqlite.createConnection(NOMBRE_BASE, false, "no-encryption", VERSION_ESQUEMA, false);
    } catch (fallo) {
      if (!String(fallo).includes("already exists")) throw fallo;
      db = await sqlite.retrieveConnection(NOMBRE_BASE, false);
    }
  }

  if (!(await db.isDBOpen()).result) await db.open();
  /* Sentencia a sentencia, y cada una con su red. Antes iban todas juntas: si
     una sola fallaba —un índice que no se podía crear sobre datos viejos, por
     ejemplo—, la base entera no abría y el repartidor se quedaba fuera de sus
     datos. Una sentencia que falla es, como mucho, una función que no anda. */
  for (const sentencia of ESQUEMA) {
    try {
      await db.execute(sentencia);
    } catch {
      /* Se sigue con la siguiente. */
    }
  }
  /* La migración no puede impedir abrir la base: si falla, se sigue. */
  await migrar({
    consultar: async <T,>(sql: string) => ((await db.query(sql)).values ?? []) as T[],
    ejecutar: (sql: string) => db.execute(sql),
  }).catch(() => []);

  /* En el navegador no hay disco: lo escrito vive en memoria hasta que se
     vuelca a IndexedDB a mano. En el celular esto no hace nada. */
  const persistir = async () => {
    if (enNavegador) await sqlite.saveToStore(NOMBRE_BASE);
  };
  await persistir();

  /* Mientras haya una transacción abierta, ninguna escritura suelta se
     vuelca todavía: eso lo hace `enTransaccion`, una sola vez, al terminar.
     Antes cada `ejecutar` volcaba la base entera aunque estuviera a mitad de
     una transacción —volcarla es exportar el SQLite entero de nuevo—, y ese
     vuelco a mitad de camino le rompía el estado de la transacción al motor
     del navegador: la siguiente escritura fallaba con una violación de clave
     foránea que no existía, y el `rollback` de después fallaba a su vez
     porque ya no había ninguna transacción activa que deshacer. Agregar
     varios pedidos de una vez —"cuántos pedidos hiciste", o los que llegan de
     una foto— es exactamente el caso que lo disparaba. En el celular esto no
     cambia nada: allí `persistir` ya no hacía nada. */
  let dentroDeTransaccion = false;

  return {
    async consultar<T>(sql: string, valores: unknown[]) {
      const { values } = await db.query(sql, valores as never[]);
      return (values ?? []) as T[];
    },
    async ejecutar(sql, valores) {
      const { changes } = await db.run(sql, valores as never[], false);
      if (!dentroDeTransaccion) await persistir();
      return changes?.changes ?? 0;
    },
    async enTransaccion(trabajo) {
      await db.beginTransaction();
      dentroDeTransaccion = true;
      try {
        const resultado = await trabajo();
        dentroDeTransaccion = false;
        await db.commitTransaction();
        await persistir();
        return resultado;
      } catch (fallo) {
        dentroDeTransaccion = false;
        try {
          await db.rollbackTransaction();
        } catch {
          /* Lo que importa mostrar es el error original —el de `trabajo()`—,
             no que además no se pudo deshacer. Antes este segundo error
             reemplazaba al primero y lo dejaba irreconocible. */
        }
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
