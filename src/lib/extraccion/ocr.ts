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

/** `Ruta 4` — en singular: la ruta a la que pertenece un pedido. */
const RE_RUTA_DEL_PEDIDO = /^ruta\s*:?\s*(\d{1,3})$/;

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

/** `Entregado 14` en la tarjeta de resumen, frente a `Entregado` suelto. */
const RE_RESUMEN = /^(entregado|entrega\s+parcial|no\s+entregado)\s*:?\s*(\d{1,3})$/;

/* ---------------------------------------------------------------------------
 * El intérprete
 * ------------------------------------------------------------------------- */

/**
 * Convierte las líneas leídas de una captura en datos estructurados.
 *
 * Recorre en orden de lectura manteniendo contexto, que es como está montada
 * la pantalla: primero el número de la ruta, luego su estado, luego su
 * horario; primero el código del pedido, luego su ruta y su estado.
 */
export function interpretarCaptura(lineasCrudas: readonly string[]): ImagenExtraida {
  // Una línea del lector puede traer varias líneas visuales dentro.
  const lineas = lineasCrudas
    .flatMap((l) => l.split(/\r?\n/))
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  let fecha: string | null = null;
  let contadorRutas: number | null = null;
  let contadorOrdenes: number | null = null;
  const resumen = { entregado: 0, parcial: 0, noEntregado: 0 };
  let hayResumen = false;

  const rutas: RutaExtraida[] = [];
  const ordenes: OrdenExtraida[] = [];

  // Contexto de la tarjeta que se está leyendo.
  let numeroPendiente: number | null = null;
  let estadoPendiente: string | null = null;

  const orientacion = orientacionDeLasTarjetas(lineas);

  for (let i = 0; i < lineas.length; i++) {
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

    const mResumen = linea.match(RE_RESUMEN);
    if (mResumen) {
      hayResumen = true;
      const cuantos = Number(mResumen[2]);
      if (mResumen[1].startsWith("entrega ")) resumen.parcial = cuantos;
      else if (mResumen[1].startsWith("no ")) resumen.noEntregado = cuantos;
      else resumen.entregado = cuantos;
      continue;
    }

    /* --- pedidos --- */
    const mCodigo = cruda.match(RE_CODIGO);
    if (mCodigo) {
      const codigo = `v${soloDigitos(mCodigo[1])}wofp-${soloDigitos(mCodigo[2])}`;
      const { ruta, estado, completo } = contextoDelPedido(lineas, i, orientacion);
      ordenes.push({
        codigo,
        ruta,
        estado: estado ?? "Entregado",
        // Sin estado visible la tarjeta venía cortada: se marca para que
        // Revisión lo señale en vez de darlo por bueno.
        legible_completo: completo,
      });
      numeroPendiente = null;
      estadoPendiente = null;
      continue;
    }

    /* --- rutas --- */
    const mHorario = linea.match(RE_HORARIO);
    if (mHorario) {
      /* Si el número no vino antes del horario, se busca justo después: el
         lector agrupa las regiones a su manera y el círculo con el número
         puede caer detrás. Solo si tampoco está ahí se numera por orden. */
      const numero = numeroPendiente ?? numeroSiguiente(lineas, i);
      const estado = estadoPendiente ?? estadoSiguiente(lineas, i);

      rutas.push({
        numero: numero ?? rutas.length + 1,
        estado: estado ?? "Finalizado",
        hora_inicio: normalizarHora(mHorario[1]),
        hora_fin: normalizarHora(mHorario[2]),
        // El horario es lo que de verdad hace falta para calcular; sin número
        // visible se numera por orden y se sigue considerando utilizable.
        legible_completo: mHorario[1] !== undefined && mHorario[2] !== undefined,
      });
      numeroPendiente = null;
      estadoPendiente = null;
      continue;
    }

    const mRutaPedido = linea.match(RE_RUTA_DEL_PEDIDO);
    if (mRutaPedido) continue; // Ya lo recoge `contextoDelPedido`.

    const estado = estadoDe(linea);
    if (estado) {
      estadoPendiente = estado;
      continue;
    }

    const mNumero = linea.match(RE_NUMERO_SUELTO);
    if (mNumero) {
      numeroPendiente = Number(mNumero[1]);
      continue;
    }
  }

  const tipo: ImagenExtraida["tipo_pantalla"] =
    ordenes.length > 0 || hayResumen ? "ordenes" : rutas.length > 0 ? "rutas" : "desconocido";

  /* Se valida contra el mismo esquema que usaba la salida del modelo: si algo
     no cuadra, falla aquí y no tres pantallas más adelante. */
  return esquemaImagenExtraida.parse({
    tipo_pantalla: tipo,
    fecha,
    contador_rutas: contadorRutas,
    contador_ordenes: contadorOrdenes,
    resumen_ordenes: hayResumen
      ? { entregado: resumen.entregado, parcial: resumen.parcial, no_entregado: resumen.noEntregado }
      : null,
    rutas,
    ordenes,
  });
}

/**
 * ¿En qué orden devuelve el lector los datos de cada tarjeta de pedido?
 *
 * Hay dos posibilidades, y cuál toca depende de cómo el lector agrupe las
 * regiones de la imagen —no es algo que se pueda dar por supuesto:
 *
 *     código → Ruta N → Estado      (se busca hacia **adelante**)
 *     Ruta N → Estado → código      (se busca hacia **atrás**)
 *
 * Buscar en las dos direcciones a la vez parece más robusto y es justo lo
 * contrario: cada pedido acabaría robando los datos de su vecino, y el error
 * sería invisible porque el resultado parece plausible.
 *
 * Se decide **una vez por captura**, comparando dónde aparece el primer código
 * y dónde la primera línea `Ruta N`. Dentro de una misma imagen el orden es
 * siempre el mismo, así que con mirar la primera tarjeta basta.
 */
function orientacionDeLasTarjetas(lineas: readonly string[]): "adelante" | "atras" {
  let primerCodigo = -1;
  let primeraRuta = -1;

  for (let i = 0; i < lineas.length; i++) {
    if (primerCodigo === -1 && RE_CODIGO.test(lineas[i])) primerCodigo = i;
    if (primeraRuta === -1 && RE_RUTA_DEL_PEDIDO.test(normalizar(lineas[i]))) primeraRuta = i;
    if (primerCodigo !== -1 && primeraRuta !== -1) break;
  }

  // Sin datos para decidir, el orden natural de lectura.
  if (primerCodigo === -1 || primeraRuta === -1) return "adelante";
  return primeraRuta < primerCodigo ? "atras" : "adelante";
}

/**
 * Busca la ruta y el estado que acompañan a un código de pedido.
 *
 * Recorre en la dirección que dijo `orientacionDeLasTarjetas` y se detiene al
 * topar con otro código, que es donde empieza la tarjeta vecina. Ese tope es
 * lo que evita el error peligroso: sin él, un pedido con la tarjeta cortada
 * heredaría la ruta del de al lado y nadie se daría cuenta.
 */
function contextoDelPedido(
  lineas: readonly string[],
  desde: number,
  orientacion: "adelante" | "atras",
): { ruta: number | null; estado: string | null; completo: boolean } {
  let ruta: number | null = null;
  let estado: string | null = null;

  const paso = orientacion === "adelante" ? 1 : -1;

  for (let i = desde + paso; i >= 0 && i < lineas.length; i += paso) {
    const linea = normalizar(lineas[i]);
    if (RE_CODIGO.test(lineas[i])) break;

    const mRuta = linea.match(RE_RUTA_DEL_PEDIDO);
    if (mRuta && ruta === null) ruta = Number(mRuta[1]);

    const posible = estadoDe(linea);
    if (posible && estado === null) estado = posible;

    if (ruta !== null && estado !== null) break;
  }

  return { ruta, estado, completo: ruta !== null && estado !== null };
}

/** El primer número suelto que aparece justo después, antes de otro horario. */
function numeroSiguiente(lineas: readonly string[], desde: number): number | null {
  for (let i = desde + 1; i < Math.min(lineas.length, desde + 4); i++) {
    const linea = normalizar(lineas[i]);
    if (RE_HORARIO.test(linea)) return null;
    const m = linea.match(RE_NUMERO_SUELTO);
    if (m) return Number(m[1]);
  }
  return null;
}

/** Lo mismo para el estado. */
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
