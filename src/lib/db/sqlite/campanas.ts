/**
 * Campañas de la tienda (CyberNow…): un rango de fechas con un **bono por pedido**
 * que se aplica solo a los pedidos de esas fechas, y, si lo hay, un **bono fijo**
 * que se cobra aparte cuando se cumple el horario.
 *
 * El bono por pedido queda dentro de `ordenes.monto_centimos` (ver `pedidos.ts`),
 * así que todo lo que suma pedidos lo cuenta. Se aplica al **leer** los días
 * (`aplicarCampanasEnRango`, llamado desde `jornadasPorRango`): así alcanza a los
 * pedidos ya cargados y a los que lleguen después, sea cual sea la vía por la que
 * entraron. Lo que la persona puso o quitó a mano manda siempre.
 *
 * Una semana ya pagada no se toca: ni se aplica ni se quita nada en ella.
 */
import type { FechaISO } from "@/lib/fechas";
import { lunesDeLaSemana, sumarDias } from "@/lib/fechas";

import { guardarTaxi, borrarBloque, crearCategoria } from "./bloques-extra";
import { consultar, ejecutar, enTransaccion, nuevoId } from "./conexion";

const ahora = () => new Date().toISOString();

export interface Campana {
  id: string;
  nombre: string;
  /** null = en todas las tiendas. */
  tiendaId: string | null;
  desde: FechaISO;
  hasta: FechaISO;
  bonoPedidoCentimos: number;
  bonoFijoCentimos: number;
  condicion: string | null;
  /** Días de la semana que se descansa: 1 = lunes … 7 = domingo. */
  diasDescanso: number[];
  cumplido: boolean;
  activa: boolean;
}

interface FilaCampana {
  id: string;
  nombre: string;
  tienda_id: string | null;
  desde: string;
  hasta: string;
  bono_pedido_centimos: number;
  bono_fijo_centimos: number;
  condicion: string | null;
  dias_descanso: string;
  cumplido: number;
  bono_bloque_id: string | null;
  activa: number;
}

const aCampana = (f: FilaCampana): Campana => ({
  id: f.id,
  nombre: f.nombre,
  tiendaId: f.tienda_id,
  desde: f.desde as FechaISO,
  hasta: f.hasta as FechaISO,
  bonoPedidoCentimos: f.bono_pedido_centimos,
  bonoFijoCentimos: f.bono_fijo_centimos,
  condicion: f.condicion,
  diasDescanso: f.dias_descanso.split(",").map(Number).filter((n) => n >= 1 && n <= 7),
  cumplido: f.cumplido === 1,
  activa: f.activa === 1,
});

export async function listarCampanas(): Promise<Campana[]> {
  const filas = await consultar<FilaCampana>(`select * from campanas order by desde desc, nombre asc`);
  return filas.map(aCampana);
}

/** Día de la semana de una fecha: 1 = lunes … 7 = domingo. */
export function diaDeLaSemana(f: FechaISO): number {
  const d = new Date(`${f}T12:00:00Z`).getUTCDay();
  return d === 0 ? 7 : d;
}

/** Todas las fechas del rango, ambas incluidas. */
export function fechasDelRango(desde: FechaISO, hasta: FechaISO): FechaISO[] {
  const salida: FechaISO[] = [];
  for (let f = desde; f <= hasta && salida.length < 400; f = sumarDias(f, 1)) salida.push(f);
  return salida;
}

export interface DatosDeCampana {
  nombre: string;
  tiendaId: string | null;
  desde: FechaISO;
  hasta: FechaISO;
  bonoPedidoCentimos: number;
  bonoFijoCentimos: number;
  condicion?: string | null;
  diasDescanso?: number[];
}

function validar(d: DatosDeCampana): void {
  const nombre = d.nombre.trim();
  if (nombre.length < 2 || nombre.length > 40) throw new Error("El nombre de la campaña debe tener entre 2 y 40 letras.");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d.desde) || !/^\d{4}-\d{2}-\d{2}$/.test(d.hasta) || d.hasta < d.desde) {
    throw new Error("Las fechas no son válidas: «hasta» no puede ser antes que «desde».");
  }
  if (fechasDelRango(d.desde, d.hasta).length > 62) throw new Error("Una campaña no puede durar más de dos meses.");
  for (const c of [d.bonoPedidoCentimos, d.bonoFijoCentimos]) {
    if (!Number.isInteger(c) || c < 0 || c > 100_000) throw new Error("Los bonos tienen que estar entre S/ 0 y S/ 1000.");
  }
  if (d.bonoPedidoCentimos === 0 && d.bonoFijoCentimos === 0) throw new Error("Pon al menos un bono: por pedido o fijo.");
}

/** Crea o cambia una campaña y reparte sus bonos entre los pedidos del período. */
export async function guardarCampana(datos: DatosDeCampana, id?: string): Promise<{ id: string; resultado: ResultadoDeAplicar }> {
  validar(datos);
  const momento = ahora();
  const dias = (datos.diasDescanso ?? []).filter((n) => n >= 1 && n <= 7).join(",");
  const cid = id ?? nuevoId();
  if (id) {
    await ejecutar(
      `update campanas set nombre = ?, tienda_id = ?, desde = ?, hasta = ?, bono_pedido_centimos = ?,
              bono_fijo_centimos = ?, condicion = ?, dias_descanso = ?, actualizado_en = ? where id = ?`,
      [datos.nombre.trim(), datos.tiendaId, datos.desde, datos.hasta, datos.bonoPedidoCentimos, datos.bonoFijoCentimos,
        datos.condicion?.trim() || null, dias, momento, id],
    );
  } else {
    await ejecutar(
      `insert into campanas (id, nombre, tienda_id, desde, hasta, bono_pedido_centimos, bono_fijo_centimos,
                             condicion, dias_descanso, creado_en, actualizado_en)
       values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [cid, datos.nombre.trim(), datos.tiendaId, datos.desde, datos.hasta, datos.bonoPedidoCentimos, datos.bonoFijoCentimos,
        datos.condicion?.trim() || null, dias, momento, momento],
    );
  }
  return { id: cid, resultado: await aplicarCampanasEnRango(datos.desde, datos.hasta, { forzar: true }) };
}

/** Quita la campaña y los bonos que puso (y el bono fijo, si ya se había marcado). Lo hecho a mano se respeta. */
export async function borrarCampana(id: string): Promise<ResultadoDeAplicar> {
  const f = (await consultar<FilaCampana>(`select * from campanas where id = ?`, [id]))[0];
  if (!f) return { aplicados: 0, quitados: 0, omitidosPagada: 0 };
  if (f.bono_bloque_id) await borrarBloque(f.bono_bloque_id);
  await ejecutar(`delete from campanas where id = ?`, [id]);
  return aplicarCampanasEnRango(f.desde as FechaISO, f.hasta as FechaISO, { forzar: true });
}

export interface ResultadoDeAplicar {
  aplicados: number;
  quitados: number;
  /** Pedidos que no se tocaron porque su semana ya está pagada. */
  omitidosPagada: number;
}

let aplicando = false;

/**
 * Reparte los bonos de las campañas activas entre los pedidos de `desde`…`hasta`:
 * pone el bono a los que les toca y se lo quita a los que ya no (por cambiar las
 * fechas, la tienda o el monto). No toca lo puesto o quitado a mano ni las
 * semanas pagadas. Barato cuando no hay campañas: una consulta.
 */
export async function aplicarCampanasEnRango(
  desde: FechaISO,
  hasta: FechaISO,
  opciones: { forzar?: boolean } = {},
): Promise<ResultadoDeAplicar> {
  const resultado: ResultadoDeAplicar = { aplicados: 0, quitados: 0, omitidosPagada: 0 };
  if (aplicando) return resultado;
  aplicando = true;
  try {
    const campanas = (await consultar<FilaCampana>(`select * from campanas`)).map(aCampana);
    const hayQueQuitar = opciones.forzar
      ? true
      : (await consultar<{ n: number }>(`select count(*) as n from ordenes where campana_id is not null`))[0]?.n > 0;
    const activas = campanas.filter((c) => c.activa && c.bonoPedidoCentimos > 0);
    if (activas.length === 0 && !hayQueQuitar) return resultado;

    const filas = await consultar<{
      id: string;
      fecha: string;
      tienda_id: string | null;
      monto_centimos: number | null;
      bono_centimos: number;
      campana_id: string | null;
      sin_bono: number;
    }>(
      `select o.id, j.fecha, j.tienda_id, o.monto_centimos, o.bono_centimos, o.campana_id, o.sin_bono
         from ordenes o join jornadas j on j.id = o.jornada_id
        where j.fecha >= ? and j.fecha <= ?`,
      [desde, hasta],
    );

    const pagadas = new Set(
      (await consultar<{ semana_inicio: string }>(`select semana_inicio from liquidaciones where estado = 'pagada'`)).map(
        (f) => f.semana_inicio,
      ),
    );
    const nombrePorId = new Map(campanas.map((c) => [c.id, c.nombre]));

    await enTransaccion(async () => {
      for (const o of filas) {
        const manual = o.bono_centimos > 0 && o.campana_id === null; // lo puso la persona: manda
        if (manual || o.sin_bono === 1) continue;
        const fecha = o.fecha as FechaISO;
        const ganadora = activas
          .filter((c) => fecha >= c.desde && fecha <= c.hasta && (c.tiendaId === null || c.tiendaId === o.tienda_id))
          .sort((a, b) => b.bonoPedidoCentimos - a.bonoPedidoCentimos)[0];

        const igual = ganadora ? o.campana_id === ganadora.id && o.bono_centimos === ganadora.bonoPedidoCentimos : o.campana_id === null;
        if (igual) continue;
        if (pagadas.has(lunesDeLaSemana(fecha))) {
          resultado.omitidosPagada += 1;
          continue;
        }
        const nuevo = ganadora?.bonoPedidoCentimos ?? 0;
        await ejecutar(
          `update ordenes set monto_centimos = coalesce(monto_centimos, 0) - bono_centimos + ?,
                  bono_centimos = ?, bono_nombre = ?, campana_id = ? where id = ?`,
          [nuevo, nuevo, ganadora ? (nombrePorId.get(ganadora.id) ?? ganadora.id) : null, ganadora?.id ?? null, o.id],
        );
        if (nuevo > 0) resultado.aplicados += 1;
        else resultado.quitados += 1;
      }
    });
    return resultado;
  } finally {
    aplicando = false;
  }
}

/* ---------------------------------------------------------------------------
 * Bono fijo y horario
 * ------------------------------------------------------------------------- */

export interface ProgresoDeHorario {
  /** Días del período en que tocaba trabajar (sin contar los de descanso). */
  requeridos: FechaISO[];
  /** De esos, los que tienen carga. */
  cumplidos: FechaISO[];
  /** Los que faltan por cargar. */
  faltan: FechaISO[];
  /** ¿Ya pasó el último día? */
  terminada: boolean;
}

/**
 * Cuántos días de **tu horario** llevas cumplidos en la campaña. Los días que
 * descansas (martes y sábado, por ejemplo) no se exigen; los demás cuentan si
 * tienen pedidos cargados.
 */
export async function progresoDeHorario(c: Campana, hoy: FechaISO): Promise<ProgresoDeHorario> {
  const requeridos = fechasDelRango(c.desde, c.hasta).filter((f) => !c.diasDescanso.includes(diaDeLaSemana(f)));
  const conCarga = new Set(
    (
      await consultar<{ fecha: string }>(
        `select j.fecha from jornadas j
          where j.fecha >= ? and j.fecha <= ?
            and exists (select 1 from ordenes o where o.jornada_id = j.id)`,
        [c.desde, c.hasta],
      )
    ).map((f) => f.fecha),
  );
  const cumplidos = requeridos.filter((f) => conCarga.has(f));
  return { requeridos, cumplidos, faltan: requeridos.filter((f) => !conCarga.has(f)), terminada: hoy > c.hasta };
}

/**
 * Marca (o desmarca) el bono fijo como cumplido. Al marcarlo se registra como un
 * adicional «Bono de campaña» en el último día del período, así entra en Pagos, en
 * los totales y en las exportaciones sin más; al desmarcarlo se quita.
 */
export async function marcarBonoFijo(id: string, cumplido: boolean): Promise<void> {
  const f = (await consultar<FilaCampana>(`select * from campanas where id = ?`, [id]))[0];
  if (!f) throw new Error("Esa campaña ya no existe.");
  if (f.bono_fijo_centimos <= 0) throw new Error("Esta campaña no tiene bono fijo.");
  /* Sin transacción propia: crear el tipo y el registro ya abren las suyas, y SQLite no
     anida. Si la última escritura fallara, se quita el registro para no dejarlo huérfano. */
  if (cumplido && !f.bono_bloque_id) {
    const categoria = await crearCategoria("Bono de campaña");
    const { id: bloque } = await guardarTaxi({
      fecha: f.hasta as FechaISO,
      horaInicio: null,
      horaFin: null,
      origen: null,
      destino: null,
      km: 0,
      kmFuente: "manual",
      montoCentimos: f.bono_fijo_centimos,
      notas: f.nombre,
      categoriaId: categoria.id,
      descripcion: f.nombre,
    });
    try {
      await ejecutar(`update campanas set cumplido = 1, bono_bloque_id = ?, actualizado_en = ? where id = ?`, [bloque, ahora(), id]);
    } catch (fallo) {
      await borrarBloque(bloque);
      throw fallo;
    }
  } else if (!cumplido && f.bono_bloque_id) {
    await borrarBloque(f.bono_bloque_id);
    await ejecutar(`update campanas set cumplido = 0, bono_bloque_id = null, actualizado_en = ? where id = ?`, [ahora(), id]);
  }
}

/** Lo que llevan sumado los pedidos con el bono de esta campaña. */
export async function resumenDeCampana(id: string): Promise<{ pedidos: number; centimos: number }> {
  const r = (
    await consultar<{ n: number; s: number | null }>(
      `select count(*) as n, sum(bono_centimos) as s from ordenes where campana_id = ?`,
      [id],
    )
  )[0];
  return { pedidos: r?.n ?? 0, centimos: r?.s ?? 0 };
}
