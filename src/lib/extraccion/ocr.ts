/**
 * Interpretación de las capturas **sin modelo de lenguaje**.
 *
 * Las capturas de la app de reparto no son fotos: son pantallazos. Texto
 * digital, contraste perfecto, la misma tipografía y la misma disposición
 * siempre. Es el caso más fácil que existe para un lector de texto, y encima
 * el formato es fijo, así que un intérprete escrito a mano acierta más que un
 * modelo —no improvisa, no alucina un código que no vio, y cuesta cero.
 *
 * Lo que llega aquí es la lista de líneas que el lector del teléfono sacó de
 * la imagen, en orden de lectura. Lo que sale es exactamente la misma
 * estructura que producía el modelo, así que el resto del sistema —fusión,
 * validación, revisión— no se entera del cambio.
 *
 * Los cuatro patrones que lo hacen posible, y que no se parecen a nada más:
 *
 *   · `Resumen del 16/09/2026`
 *   · `Rutas 7` · `Órdenes 14`
 *   · `De: 10:03 a 10:27 horas`
 *   · `v12238726wofp-01`
 */
import {
  esquemaImagenExtraida,
  type ImagenExtraida,
  type OrdenExtraida,
  type RutaExtraida,
} from "./esquema";

/* ---------------------------------------------------------------------------
 * Limpieza
 * ------------------------------------------------------------------------- */

/** Sin acentos y en minúsculas, para comparar sin depender de la tilde. */
function normalizar(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();
}

/**
 * Arregla las confusiones clásicas de un lector de texto **solo donde toca**.
 *
 * En un código de pedido sabemos que esas posiciones son dígitos, así que una
 * `O` solo puede ser un cero y una `l` solo puede ser un uno. Aplicar esto al
 * texto entero sería destructivo —convertiría "Finalizado" en "F1na1izado"—,
 * de ahí que se use únicamente dentro del código, donde no hay ambigüedad.
 */
function soloDigitos(trozo: string): string {
  return trozo
    .replace(/[oO]/g, "0")
    .replace(/[lLiI|]/g, "1")
    .replace(/[sS]/g, "5")
    .replace(/[bB]/g, "6")
    .replace(/[gG]/g, "9")
    .replace(/[^\d]/g, "");
}

/* ---------------------------------------------------------------------------
 * Patrones
 * ------------------------------------------------------------------------- */

/** `Resumen del 16/09/2026`, con o sin "del", y admitiendo guiones. */
const RE_FECHA = /resumen\s+(?:del?\s+)?(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{4})/;

/** `Rutas 7` — el contador de la cabecera. En plural, a diferencia de `Ruta 4`. */
const RE_CONTADOR_RUTAS = /^rutas\s*:?\s*(\d{1,3})$/;

/** `Órdenes 14` — ya sin tilde por `normalizar`. */
const RE_CONTADOR_ORDENES = /^ordenes\s*:?\s*(\d{1,3})$/;

/** `De: 10:03 a 10:27 horas` */
const RE_HORARIO = /de:?\s*(\d{1,2}:\d{2})\s*(?:a|-|–)\s*(\d{1,2}:\d{2})/;

/**
 * `v12238726wofp-01`
 *
 * Se admiten espacios de más y se toleran letras donde deberían ir dígitos,
 * porque es justo donde el lector se equivoca. La reconstrucción posterior
 * devuelve siempre la forma canónica.
 */
const RE_CODIGO = /v\s*([0-9oOlLiI|sSbBgG]{8})\s*w\s*o\s*f\s*p\s*[-–—]?\s*([0-9oOlLiI|sSbBgG]{2})/i;

/**
 * `Ruta 4` — en singular: la ruta a la que pertenecen los pedidos.
 *
 * Admite cosas detrás —una flecha, el horario, el estado— porque en la lista
 * de pedidos agrupada por ruta es la cabecera de un bloque, y ahí suele ir
 * acompañada. No confunde el contador `Rutas 7`: tras "ruta" exige espacio o
 * dos puntos antes del número, y la "s" del plural no es ninguna de las dos.
 */
const RE_RUTA_DEL_PEDIDO = /^ruta\s*:?\s*(\d{1,3})\b/;

/** Estados propios de un pedido. "Finalizado" es de las rutas y no cuenta aquí. */
const ESTADOS_DE_PEDIDO = new Set(["Entregado", "Entrega parcial", "No entregado"]);

/** Un número suelto: en la pantalla de Rutas es el círculo azul. */
const RE_NUMERO_SUELTO = /^(\d{1,3})$/;

/**
 * Estados conocidos.
 *
 * La lista no es cerrada: §17.4 avisa de que pueden aparecer estados nuevos.
 * Por eso lo que no se reconoce **no se descarta** —se conserva tal cual y la
 * pantalla de Revisión lo enseña para que la persona decida.
 */
const ESTADOS: ReadonlyArray<{ patron: RegExp; canonico: string }> = [
  { patron: /^entrega\s+parcial$/, canonico: "Entrega parcial" },
  { patron: /^no\s+entregado$/, canonico: "No entregado" },
  { patron: /^entregado$/, canonico: "Entregado" },
  { patron: /^finalizado$/, canonico: "Finalizado" },
  { patron: /^en\s+curso$/, canonico: "En curso" },
  { patron: /^cancelado$/, canonico: "Cancelado" },
  { patron: /^pendiente$/, canonico: "Pendiente" },
];

function estadoDe(linea: string): string | null {
  for (const { patron, canonico } of ESTADOS) {
    if (patron.test(linea)) return canonico;
  }
  return null;
}

/** `Entregado 14` cuando etiqueta y número vienen en la misma línea. */
const RE_RESUMEN = /^(entregado|entrega\s+parcial|no\s+entregado)\s*:?\s*(\d{1,3})$/;

/**
 * Localiza la tarjeta de resumen y devuelve sus líneas, para apartarlas.
 *
 * Esta función nació de un error real y caro. La tarjeta de arriba de la
 * pantalla de Órdenes dice `Entregado 14 · Entrega parcial 0 · No entregado 0`,
 * pero el lector **no siempre devuelve la etiqueta y su número juntos**: al
 * estar en líneas visuales distintas, suelen salir separados.
 *
 * El resultado era que el intérprete veía un `No entregado` suelto, lo tomaba
 * por el estado de un pedido, y marcaba en rojo los dieciocho pedidos de un
 * día en que se entregó todo. Un dato inventado con toda la apariencia de ser
 * correcto, que es la peor clase de error.
 *
 * Se distingue por dos señales que la tarjeta de resumen siempre cumple y una
 * tarjeta de pedido nunca: aparece **antes del primer código de pedido**, y su
 * etiqueta va **pegada a un número suelto**.
 */
function lineasDelResumen(lineas: readonly string[]): {
  consumidas: Set<number>;
  resumen: { entregado: number; parcial: number; noEntregado: number } | null;
} {
  const consumidas = new Set<number>();
  const resumen = { entregado: 0, parcial: 0, noEntregado: 0 };
  let hay = false;

  // Hasta dónde puede estar el resumen: nunca después del primer pedido.
  let limite = lineas.length;
  for (let i = 0; i < lineas.length; i++) {
    if (RE_CODIGO.test(lineas[i])) {
      limite = i;
      break;
    }
  }

  /* Se reúnen primero los candidatos y **luego** se decide. Consumir sobre la
     marcha se comía también el estado de un pedido cuyo código viniera detrás,
     que es un orden que el lector sí produce. */
  const candidatos: Array<{ linea: number; numero: number | null; etiqueta: string; conNumero: number | null }> = [];

  for (let i = 0; i < limite; i++) {
    const linea = normalizar(lineas[i]);

    const juntos = linea.match(RE_RESUMEN);
    if (juntos) {
      candidatos.push({ linea: i, etiqueta: juntos[1], numero: Number(juntos[2]), conNumero: null });
      continue;
    }

    if (/^(entregado|entrega\s+parcial|no\s+entregado)$/.test(linea)) {
      candidatos.push({ linea: i, etiqueta: linea, numero: null, conNumero: null });
    }
  }

  /* De qué lado está el número de cada etiqueta.
     
     En la tarjeta, la cifra va grande arriba y el rótulo debajo, así que el
     lector suele devolver `14 · Entregado`. Pero no siempre: hay teléfonos que
     la dan al revés. Y decidirlo etiqueta por etiqueta no vale, porque en una
     lista `14 · Entregado · 0 · Entrega parcial` cada rótulo tiene un número a
     cada lado —mirar solo hacia abajo le asignaba a "Entregado" el cero del
     siguiente—. Se decide una vez, por dónde empieza la serie. */
  const primera = candidatos[0]?.linea ?? -1;
  const numeroAntes =
    primera > 0 && RE_NUMERO_SUELTO.test(normalizar(lineas[primera - 1]));

  for (const c of candidatos) {
    const vecino = numeroAntes ? c.linea - 1 : c.linea + 1;
    if (vecino < 0 || vecino >= limite) continue;
    const m = normalizar(lineas[vecino]).match(RE_NUMERO_SUELTO);
    if (m) {
      c.numero = Number(m[1]);
      c.conNumero = vecino;
    }
  }

  /* La tarjeta de resumen enseña siempre los tres estados, cada uno con su
     número. Una etiqueta suelta y sin número no es el resumen: es el estado de
     un pedido cuyo código el lector devolvió después. Exigir dos señales evita
     confundir los dos casos. */
  const conNumero = candidatos.filter((c) => c.numero !== null);
  const esResumen = conNumero.length >= 2 || (conNumero.length === 1 && candidatos.length >= 2);
  if (!esResumen) return { consumidas, resumen: null };

  for (const c of candidatos) {
    hay = true;
    consumidas.add(c.linea);
    if (c.conNumero !== null) consumidas.add(c.conNumero);
    if (c.numero === null) continue;
    if (c.etiqueta.startsWith("entrega ")) resumen.parcial = c.numero;
    else if (c.etiqueta.startsWith("no ")) resumen.noEntregado = c.numero;
    else resumen.entregado = c.numero;
  }

  return { consumidas, resumen: hay ? resumen : null };
}

/* ---------------------------------------------------------------------------
 * El intérprete
 * ------------------------------------------------------------------------- */

/**
 * Lo que una captura le deja a la siguiente.
 *
 * Hace falta porque la lista de pedidos se fotografía haciendo scroll, y una
 * captura puede empezar a mitad de una ruta: sus primeros pedidos pertenecen
 * a la `Ruta N` que se vio al final de la captura anterior, y en esta no
 * aparece. Sin arrastrar ese dato, esos pedidos quedarían sin ruta.
 */
export interface ContextoEntreCapturas {
  /** Ruta bajo la que seguían los pedidos al terminar la captura anterior. */
  rutaAbierta: number | null;
  /** La captura anterior era una lista de pedidos agrupada por ruta. */
  agrupada: boolean;
}

const SIN_CONTEXTO: ContextoEntreCapturas = { rutaAbierta: null, agrupada: false };

/** Una captura suelta. Ver `interpretarConContexto` para una serie. */
export function interpretarCaptura(lineasCrudas: readonly string[]): ImagenExtraida {
  return interpretarConContexto(lineasCrudas).imagen;
}

/**
 * Convierte las líneas leídas de una captura en datos estructurados.
 *
 * Hay dos formas de pantalla de pedidos, y leer bien depende de distinguirlas:
 *
 *     Una tarjeta por pedido          Pedidos agrupados por ruta
 *     ─────────────────────           ──────────────────────────
 *     v12239582wofp-01                Ruta 4          ← una vez
 *     Ruta 4                          v12239582wofp-01
 *     Entregado                       Entregado
 *     v12239681wofp-01                v12239681wofp-01
 *     Ruta 4                          Entregado
 *     Entregado                       Ruta 5          ← cambia
 *                                     v12240224wofp-01
 *
 * En la agrupada, `Ruta 4` sale **una sola vez** y vale para todos los pedidos
 * que vienen debajo hasta la siguiente. Buscarla junto a cada pedido —que es lo
 * que se hacía— solo se la daba al primero de cada ruta: cada ruta salía con
 * un pedido y el resto quedaba sin asignar.
 *
 * Se distinguen por lo que viene **justo después** de cada `Ruta N`. En la
 * agrupada es una cabecera, así que la sigue un código. En la de tarjetas la
 * sigue el estado del pedido. Contar líneas no bastaba: una pantalla de
 * tarjetas con la última cortada también tiene menos `Ruta N` que códigos, y
 * se tomaba por agrupada.
 */
export function interpretarConContexto(
  lineasCrudas: readonly string[],
  previo: ContextoEntreCapturas = SIN_CONTEXTO,
): { imagen: ImagenExtraida; contexto: ContextoEntreCapturas } {
  // Una línea del lector puede traer varias líneas visuales dentro.
  const lineas = lineasCrudas
    .flatMap((l) => l.split(/\r?\n/))
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  const { consumidas, resumen } = lineasDelResumen(lineas);

  /* --- qué forma tiene la pantalla --- */
  let codigos = 0;
  let cabeceras = 0;
  let rutasDeTarjeta = 0;
  for (let i = 0; i < lineas.length; i++) {
    if (consumidas.has(i)) continue;
    if (RE_CODIGO.test(lineas[i])) codigos++;
    else if (RE_RUTA_DEL_PEDIDO.test(normalizar(lineas[i]))) {
      if (esCabeceraDeRuta(lineas, i, consumidas)) cabeceras++;
      else rutasDeTarjeta++;
    }
  }

  const agrupada =
    cabeceras + rutasDeTarjeta > 0
      ? cabeceras > 0 && cabeceras >= rutasDeTarjeta
      : // Ninguna `Ruta N` a la vista, pero la anterior era agrupada: es la
        // continuación por scroll de la misma ruta.
        previo.agrupada && codigos > 0;

  const orientacionRuta = orientacionDeLasTarjetas(lineas, consumidas);
  const orientacionEstado = orientacionDeLosEstados(lineas, consumidas);

  /* ¿El número del círculo va antes o después del horario de su tarjeta?

     Se decide una vez por captura, por lo que pasa con la primera. Hacerlo
     tarjeta a tarjeta —usar el de antes y, si falta, buscar el de después— era
     un error: cuando a una tarjeta no se le leía el número, se quedaba con el
     de la tarjeta siguiente y salían dos rutas con el mismo. */
  let primerNumero = -1;
  let primerHorario = -1;
  for (let i = 0; i < lineas.length; i++) {
    if (consumidas.has(i)) continue;
    const l = normalizar(lineas[i]);
    if (primerNumero === -1 && RE_NUMERO_SUELTO.test(l)) primerNumero = i;
    if (primerHorario === -1 && RE_HORARIO.test(l)) primerHorario = i;
  }
  const numeroAntesDelHorario = primerNumero !== -1 && primerNumero < primerHorario;

  let fecha: string | null = null;
  let contadorRutas: number | null = null;
  let contadorOrdenes: number | null = null;

  const rutas: RutaExtraida[] = [];
  const ordenes: OrdenExtraida[] = [];

  /* Dos números pendientes distintos, porque vienen de sitios distintos y no
     pueden mezclarse: el de una cabecera `Ruta 4` es seguro; el de un círculo
     suelto depende de la orientación de la captura. */
  let numeroDeCabecera: number | null = null;
  let numeroSuelto: number | null = null;
  let estadoPendiente: string | null = null;
  let rutaVigente: number | null = agrupada ? previo.rutaAbierta : null;

  for (let i = 0; i < lineas.length; i++) {
    if (consumidas.has(i)) continue;

    const cruda = lineas[i];
    const linea = normalizar(cruda);

    /* --- cabecera --- */
    const mFecha = linea.match(RE_FECHA);
    if (mFecha) {
      const [, d, m, a] = mFecha;
      fecha = `${a}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
      continue;
    }

    const mRutas = linea.match(RE_CONTADOR_RUTAS);
    if (mRutas) {
      contadorRutas = Number(mRutas[1]);
      continue;
    }

    const mOrdenes = linea.match(RE_CONTADOR_ORDENES);
    if (mOrdenes) {
      contadorOrdenes = Number(mOrdenes[1]);
      continue;
    }

    /* --- pedidos --- */
    const mCodigo = cruda.match(RE_CODIGO);
    if (mCodigo) {
      const codigo = `v${soloDigitos(mCodigo[1])}wofp-${soloDigitos(mCodigo[2])}`;
      const estado = buscarEstado(lineas, i, orientacionEstado, consumidas);
      const ruta = agrupada ? rutaVigente : buscarRuta(lineas, i, orientacionRuta, consumidas);

      ordenes.push({
        codigo,
        ruta,
        estado: estado ?? "Entregado",
        legible_completo: ruta !== null && estado !== null,
      });
      numeroDeCabecera = null;
      numeroSuelto = null;
      estadoPendiente = null;
      continue;
    }

    /* --- cabecera de ruta --- */
    const mRuta = linea.match(RE_RUTA_DEL_PEDIDO);
    if (mRuta) {
      const n = Number(mRuta[1]);
      if (agrupada) rutaVigente = n;
      // Si la cabecera trae el horario detrás, esa ruta tiene número leído.
      numeroDeCabecera = n;
      const enLaMisma = linea.match(RE_HORARIO);
      if (!enLaMisma) continue;
    }

    /* --- rutas --- */
    const mHorario = linea.match(RE_HORARIO);
    if (mHorario) {
      /* El número se toma de donde dice la orientación de esta captura, y de
         ningún otro sitio. Si no está, se numera por orden y se marca como
         deducido: ese número solo vale dentro de esta captura, y la fusión lo
         reconstruye con los de las rutas vecinas. */
      const numero =
        numeroDeCabecera ??
        (numeroAntesDelHorario ? numeroSuelto : numeroSiguiente(lineas, i, consumidas));
      const estado = estadoPendiente ?? estadoSiguiente(lineas, i);

      rutas.push({
        numero: numero ?? rutas.length + 1,
        estado: estado ?? "Finalizado",
        hora_inicio: normalizarHora(mHorario[1]),
        hora_fin: normalizarHora(mHorario[2]),
        legible_completo: true,
        numero_deducido: numero === null,
      });
      numeroDeCabecera = null;
      numeroSuelto = null;
      estadoPendiente = null;
      continue;
    }

    const estado = estadoDe(linea);
    if (estado) {
      estadoPendiente = estado;
      continue;
    }

    const mNumero = linea.match(RE_NUMERO_SUELTO);
    if (mNumero) {
      numeroSuelto = Number(mNumero[1]);
      continue;
    }
  }

  const tipo: ImagenExtraida["tipo_pantalla"] =
    ordenes.length > 0 || resumen !== null ? "ordenes" : rutas.length > 0 ? "rutas" : "desconocido";

  /* Se valida contra el mismo esquema que usaba la salida del modelo: si algo
     no cuadra, falla aquí y no tres pantallas más adelante. */
  const imagen = esquemaImagenExtraida.parse({
    tipo_pantalla: tipo,
    fecha,
    contador_rutas: contadorRutas,
    contador_ordenes: contadorOrdenes,
    resumen_ordenes: resumen
      ? { entregado: resumen.entregado, parcial: resumen.parcial, no_entregado: resumen.noEntregado }
      : null,
    rutas,
    ordenes,
  });

  return {
    imagen,
    /* Una captura de rutas no pertenece a la lista de pedidos: la cadena pasa
       a través de ella intacta. Si se reiniciara, el pedido que abre la
       siguiente captura de pedidos perdería la ruta bajo la que venía. */
    contexto:
      tipo === "rutas"
        ? previo
        : { rutaAbierta: agrupada ? rutaVigente : null, agrupada },
  };
}

/**
 * ¿Esta línea `Ruta N` es la cabecera de un bloque de pedidos?
 *
 * Lo es si lo siguiente con sustancia es un código. Se saltan el horario y el
 * estado de la ruta ("Finalizado"), que pueden ir en la cabecera; cualquier
 * otra cosa —en particular el estado de un pedido— dice que no es cabecera
 * sino la ruta de una tarjeta.
 */
function esCabeceraDeRuta(
  lineas: readonly string[],
  desde: number,
  consumidas: ReadonlySet<number>,
): boolean {
  for (let i = desde + 1; i < Math.min(lineas.length, desde + 5); i++) {
    if (consumidas.has(i)) continue;
    if (RE_CODIGO.test(lineas[i])) return true;
    const linea = normalizar(lineas[i]);
    if (RE_HORARIO.test(linea)) continue;
    const estado = estadoDe(linea);
    if (estado && !ESTADOS_DE_PEDIDO.has(estado)) continue;
    return false;
  }
  return false;
}

/**
 * En una pantalla de una tarjeta por pedido, ¿la línea `Ruta N` va antes o
 * después del código?
 *
 *     código → Ruta N      (se busca hacia **adelante**)
 *     Ruta N → código      (se busca hacia **atrás**)
 *
 * Buscar en las dos direcciones a la vez parece más robusto y es justo lo
 * contrario: cada pedido acabaría robando la ruta de su vecino, y el error
 * sería invisible porque el resultado parece plausible. Se decide una vez por
 * captura, por lo que pasa con la primera tarjeta.
 */
function orientacionDeLasTarjetas(
  lineas: readonly string[],
  consumidas: ReadonlySet<number>,
): "adelante" | "atras" {
  let primerCodigo = -1;
  let primeraRuta = -1;

  for (let i = 0; i < lineas.length; i++) {
    if (consumidas.has(i)) continue;
    if (primerCodigo === -1 && RE_CODIGO.test(lineas[i])) primerCodigo = i;
    if (primeraRuta === -1 && RE_RUTA_DEL_PEDIDO.test(normalizar(lineas[i]))) primeraRuta = i;
    if (primerCodigo !== -1 && primeraRuta !== -1) break;
  }

  if (primerCodigo === -1 || primeraRuta === -1) return "adelante";
  return primeraRuta < primerCodigo ? "atras" : "adelante";
}

/**
 * ¿El estado de cada pedido va antes o después de su código?
 *
 * Se decide **aparte** de la ruta, y no es un detalle: en la lista agrupada la
 * cabecera `Ruta 4` va antes de los códigos pero los estados van después, así
 * que usar la misma orientación para las dos cosas desplazaba todos los
 * estados un puesto.
 *
 * Por el medio de la lista no se puede saber —«código, estado, código,
 * estado» se ve igual desde cualquier pedido del centro—, así que se mira en
 * los bordes: si sobran estados antes del primer código o después del último.
 * Ante la duda, hacia adelante, que es el orden de lectura.
 */
function orientacionDeLosEstados(
  lineas: readonly string[],
  consumidas: ReadonlySet<number>,
): "adelante" | "atras" {
  let primerCodigo = -1;
  let ultimoCodigo = -1;
  for (let i = 0; i < lineas.length; i++) {
    if (consumidas.has(i) || !RE_CODIGO.test(lineas[i])) continue;
    if (primerCodigo === -1) primerCodigo = i;
    ultimoCodigo = i;
  }
  if (primerCodigo === -1) return "adelante";

  const esEstadoDePedido = (i: number) =>
    !consumidas.has(i) && ESTADOS_DE_PEDIDO.has(estadoDe(normalizar(lineas[i])) ?? "");

  let antes = 0;
  for (let i = primerCodigo - 1; i >= Math.max(0, primerCodigo - 3); i--) {
    if (esEstadoDePedido(i)) antes++;
  }
  let despues = 0;
  for (let i = ultimoCodigo + 1; i <= Math.min(lineas.length - 1, ultimoCodigo + 3); i++) {
    if (esEstadoDePedido(i)) despues++;
  }

  return antes > despues ? "atras" : "adelante";
}

/**
 * Recorre desde un código en una dirección hasta el código vecino, que es
 * donde empieza la tarjeta de al lado. Ese tope es lo que impide que un pedido
 * con la tarjeta cortada se quede con los datos del de al lado.
 */
function recorrerTarjeta(
  lineas: readonly string[],
  desde: number,
  orientacion: "adelante" | "atras",
  consumidas: ReadonlySet<number>,
  buscar: (linea: string) => boolean,
): void {
  const paso = orientacion === "adelante" ? 1 : -1;
  for (let i = desde + paso; i >= 0 && i < lineas.length; i += paso) {
    if (consumidas.has(i)) continue;
    if (RE_CODIGO.test(lineas[i])) return;
    if (buscar(normalizar(lineas[i]))) return;
  }
}

function buscarEstado(
  lineas: readonly string[],
  desde: number,
  orientacion: "adelante" | "atras",
  consumidas: ReadonlySet<number>,
): string | null {
  let encontrado: string | null = null;
  recorrerTarjeta(lineas, desde, orientacion, consumidas, (linea) => {
    const estado = estadoDe(linea);
    if (estado && ESTADOS_DE_PEDIDO.has(estado)) encontrado = estado;
    return encontrado !== null;
  });
  return encontrado;
}

function buscarRuta(
  lineas: readonly string[],
  desde: number,
  orientacion: "adelante" | "atras",
  consumidas: ReadonlySet<number>,
): number | null {
  let encontrada: number | null = null;
  recorrerTarjeta(lineas, desde, orientacion, consumidas, (linea) => {
    const m = linea.match(RE_RUTA_DEL_PEDIDO);
    if (m) encontrada = Number(m[1]);
    return encontrada !== null;
  });
  return encontrada;
}

/** El número suelto que va justo detrás del horario, sin pasar al de otra tarjeta. */
function numeroSiguiente(
  lineas: readonly string[],
  desde: number,
  consumidas: ReadonlySet<number>,
): number | null {
  for (let i = desde + 1; i < Math.min(lineas.length, desde + 4); i++) {
    if (consumidas.has(i)) continue;
    const linea = normalizar(lineas[i]);
    if (RE_HORARIO.test(linea)) return null;
    const m = linea.match(RE_NUMERO_SUELTO);
    if (m) return Number(m[1]);
  }
  return null;
}

/** Lo mismo para el estado de la ruta. */
function estadoSiguiente(lineas: readonly string[], desde: number): string | null {
  for (let i = desde + 1; i < Math.min(lineas.length, desde + 4); i++) {
    const linea = normalizar(lineas[i]);
    if (RE_HORARIO.test(linea)) return null;
    const estado = estadoDe(linea);
    if (estado) return estado;
  }
  return null;
}

/** `9:03` → `09:03`. El esquema exige dos dígitos en la hora. */
function normalizarHora(hora: string): string {
  const [h, m] = hora.split(":");
  return `${h.padStart(2, "0")}:${m}`;
}
