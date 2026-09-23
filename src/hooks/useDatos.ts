"use client";

import { useCallback, useEffect, useState } from "react";

/**
 * Cargar datos de la base local dentro de una pantalla.
 *
 * En la versión web esto no hacía falta: el servidor consultaba Postgres antes
 * de pintar y la pantalla llegaba ya con los datos puestos. Dentro del APK no
 * hay servidor —la base está en el propio teléfono— así que la pantalla se
 * pinta primero y consulta después.
 *
 * Eso obliga a admitir un estado que antes no existía: **cargando**. Es de
 * verdad muy breve —SQLite local responde en milisegundos, no hay red de por
 * medio— pero existe, y taparlo con una pantalla en blanco se ve como si la
 * app se hubiera colgado.
 *
 * Sobre el nombre: el prefijo `use` no es una concesión al inglés en un código
 * que está en español, sino parte del contrato de React. Sus herramientas lo
 * usan para reconocer un hook y aplicarle sus reglas; llamarlo `usarDatos`
 * las desactivaría en silencio. Es del mismo orden que `onClick` o `className`.
 */
export interface OpcionesDatos {
  /**
   * Al **recargar** (no al cambiar de dependencias), seguir enseñando los datos
   * de antes hasta que lleguen los nuevos.
   *
   * Sin esto, cada `recargar()` dejaba `datos` en null y la pantalla pasaba por
   * el esqueleto: un parpadeo, y peor, todo lo que hubiera dentro se desmontaba
   * y perdía su estado —el aviso «marcaste 2 días como descanso», con su
   * «Deshacer», desaparecía justo al marcarlos—. Es opt-in porque otras
   * pantallas cuentan con ese reinicio para cerrar sus formularios.
   */
  conservar?: boolean;
}

export interface Datos<T> {
  datos: T | null;
  cargando: boolean;
  error: string | null;
  /** Vuelve a consultar. Se usa tras guardar algo. */
  recargar: () => void;
}

interface Resultado<T> {
  /** Para qué consulta es este resultado. Si no coincide, está caduco. */
  clave: string;
  /** Las dependencias solas, sin el contador de recargas. */
  deps: string;
  datos: T | null;
  error: string | null;
}

export function useDatos<T>(
  consulta: () => Promise<T>,
  dependencias: readonly unknown[] = [],
  opciones: OpcionesDatos = {},
): Datos<T> {
  const [intento, setIntento] = useState(0);
  const [resultado, setResultado] = useState<Resultado<T>>({
    clave: "",
    deps: "",
    datos: null,
    error: null,
  });

  /* Las dependencias se reducen a un texto. Permite compararlas con las del
     resultado que ya se tiene y **deducir** si está cargando, en vez de
     encender una bandera a mano dentro del efecto —que provoca un render de
     más y es justo lo que React desaconseja. */
  const deps = JSON.stringify(dependencias);
  const clave = deps + "#" + intento;

  useEffect(() => {
    let vigente = true;

    consulta()
      .then((datos) => {
        // Si la pantalla ya se cerró, escribir su estado pisaría los datos de
        // la pantalla siguiente.
        if (vigente) setResultado({ clave, deps, datos, error: null });
      })
      .catch((fallo: unknown) => {
        if (vigente) {
          setResultado({
            clave,
            deps,
            datos: null,
            error: fallo instanceof Error ? fallo.message : "No se pudieron leer los datos.",
          });
        }
      });

    return () => {
      vigente = false;
    };
    /* `consulta` se deja fuera a propósito: casi siempre es una función flecha
       redefinida en cada render, y incluirla dispararía una recarga infinita.
       Quien decide cuándo volver a consultar es `clave`. */
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clave]);

  const alDia = resultado.clave === clave;
  const recargar = useCallback(() => setIntento((n) => n + 1), []);

  // Una recarga con las mismas dependencias: los datos de antes siguen valiendo
  // mientras llegan los nuevos (solo si se pidió conservarlos).
  const seConserva = Boolean(opciones.conservar) && !alDia && resultado.deps === deps;
  if (seConserva) {
    return { datos: resultado.datos, cargando: false, error: resultado.error, recargar };
  }

  return {
    datos: alDia ? resultado.datos : null,
    cargando: !alDia,
    error: alDia ? resultado.error : null,
    recargar,
  };
}
