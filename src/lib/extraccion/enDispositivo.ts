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
import { codigosYaRegistrados, reglaVigente } from "@/lib/db/sqlite/jornadas";
import { perfilActual } from "@/lib/db/sqlite/perfil";
import { hoyEnLima, type FechaISO } from "@/lib/fechas";
import { pagoDelTramo } from "@/lib/pagos/reglas";

import { guardarPrueba } from "@/lib/db/sqlite/pruebas";

import { agruparPorFecha, fusionarCapturas } from "./fusionar";
import { interpretarConContexto, type ContextoEntreCapturas } from "./ocr";
import { quitarArrastre } from "./arrastre";
import { validarJornada } from "./validar";
import type { ImagenExtraida } from "./esquema";

export interface DiaLeido {
  jornada: ReturnType<typeof fusionarCapturas> & {
    ordenes: Array<ReturnType<typeof fusionarCapturas>["ordenes"][number] & {
      tramo: number;
      montoCentimos: number;
    }>;
  };
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
 * Lee una imagen y devuelve sus líneas de texto, en orden de lectura.
 *
 * El lector vive en Android, no en la página: la importación es dinámica para
 * que el navegador no intente cargar un plugin nativo que ahí no existe.
 */
async function leerTexto(imagen: Blob): Promise<string[]> {
  const { Ocr } = await import("@jcesarmobile/capacitor-ocr");
  const { results } = await Ocr.process({ image: await aDataUrl(imagen) });
  return results.map((r) => r.text);
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
export async function leerCapturas(imagenes: readonly Blob[]): Promise<ResultadoLectura> {
  /* Cada imagen viaja junto a lo que se leyó de ella. Hace falta para poder
     guardarla como prueba **del día correcto**: una captura sin cabecera no
     dice de qué día es, y solo se sabe tras agrupar. */
  const leidas: Array<{ imagen: Blob; extraida: ImagenExtraida }> = [];
  const crudo: string[] = [];
  let descartadas = 0;

  /* Lo que cada captura le deja a la siguiente: si la lista de pedidos
     seguía bajo una ruta al cortarse, la captura de después empieza en esa
     misma ruta aunque no la muestre. */
  let contexto: ContextoEntreCapturas | undefined;
  let numeroDeCaptura = 0;

  for (const imagen of imagenes) {
    try {
      const lineas = await leerTexto(imagen);
      numeroDeCaptura++;
      crudo.push(`── captura ${numeroDeCaptura} ──`, ...lineas);
      const leida = interpretarConContexto(lineas, contexto);
      contexto = leida.contexto;
      const extraida = leida.imagen;

      // Una captura de la que no se sacó nada útil no aporta y sí puede
      // confundir: se cuenta como descartada y se dice cuántas fueron.
      if (extraida.tipo_pantalla === "desconocido") {
        descartadas += 1;
        continue;
      }
      leidas.push({ imagen, extraida });
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
    const fusionada = fusionarCapturas(delDia.map((l) => l.extraida));

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
    for (const { imagen, extraida } of delDia) {
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
        await guardarPrueba(suFecha as never, imagen, undefined, contenido);
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

    dias.push({
      jornada: {
        ...jornada,
        // Todos los pedidos nacen en tramo 1; el repartidor solo toca las
        // excepciones, que son las que la captura no puede saber.
        ordenes: jornada.ordenes.map((o) => ({ ...o, tramo: 1, montoCentimos: montoTramo1 })),
      },
      alertas,
      regla,
      permanencia,
      imagenesLeidas: leidas.length,
      imagenesDescartadas: descartadas,
      uso: { modelo: "lector-del-dispositivo", tokensEntrada: 0, tokensSalida: 0 },
    });
  }

  await guardarDiagnostico(crudo);
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
