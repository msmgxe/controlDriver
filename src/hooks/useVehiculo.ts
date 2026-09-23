"use client";

import { usePathname } from "next/navigation";

import { perfilActual } from "@/lib/db/sqlite/perfil";
import { VEHICULO_POR_DEFECTO, type TipoVehiculo } from "@/lib/pagos/reglas";

import { useDatos } from "./useDatos";

/**
 * Con qué vehículo reparte hoy, solo para elegir su ícono (ver
 * `src/components/Auto.tsx`).
 *
 * Se consulta aparte y no se hereda por props porque quien lo necesita está a
 * los dos lados de la frontera layout/página —el armazón y cada pantalla— y
 * esa frontera no deja pasar props. La consulta es a la base local, que
 * responde en milisegundos, así que duplicarla sale más barato que inventar un
 * sitio por donde bajarla.
 *
 * **Se vuelve a leer en cada cambio de ruta.** El armazón vive fuera de las
 * pantallas —no se desmonta al navegar—, así que su propia lectura, hecha una
 * sola vez al montar, no se enteraría de un cambio de modalidad hecho en
 * Ajustes hasta recargar la app entera: el auto de la barra de abajo seguiría
 * siendo un auto aunque el perfil ya dijera moto. Con la ruta como
 * dependencia, volver de Ajustes a Inicio ya alcanza.
 *
 * Mientras carga o si todavía no hay perfil, se asume auto: es el vehículo por
 * defecto de toda la app, y un ícono no merece una tercera forma de espera.
 */
export function useVehiculo(): TipoVehiculo {
  const ruta = usePathname();
  const { datos } = useDatos(() => perfilActual(), [ruta], { conservar: true });
  return datos?.vehiculo ?? VEHICULO_POR_DEFECTO;
}
