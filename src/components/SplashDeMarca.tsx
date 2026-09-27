"use client";

import { useEffect, useState } from "react";

import { IconoApp } from "@/components/IconoApp";

/**
 * La pantalla de marca al abrir la app: el ícono, el nombre y una frase, dos
 * segundos, y se retira.
 *
 * Es la opción «A» de las tres que se probaron como prototipo
 * (`prototipo/propuestas-splash.html`): siempre dura lo mismo, sea cual sea el
 * teléfono. El fondo no es un color fijo: usa `--acento` y `--acento-tinta` del
 * tema elegido (los mismos tokens de `globals.css`), así que sale del color de
 * la cara activa —verde si es Menta, morado si es Turbo…—. La primera vez que
 * se instala, antes de elegir nada en Ajustes, sale con Menta.
 *
 * Vive en el layout raíz, por encima de todo (`Armazon`, el candado del PIN):
 * se monta una vez por arranque de la app y no vuelve a aparecer al navegar
 * entre pantallas, porque el layout raíz no se remonta con la navegación del
 * lado del cliente.
 */
const DURACION_MS = 2000;
const SALIDA_MS = 450;

export function SplashDeMarca() {
  const [fase, setFase] = useState<"mostrando" | "saliendo" | "listo">("mostrando");

  useEffect(() => {
    const entra = setTimeout(() => setFase("saliendo"), DURACION_MS);
    return () => clearTimeout(entra);
  }, []);

  useEffect(() => {
    if (fase !== "saliendo") return;
    // Por si el navegador no avisa del final de la transición (movimiento reducido).
    const sale = setTimeout(() => setFase("listo"), SALIDA_MS);
    return () => clearTimeout(sale);
  }, [fase]);

  if (fase === "listo") return null;

  return (
    <div
      aria-hidden
      className={`splash-marca ${fase === "saliendo" ? "splash-marca--sale" : ""}`}
      onTransitionEnd={(e) => {
        if (e.propertyName === "opacity" && fase === "saliendo") setFase("listo");
      }}
    >
      <div className="splash-marca-contenido">
        <IconoApp className="splash-marca-ico" />
        <span className="splash-marca-nombre">
          Control
          <br />
          <em>Driver</em>
        </span>
        <span className="splash-marca-lema">Tus pedidos y tus pagos, claros en tu celular</span>
      </div>
    </div>
  );
}
