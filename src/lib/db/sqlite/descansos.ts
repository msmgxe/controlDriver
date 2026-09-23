/**
 * Los días en que no se trabajó.
 *
 * Hasta ahora un día sin jornada cargada era siempre «falta subirlo», y la
 * pantalla de Pagos preguntaba cada vez «¿No trabajaste o falta la carga?»
 * sin dejar contestar. Aquí se contesta: **«no trabajé esos días»** los marca
 * como descanso, y desde ese momento ya no son un hueco.
 *
 * Un descanso es solo una fecha. No lleva pedidos ni rutas, no entra en ningún
 * monto, y desaparece solo si ese día llega a cargarse (ver `guardarJornada`).
 */
import type { FechaISO } from "@/lib/fechas";

import { consultar, ejecutar } from "./conexion";

const ahora = () => new Date().toISOString();

/**
 * Marca esos días como de descanso.
 *
 * Un día que ya tiene jornada **no se marca**: tiene pedidos, así que se
 * trabajó, y una marca de descanso encima sería una contradicción que luego
 * nadie sabría resolver. Devuelve las fechas que sí se marcaron, para poder
 * decir «marqué 2» y no «marqué 3» cuando una no procedía.
 */
export async function marcarDescanso(fechas: readonly FechaISO[]): Promise<FechaISO[]> {
  if (fechas.length === 0) return [];

  /* Sin transacción: cada día es independiente, y si uno falla los ya marcados
     no tienen por qué deshacerse. */
  const marcadas: FechaISO[] = [];
  for (const fecha of new Set(fechas)) {
    const cargada = await consultar<{ id: string }>(
      `select id from jornadas where fecha = ? limit 1`,
      [fecha],
    );
    if (cargada.length > 0) continue;

    await ejecutar(
      `insert into dias_descanso (fecha, creado_en) values (?, ?)
       on conflict (fecha) do nothing`,
      [fecha, ahora()],
    );
    marcadas.push(fecha);
  }
  return marcadas.sort();
}

/** Quita la marca de descanso: el día vuelve a contar como «sin subir». */
export async function quitarDescanso(fechas: readonly FechaISO[]): Promise<void> {
  for (const fecha of fechas) {
    await ejecutar(`delete from dias_descanso where fecha = ?`, [fecha]);
  }
}

/** Los días de descanso dentro de un rango, de más antiguo a más reciente. */
export async function descansosPorRango(desde: FechaISO, hasta: FechaISO): Promise<FechaISO[]> {
  const filas = await consultar<{ fecha: string }>(
    `select fecha from dias_descanso where fecha >= ? and fecha <= ? order by fecha asc`,
    [desde, hasta],
  );
  return filas.map((f) => f.fecha as FechaISO);
}
