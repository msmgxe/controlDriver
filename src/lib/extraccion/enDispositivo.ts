/**
 * Lectura de las capturas **dentro del teléfono**, sin servidor y sin modelo.
 *
 * Antes esto era una llamada a `/api/extraer`, que mandaba las imágenes a un
 * servidor y este se las pasaba a un modelo de visión. Funcionaba, pero traía
 * tres problemas que aquí desaparecen:
 *
 *   · **costaba dinero** en cada carga, todos los días, por cada repartidor;
 *   · **exigía señal**, justo al final de la jornada y a veces en un sótano;
 *   · **las fotos salían del teléfono**, aunque no se guardaran.
 *
 * El lector de texto del propio Android hace el trabajo gratis, sin conexión y
 * al instante. Y para este caso concreto acierta más que un modelo: lo que se
 * sube no son fotos sino pantallazos —texto digital, contraste perfecto,
 * formato fijo—, y un intérprete escrito a mano no improvisa ni se inventa un
 * código que no vio.
 */
import { Capacitor } from "@capacitor/core";

import { consultar, ejecutar } from "@/lib/db/sqlite/conexion";
import { codigosYaRegistrados, jornadaPorFecha, reglaVigente, type PedidoLeido } from "@/lib/db/sqlite/jornadas";
import { perfilActual } from "@/lib/db/sqlite/perfil";
import { esFechaISO, hoyEnLima, type FechaISO } from "@/lib/fechas";
import { pagoDelTramo } from "@/lib/pagos/reglas";

import { guardarPrueba } from "@/lib/db/sqlite/pruebas";

import { capturaDeLoGuardado, loCombinado, type LoCombinado } from "./combinar";
import { agruparPorFecha, fusionarCapturas } from "./fusionar";
import { leerImagen, type LecturaDeImagen } from "./lectorTexto";
import { interpretarCaptura, interpretarConContexto, type ContextoEntreCapturas } from "./ocr";
import { quitarArrastre } from "./arrastre";
import { validarJornada } from "./validar";
import type { ImagenExtraida } from "./esquema";

export interface DiaLeido {
  jornada: ReturnType<typeof fusionarCapturas> & {
    ordenes: Array<ReturnType<typeof fusionarCapturas>["ordenes"][number] & {
      tramo: number;
      montoCentimos: number;
      /** La distancia que el pedido ya tenía guardada, si ese día ya estaba cargado. */
      km?: number | null;
    }>;
  };
  /**
   * Si ese día **ya tenía datos guardados**: cuántos, y cuántos añade esta
   * carga. Lo leído se suma a lo guardado, no lo reemplaza.
   */
  combinado?: LoCombinado;
  alertas: ReturnType<typeof validarJornada>;
  regla: Awaited<ReturnType<typeof reglaVigente>>["regla"];
  permanencia: { tiendaId: string | null; horaEntrada: string | null; horaSalida: string | null };
  imagenesLeidas: number;
  imagenesDescartadas: number;
  /**
   * Con qué se leyeron las capturas.
   *
   * Los contadores van a cero porque no se gastó nada: ya no hay modelo. Se
   * conserva el campo, y la anotación de la carga, porque sigue siendo útil
   * para soporte —saber que ese día sí se cargó algo y cuándo— y porque el
   * día que convivan dos formas de leer habrá que distinguirlas.
   */
  uso: { modelo: string; tokensEntrada: number; tokensSalida: number };
}

/** ¿Puede este aparato leer texto de una imagen? */
export function lecturaDisponible(): boolean {
  return Capacitor.isNativePlatform();
}

/**
 * Cuántas capturas se leen a la vez.
 *
 * Con una sola en vuelo, el teléfono se pasaba la mitad del tiempo esperando:
 * convertir la imagen, cruzar hacia Android, decodificarla… y solo entonces
 * leer. Con dos, mientras una se lee la siguiente ya viene de camino. Más de
 * dos no ayuda —el lector nativo tiene dos— y sí gasta memoria: cada captura
 * decodificada ocupa unos 13 MB.
 */
const LECTURAS_A_LA_VEZ = 2;

type Lectura = { ok: true; lectura: LecturaDeImagen } | { ok: false; error: string };

/**
 * Lee todas las imágenes, de dos en dos, **conservando el orden**.
 *
 * El orden importa porque lo que se hace *después* con cada lectura sí depende
 * de él —una captura hereda la ruta de la anterior—, pero leerlas no: eso se
 * puede hacer en cualquier orden y a la vez. Por eso primero se lee todo, en
 * paralelo, y luego se interpreta en fila.
 *
 * Una imagen que no se pudo leer no tumba a las demás: queda como error en su
 * puesto y las otras siguen.
 */
async function leerEnParalelo(
  imagenes: readonly Blob[],
  alLeer?: (leidas: number) => void,
): Promise<Lectura[]> {
  const resultado: Lectura[] = new Array(imagenes.length);
  let siguiente = 0;
  let hechas = 0;

  const trabajador = async () => {
    for (;;) {
      const i = siguiente++;
      if (i >= imagenes.length) return;
      try {
        resultado[i] = { ok: true, lectura: await leerImagen(await aDataUrl(imagenes[i])) };
      } catch (e) {
        resultado[i] = { ok: false, error: e instanceof Error ? e.message : String(e) };
      }
      alLeer?.(++hechas);
    }
  };

  await Promise.all(
    Array.from({ length: Math.min(LECTURAS_A_LA_VEZ, imagenes.length) }, trabajador),
  );
  return resultado;
}

function aDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolver, rechazar) => {
    const lector = new FileReader();
    lector.onload = () => resolver(String(lector.result));
    lector.onerror = () => rechazar(new Error("No se pudo leer la imagen."));
    lector.readAsDataURL(blob);
  });
}

/** Lo que se guarda para Revisión: los días encontrados, en orden. */
export interface ResultadoLectura {
  dias: DiaLeido[];
  imagenesLeidas: number;
  imagenesDescartadas: number;
}

/**
 * De las capturas a los días listos para revisar.
 *
 * Cada imagen se lee por separado y luego se agrupan **por día**: las capturas
 * se solapan al hacer scroll, así que el mismo pedido aparece en varias y hay
 * que quedarse con uno solo (§4.4); y pueden ser de días distintos, que es lo
 * normal cuando uno sube el carrete del fin de semana entero.
 */
export async function leerCapturas(
  imagenes: ReadonlyArray<{ lectura: Blob; prueba: Blob | Promise<Blob> }>,
  alLeer?: (leidas: number) => void,
): Promise<ResultadoLectura> {
  /* Cada imagen viaja junto a lo que se leyó de ella. Hace falta para poder
     guardarla como prueba **del día correcto**: una captura sin cabecera no
     dice de qué día es, y solo se sabe tras agrupar. */
  const leidas: Array<{ prueba: Blob | Promise<Blob>; extraida: ImagenExtraida }> = [];
  const crudo: string[] = [];
  const detalle: string[] = [];
  let descartadas = 0;

  /* Lo que cada captura le deja a la siguiente: si la lista de pedidos
     seguía bajo una ruta al cortarse, la captura de después empieza en esa
     misma ruta aunque no la muestre. */
  let contexto: ContextoEntreCapturas | undefined;

  /* Primero se lee todo, de dos en dos; después se interpreta en el orden en
     que se tomaron. */
  const inicio = Date.now();
  const lecturas = await leerEnParalelo(
    imagenes.map((i) => i.lectura),
    alLeer,
  );
  const msLeer = Date.now() - inicio;

  for (let k = 0; k < imagenes.length; k++) {
    const numero = k + 1;
    const lec = lecturas[k];
    if (!lec.ok) {
      descartadas += 1;
      crudo.push(`── captura ${numero}: NO SE PUDO LEER · ${lec.error} ──`);
      continue;
    }

    const { lectura } = lec;
    crudo.push(
      `── captura ${numero} · ${lectura.lector}${lectura.tamano ? ` · ${lectura.tamano}` : ""}` +
        `${lectura.ms !== null ? ` · ${lectura.ms} ms` : ""} ──`,
      ...lectura.lineas,
    );
    detalle.push(`── captura ${numero}, tal como la devolvió el lector (x,y,ancho,alto|texto) ──`, ...lectura.crudo);

    try {
      const leida = interpretarConContexto(lectura.lineas, contexto);
      contexto = leida.contexto;
      const extraida = leida.imagen;

      // Una captura de la que no se sacó nada útil no aporta y sí puede
      // confundir: se cuenta como descartada y se dice cuántas fueron.
      if (extraida.tipo_pantalla === "desconocido") {
        descartadas += 1;
        continue;
      }
      leidas.push({ prueba: imagenes[k].prueba, extraida });
    } catch {
      descartadas += 1;
    }
  }

  const hoy = hoyEnLima();
  const perfil = await perfilActual();
  const permanencia = {
    tiendaId: perfil?.tiendaId ?? null,
    // Las horas de permanencia no salen de las capturas: se proponen desde el
    // horario del perfil y se corrigen si ese día fue distinto.
    horaEntrada: perfil?.horaEntrada ?? null,
    horaSalida: perfil?.horaSalida ?? null,
  };

  const dias: DiaLeido[] = [];
  for (const [fechaDelGrupo, delDia] of agruparPorFecha(leidas, (l) => l.extraida.fecha)) {
    /* Si ese día ya estaba guardado, lo guardado entra primero y las capturas
       nuevas se suman: subir una captura mejor de un pedido que no se leyó no
       puede borrar los demás. Sin fecha no hay día que consultar. Si la base
       falla, el día se lee tal como venía: perder la suma es molesto, perder la
       carga no es aceptable. */
    let guardada: Awaited<ReturnType<typeof jornadaPorFecha>> = null;
    if (esFechaISO(fechaDelGrupo)) {
      try {
        guardada = await jornadaPorFecha(fechaDelGrupo);
      } catch {
        guardada = null;
      }
    }
    const fusionada = fusionarCapturas([
      ...(guardada ? [capturaDeLoGuardado(guardada)] : []),
      ...delDia.map((l) => l.extraida),
    ]);

    /* Fuera lo que la app arrastra de la noche anterior: las primeras rutas si
       son de noche, y cualquier pedido que ya esté guardado en otro día —un
       pedido no se cobra dos veces—. Se consulta la base con **todos** los
       códigos, antes de quitar nada, precisamente para poder reconocerlos.

       Con red: si algo de esto falla, el día sigue adelante tal como se leyó,
       sin descartes, y Revisión lo dice. Perder el descarte automático es
       molesto; perder la carga entera, como pasaba, no es aceptable. */
    let enOtrosDias: Record<string, FechaISO> = {};
    let jornada: ReturnType<typeof quitarArrastre>;
    let fallo: string | null = null;
    try {
      enOtrosDias = await codigosYaRegistrados(fusionada.ordenes.map((o) => o.codigo));
      jornada = quitarArrastre(fusionada, enOtrosDias);
    } catch (e) {
      fallo = e instanceof Error ? e.message : String(e);
      jornada = { ...fusionada, descartes: { rutas: [], ordenes: [] } };
    }

    /* Las capturas se guardan como prueba del día. Si la tienda discute un
       pago, el pantallazo original es lo que lo zanja. Se guardan aquí y no al
       confirmar porque es aquí donde se sabe a qué día pertenece cada una, y
       en Revisión ya solo viajan los datos, no las imágenes. */
    for (const { prueba, extraida } of delDia) {
      /* Bajo la fecha que dice **la propia captura** —la cabecera va fija en
         todas—, y solo si no se sabe, la del grupo. Así una captura de otro
         día que se colara no queda archivada como prueba de este. */
      const suFecha = extraida.fecha ?? fechaDelGrupo;
      if (!suFecha) continue;

      // Lo que respalda: sus códigos y sus horarios. Si ya está todo en otra
      // captura del mismo día, esta no se guarda.
      const contenido = [
        ...extraida.ordenes.map((o) => `p:${o.codigo}`),
        ...extraida.rutas
          .filter((r) => r.hora_inicio && r.hora_fin)
          .map((r) => `r:${r.hora_inicio}-${r.hora_fin}`),
      ];
      try {
        await guardarPrueba(suFecha as never, await prueba, undefined, contenido);
      } catch {
        /* Guardar la prueba es un extra: que falle no puede tumbar la carga. */
      }
    }

    const { regla } = await reglaVigente(
      jornada.fecha ?? hoy,
      perfil?.tiendaId ?? null,
      perfil?.vehiculo,
    );
    let alertas: ReturnType<typeof validarJornada>;
    try {
      alertas = validarJornada(jornada, { hoy, codigosEnOtrasFechas: enOtrosDias });
    } catch (e) {
      alertas = [];
      fallo ??= e instanceof Error ? e.message : String(e);
    }
    if (fallo) {
      alertas.unshift({
        nivel: "aviso",
        codigo: "tarjeta-incompleta",
        mensaje: `Este día no se pudo revisar del todo; se muestra tal como se leyó. Detalle: ${fallo}`,
      });
    }
    const montoTramo1 = pagoDelTramo(regla, 1) ?? 1000;
    const guardadoPorCodigo = new Map((guardada?.ordenes ?? []).map((o) => [o.codigo, o]));

    dias.push({
      jornada: {
        ...jornada,
        /* Todos los pedidos nacen en tramo 1; el repartidor solo toca las
           excepciones, que son las que la captura no puede saber. Los que ya
           estaban guardados conservan su tramo, su distancia y su monto: es
           trabajo ya hecho, y la captura no lo sabe. */
        ordenes: jornada.ordenes.map((o) => {
          const g = guardadoPorCodigo.get(o.codigo);
          return g
            ? { ...o, tramo: g.tramo || 1, montoCentimos: g.montoCentimos ?? montoTramo1, km: g.km }
            : { ...o, tramo: 1, montoCentimos: montoTramo1 };
        }),
      },
      combinado: guardada ? loCombinado(guardada, jornada) : undefined,
      alertas,
      regla,
      permanencia: guardada
        ? // Las horas del día ya guardado, que la persona pudo corregir; no las del perfil.
          { tiendaId: guardada.tiendaId, horaEntrada: guardada.horaEntrada, horaSalida: guardada.horaSalida }
        : permanencia,
      imagenesLeidas: leidas.length,
      imagenesDescartadas: descartadas,
      uso: { modelo: "lector-del-dispositivo", tokensEntrada: 0, tokensSalida: 0 },
    });
  }

  await guardarDiagnostico([
    `── ${imagenes.length} captura${imagenes.length === 1 ? "" : "s"} leída${imagenes.length === 1 ? "" : "s"} en ${(msLeer / 1000).toFixed(1)} s ──`,
    ...crudo,
    "",
    ...detalle,
  ]);
  return { dias, imagenesLeidas: leidas.length, imagenesDescartadas: descartadas };
}

const CLAVE_DIAGNOSTICO = "extraccion.ultima-lectura";

/**
 * Guarda el texto que sacó el lector de la última carga.
 *
 * Cuando una captura no se interpreta bien, lo único que permite arreglarlo es
 * ver **qué leyó exactamente** el lector: el intérprete depende del orden en
 * que devuelve las regiones, y eso cambia según el aparato y la versión de
 * Android. Sin esto, diagnosticar a distancia es adivinar.
 *
 * No lleva nada que no estuviera ya en la pantalla del usuario.
 */
async function guardarDiagnostico(lineas: readonly string[]): Promise<void> {
  try {
    await ejecutar(
      `insert into ajustes (clave, valor) values (?, ?)
       on conflict (clave) do update set valor = excluded.valor`,
      [CLAVE_DIAGNOSTICO, lineas.join("\n")],
    );
  } catch {
    /* Es una ayuda de diagnóstico: si falla, no puede tumbar la carga. */
  }
}

/** El texto crudo de la última lectura, para enseñarlo en Ajustes. */
export async function ultimaLectura(): Promise<string | null> {
  try {
    const filas = await consultar<{ valor: string }>(
      `select valor from ajustes where clave = ?`,
      [CLAVE_DIAGNOSTICO],
    );
    return filas[0]?.valor ?? null;
  } catch {
    return null;
  }
}

/**
 * Lee solo las rutas de una o más capturas, sin pasar por el resto del
 * flujo —ni pedidos, ni arrastre de la noche anterior, ni alertas—.
 *
 * Sirve para añadir rutas sueltas a un día, con foto, sin tener que rehacer
 * la revisión completa de un día entero: se lee cada imagen, se fusionan las
 * que se repiten por el scroll —igual que en la carga normal, por horario y
 * no por número— y se devuelve la lista ya sin duplicados.
 *
 * Una imagen que no se pudo leer no tumba a las demás: se salta y se sigue,
 * porque perder una no tiene por qué perder las otras.
 */
export async function leerRutasDeCapturas(
  imagenes: readonly Blob[],
): Promise<Array<{ numero: number; horaInicio: string | null; horaFin: string | null }>> {
  const leidas: ImagenExtraida[] = [];

  for (const lec of await leerEnParalelo(imagenes)) {
    /* Se salta la imagen que no se pudo leer; las demás siguen su curso. */
    if (lec.ok) leidas.push(interpretarCaptura(lec.lectura.lineas));
  }

  const fusion = fusionarCapturas(leidas);
  return fusion.rutas
    .map((r) => ({ numero: r.numero, horaInicio: r.hora_inicio, horaFin: r.hora_fin }))
    .sort((a, b) => a.numero - b.numero);
}

/**
 * Lee solo los pedidos de una o más capturas, sin el resto del flujo —ni
 * rutas, ni arrastre de la noche anterior, ni alertas—.
 *
 * Es la pareja de `leerRutasDeCapturas`: sirve para añadir a un día los
 * pedidos de una foto suelta sin rehacer la revisión completa. A diferencia de
 * las rutas, aquí el orden de las capturas **sí importa**: la lista de pedidos
 * se fotografía haciendo scroll y una captura puede empezar a mitad de una
 * ruta, así que cada una hereda de la anterior la ruta bajo la que seguía.
 * Después se fusionan las que se solapan, por código.
 *
 * Devuelve también las fechas que traían las capturas —solo la primera de cada
 * pantalla lleva la cabecera—. No se usan para decidir el día, que lo elige la
 * persona, sino para avisarle si la foto dice otro.
 *
 * Una imagen que no se pudo leer no tumba a las demás.
 */
export async function leerPedidosDeCapturas(imagenes: readonly Blob[]): Promise<{
  pedidos: PedidoLeido[];
  fechas: FechaISO[];
}> {
  const leidas: ImagenExtraida[] = [];
  let contexto: ContextoEntreCapturas | undefined;

  for (const lec of await leerEnParalelo(imagenes)) {
    /* Se salta la imagen que no se pudo leer; las demás siguen su curso. */
    if (!lec.ok) continue;
    const leida = interpretarConContexto(lec.lectura.lineas, contexto);
    contexto = leida.contexto;
    leidas.push(leida.imagen);
  }

  const fusion = fusionarCapturas(leidas);
  return {
    pedidos: fusion.ordenes.map((o) => ({ codigo: o.codigo, ruta: o.ruta, estado: o.estado })),
    fechas: [...new Set(leidas.map((i) => i.fecha).filter((f): f is FechaISO => f !== null))].sort(),
  };
}
