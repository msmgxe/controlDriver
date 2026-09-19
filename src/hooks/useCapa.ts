"use client";

import { useEffect } from "react";

/**
 * Marca una hoja o diálogo como "capa abierta".
 *
 * Sirve para dos cosas a la vez, y las dos son lo que cualquiera espera:
 *
 *   · el botón físico de atrás de Android la cierra en vez de salirse de la
 *     aplicación (ver `BotonAtras`);
 *   · la tecla Escape también, que es lo mismo en un teclado.
 *
 * El atributo `data-capa-abierta` en el DOM es lo que permite a `BotonAtras`
 * saber que hay algo encima sin conocer ninguna hoja en concreto: cada una se
 * encarga de la suya y no hay una lista central que mantener.
 */
export function useCapa(alCerrar: () => void): void {
  useEffect(() => {
    const marca = document.createElement("div");
    marca.setAttribute("data-capa-abierta", "");
    marca.style.display = "none";
    document.body.appendChild(marca);

    const cerrar = () => alCerrar();
    const porTecla = (e: KeyboardEvent) => {
      if (e.key === "Escape") alCerrar();
    };

    window.addEventListener("rutas-a:cerrar-capa", cerrar);
    window.addEventListener("keydown", porTecla);

    return () => {
      marca.remove();
      window.removeEventListener("rutas-a:cerrar-capa", cerrar);
      window.removeEventListener("keydown", porTecla);
    };
  }, [alCerrar]);
}
