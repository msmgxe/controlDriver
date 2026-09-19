/**
 * Datos de ejemplo, para enseñar la aplicación.
 *
 * Una app vacía no se puede enseñar: no se ve el historial, ni el gráfico, ni
 * la regla de permanencia haciendo su trabajo. Esto llena tres semanas con
 * jornadas verosímiles —incluyendo los casos que importan— y se puede borrar
 * de un toque.
 *
 * Lleva a propósito los tres casos que cuesta explicar de palabra:
 *
 *   · un día bueno donde ganan los pedidos,
 *   · un día flojo donde **paga el piso de permanencia** y se ve por qué,
 *   · una media jornada, donde el piso baja a la mitad.
 */
import { hoyEnLima, sumarDias, type FechaISO } from "@/lib/fechas";

import { ejecutar } from "./conexion";
import { guardarJornada } from "./jornadas";
import { perfilActual } from "./perfil";
import type { OrdenParaGuardar } from "../tipos";

/** pedidos, rutas, [entrada, salida] */
const GUION: ReadonlyArray<[number, number, string, string]> = [
  [14, 7, "09:00", "22:00"],
  [11, 6, "09:00", "22:00"],
  [18, 8, "09:00", "22:00"],
  [9, 5, "09:00", "22:00"],
  [16, 8, "09:00", "22:00"],
  [21, 9, "09:00", "22:00"],
  [12, 6, "14:00", "22:00"],
  [13, 7, "09:00", "22:00"],
  [10, 5, "09:00", "22:00"],
  [17, 8, "09:00", "22:00"],
  [15, 7, "09:00", "22:00"],
  [19, 9, "09:00", "22:00"],
  [8, 4, "09:00", "22:00"],
  [14, 7, "09:00", "22:00"],
  [16, 8, "09:00", "22:00"],
  [12, 6, "09:00", "22:00"],
  [20, 9, "09:00", "22:00"],
  [11, 6, "09:00", "22:00"],
];

export async function cargarDatosDeEjemplo(): Promise<number> {
  const perfil = await perfilActual();
  const hoy = hoyEnLima();
  let creadas = 0;

  for (let i = 0; i < GUION.length; i++) {
    // Se va hacia atrás desde ayer, saltando los domingos: nadie reparte todos
    // los días y un historial sin huecos no se parece a la realidad.
    const fecha = sumarDias(hoy, -(i + 1)) as FechaISO;
    const diaSemana = new Date(`${fecha}T12:00:00Z`).getUTCDay();
    if (diaSemana === 0) continue;

    const [pedidos, rutas, entrada, salida] = GUION[i];

    await guardarJornada(
      {
        fecha,
        rutasDeclaradas: rutas,
        ordenesDeclaradas: pedidos,
        validacionOk: true,
        horaEntrada: entrada,
        horaSalida: salida,
        tiendaId: perfil?.tiendaId ?? null,
        vehiculo: perfil?.vehiculo ?? "auto",
        rutas: Array.from({ length: rutas }, (_, r) => {
          const inicio = 9 * 60 + 30 + r * 95;
          const fin = inicio + 55 + ((r * 7) % 20);
          return {
            numero: r + 1,
            estado: "Finalizado",
            horaInicio: aHora(inicio),
            horaFin: aHora(fin),
          };
        }),
        ordenes: pedidosDelDia(fecha, pedidos, rutas),
      },
      "reemplazar",
    );
    creadas++;
  }

  return creadas;
}

function aHora(minutos: number): string {
  const h = Math.floor(minutos / 60) % 24;
  const m = minutos % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function pedidosDelDia(fecha: string, cuantos: number, rutas: number): OrdenParaGuardar[] {
  const semilla = Number(fecha.replaceAll("-", "")) % 997;

  return Array.from({ length: cuantos }, (_, i) => {
    // Casi todo cae en el tramo 1, que es lo normal; algún pedido lejano se
    // reparte por el día, como las excepciones que son.
    const lejano = (semilla + i * 13) % 11 === 0;
    const muyLejano = (semilla + i * 29) % 37 === 0;
    const tramo = muyLejano ? 3 : lejano ? 2 : 1;

    const noEntregado = (semilla + i * 41) % 53 === 0;
    const parcial = !noEntregado && (semilla + i * 17) % 47 === 0;

    return {
      codigo: `v${12236800 + semilla * 37 + i * 41}wofp-01`,
      estado: noEntregado ? "No entregado" : parcial ? "Entrega parcial" : "Entregado",
      posicion: i + 1,
      ruta: (i % rutas) + 1,
      tramo,
      km: null,
      montoCentimos: tramo === 3 ? 1300 : tramo === 2 ? 1150 : 1000,
    };
  });
}

/** Deja la base como recién instalada, sin tocar el perfil ni la licencia. */
export async function borrarTodasLasJornadas(): Promise<void> {
  await ejecutar(`delete from jornadas`);
  await ejecutar(`delete from liquidaciones`);
  await ejecutar(`delete from cargas`);
}
