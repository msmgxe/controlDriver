/**
 * Respaldo y restauración de los datos del teléfono.
 *
 * La base vive solo en el aparato: nada la copia a ningún otro sitio todavía
 * —eso es lo que hará la sincronización con Turso, y aún no existe—. Mientras
 * tanto, esto es la única red de seguridad real ante lo que sí puede borrar
 * los datos: desinstalar la aplicación, cambiar de teléfono, o que el
 * teléfono se pierda o se rompa.
 *
 * Una actualización normal —instalar una versión nueva encima de la
 * anterior, que es como se hace desde la v13— **no borra nada**: Android
 * conserva los datos de la app mientras no se desinstale. Esto es para los
 * casos en que sí se pierden.
 *
 * Qué entra en el respaldo y qué no:
 *
 *   · **Entra**: el perfil, las tiendas, las tarifas, las jornadas, las
 *     rutas, los pedidos y las liquidaciones. Es lo que cuesta caro perder:
 *     meses de trabajo y de cálculos de pago.
 *   · **No entra la licencia ni el identificador del teléfono.** Restaurar el
 *     identificador de un teléfono viejo en uno nuevo dejaría la licencia
 *     inválida —está atada al aparato— y confundiría el mecanismo que evita
 *     atrasar el reloj para estirar una prueba.
 *   · **No entran las capturas guardadas como prueba.** Son imágenes, pesan
 *     megas y un respaldo pensado para mandarse por WhatsApp tiene que ser
 *     liviano. Se pierden en una restauración; el resto de los datos, no.
 */
import { z } from "zod";

import { consultar, ejecutar, enTransaccion } from "./conexion";

export const VERSION_RESPALDO = 1;

/** En orden de padres a hijos: así se insertan sin violar una clave foránea. */
const TABLAS = [
  "perfil",
  "tiendas",
  "reglas_pago",
  "jornadas",
  "rutas",
  "ordenes",
  "liquidaciones",
] as const;

type NombreTabla = (typeof TABLAS)[number];

export interface Respaldo {
  version: number;
  generadoEn: string;
  tablas: Record<NombreTabla, Record<string, unknown>[]>;
}

/** Junta todas las filas de todas las tablas, tal como están en la base. */
export async function crearRespaldo(): Promise<Respaldo> {
  const tablas = {} as Respaldo["tablas"];
  for (const tabla of TABLAS) {
    tablas[tabla] = await consultar<Record<string, unknown>>(`select * from ${tabla}`);
  }
  return { version: VERSION_RESPALDO, generadoEn: new Date().toISOString(), tablas };
}

const esquemaRespaldo = z.object({
  version: z.number(),
  generadoEn: z.string(),
  tablas: z.object({
    perfil: z.array(z.record(z.string(), z.unknown())),
    tiendas: z.array(z.record(z.string(), z.unknown())),
    reglas_pago: z.array(z.record(z.string(), z.unknown())),
    jornadas: z.array(z.record(z.string(), z.unknown())),
    rutas: z.array(z.record(z.string(), z.unknown())),
    ordenes: z.array(z.record(z.string(), z.unknown())),
    liquidaciones: z.array(z.record(z.string(), z.unknown())),
  }),
});

export interface ResumenRespaldo {
  jornadas: number;
  desde: string | null;
  hasta: string | null;
  nombre: string | null;
  generadoEn: string;
}

/**
 * Lee un archivo de respaldo y dice qué trae, sin tocar la base todavía.
 *
 * Se separa de `restaurarRespaldo` a propósito: antes de reemplazar todo lo
 * que hay, la persona tiene que poder ver "45 jornadas, del 1 de agosto al
 * 19 de septiembre, de Marco" y decidir si es lo que esperaba.
 */
export function leerRespaldo(
  texto: string,
): { ok: true; respaldo: Respaldo; resumen: ResumenRespaldo } | { ok: false; error: string } {
  let crudo: unknown;
  try {
    crudo = JSON.parse(texto);
  } catch {
    return { ok: false, error: "Ese archivo no se pudo leer: no es un JSON válido." };
  }

  const parseado = esquemaRespaldo.safeParse(crudo);
  if (!parseado.success) {
    return { ok: false, error: "Ese archivo no tiene la forma de un respaldo de Rutas-A." };
  }

  const respaldo = parseado.data as Respaldo;
  const fechas = respaldo.tablas.jornadas
    .map((j) => j.fecha)
    .filter((f): f is string => typeof f === "string")
    .sort();

  return {
    ok: true,
    respaldo,
    resumen: {
      jornadas: respaldo.tablas.jornadas.length,
      desde: fechas[0] ?? null,
      hasta: fechas.at(-1) ?? null,
      nombre: typeof respaldo.tablas.perfil[0]?.nombre === "string"
        ? (respaldo.tablas.perfil[0].nombre as string)
        : null,
      generadoEn: respaldo.generadoEn,
    },
  };
}

/**
 * Reemplaza **todo** lo que hay ahora por lo que trae el respaldo.
 *
 * No es una mezcla: es un reemplazo completo. Mezclar exigiría decidir, pedido
 * por pedido, cuál de dos versiones es la buena, y esa decisión no se puede
 * tomar sola. Por eso la pantalla pide confirmar antes de llegar aquí, y por
 * eso conviene restaurar en un teléfono recién instalado, no en uno que ya
 * tiene días cargados desde el respaldo.
 *
 * Los ids se conservan tal cual venían: es lo que mantiene enlazados a un
 * pedido con su ruta después de restaurar.
 *
 * Cada tabla se filtra contra sus columnas reales antes de insertar, para que
 * un respaldo de una versión distinta de la app no reviente por una columna
 * que ya no existe, o que todavía no existía cuando se generó.
 */
export async function restaurarRespaldo(respaldo: Respaldo): Promise<void> {
  await enTransaccion(async () => {
    for (const tabla of [...TABLAS].reverse()) {
      await ejecutar(`delete from ${tabla}`);
    }

    for (const tabla of TABLAS) {
      const columnasReales = new Set(
        (await consultar<{ name: string }>(`pragma table_info(${tabla})`)).map((c) => c.name),
      );

      for (const fila of respaldo.tablas[tabla]) {
        const columnas = Object.keys(fila).filter((c) => columnasReales.has(c));
        if (columnas.length === 0) continue;

        const marcadores = columnas.map(() => "?").join(", ");
        await ejecutar(
          `insert into ${tabla} (${columnas.join(", ")}) values (${marcadores})`,
          columnas.map((c) => fila[c]),
        );
      }
    }
  });
}

const CLAVE_ULTIMO_RESPALDO = "respaldo.ultimo";

/** Se llama justo después de compartir un respaldo con éxito. */
export async function anotarRespaldoCreado(): Promise<void> {
  await ejecutar(
    `insert into ajustes (clave, valor) values (?, ?)
     on conflict (clave) do update set valor = excluded.valor`,
    [CLAVE_ULTIMO_RESPALDO, new Date().toISOString()],
  );
}

/** Cuándo se hizo el último respaldo, o null si nunca se hizo ninguno. */
export async function ultimoRespaldoCreado(): Promise<string | null> {
  const filas = await consultar<{ valor: string }>(
    `select valor from ajustes where clave = ?`,
    [CLAVE_ULTIMO_RESPALDO],
  );
  return filas[0]?.valor ?? null;
}
