"use client";

import { useEffect, useState } from "react";

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

/**
 * El ícono de la marca: un cuadro redondeado con un visto, un anillo y dos
 * puntos de estela. El cuadro toma el degradado de la cara activa
 * (`--acento` → `--acento-tinta`); el anillo, el segundo color de esa misma
 * cara (`--acento-2`) —amarillo en Mapa y Turbo, celeste en Asfalto, coral en
 * Menta—; el visto es blanco siempre, para que se lea igual sobre cualquiera.
 */
function IconoApp({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 100 100" role="img" aria-label="Control Driver">
      <defs>
        <linearGradient id="splash-marca-degradado" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" className="splash-marca-parada-a" />
          <stop offset="1" className="splash-marca-parada-b" />
        </linearGradient>
      </defs>
      <rect className="splash-marca-cuadro" x="4" y="4" width="92" height="92" rx="24" />
      <circle className="splash-marca-punto" cx="22" cy="66" r="3" opacity=".55" />
      <circle className="splash-marca-punto" cx="30" cy="61" r="3.6" opacity=".8" />
      <path
        className="splash-marca-visto"
        d="M35 52 L46 63 L74 30 a7 7 0 0 1 9 10.7 L50 76.5 a7 7 0 0 1 -9.9 .3 L25.5 62 a7 7 0 0 1 9.5 -10.3Z"
      />
      <circle className="splash-marca-anillo" cx="76" cy="35" r="10" />
      <circle className="splash-marca-anillo-centro" cx="76" cy="35" r="4" />
    </svg>
  );
}
