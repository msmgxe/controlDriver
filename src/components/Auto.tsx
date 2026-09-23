/**
 * El vehículo de Rutas-A: la marca.
 *
 * Un vehículo de perfil que va deprisa, con su estela, y hay dos: **auto** y
 * **moto eléctrica** (una cabina chica y una caja de reparto grande, como los
 * que usan varios repartidores). Cuál de los dos se dibuja lo decide `vehiculo`,
 * normalmente el del perfil
 * (`perfil.vehiculo`): quien reparte en moto ve su moto en la cabecera, en el
 * menú y en el botón de cargar, no un auto que no es el suyo.
 *
 * Cada vehículo cambia además de traje con la cara de la app (ver
 * `src/lib/apariencia.ts`):
 *
 *   · **claro («Mapa»)**: colores llenos, borde y una estela de puntos, como
 *     un rastro sobre un plano;
 *   · **oscuro («Asfalto»)**: más bajo, con la estela en rayas discontinuas,
 *     como la línea de eje de la carretera.
 *
 * Los colores salen de las variables del tema —por eso no hay ni un hex aquí— y
 * los cuatro trajes (2 vehículos × 2 modos) conviven en el mismo SVG: el CSS
 * enseña el que toca según `data-modo` (`.auto` en `globals.css`); cuál de los
 * dos vehículos se monta lo decide React, porque no depende del tema sino del
 * perfil. Así cambiar de modo no vuelve a pintar nada, y cambiar de vehículo
 * es tan barato como eso.
 *
 * Variantes:
 *   · `sobreAcento`: para ponerlo encima de una tarjeta del color de la marca,
 *     donde el vehículo normal se confundiría con el fondo.
 *   · `mono`: a una sola tinta —la del texto—, para iconos pequeños como el de
 *     la barra de abajo.
 */
import type { TipoVehiculo } from "@/lib/pagos/reglas";

/** El auto: techo a distinta altura según el traje. */
function carroceria(techo: number): { cuerpo: string; vidrios: string } {
  return {
    cuerpo:
      `M14 44V37Q14 32 20 31L33 29Q39 ${techo + 2} 51 ${techo}H77Q86 ${techo + 1} 92 25` +
      `L96 29Q110 31 112 38V44H101A11 11 0 0 0 79 44H45A11 11 0 0 0 23 44Z`,
    vidrios:
      `M46 27Q49 ${techo + 4} 54 ${techo + 3}H63V27Z` +
      `M67 ${techo + 3}H76Q81 ${techo + 4} 85 27H67Z`,
  };
}

/**
 * La moto eléctrica: un camión de caja —caja de reparto grande detrás, cabina
 * chica y baja delante, con su ventanilla—, sobre las dos mismas ruedas que
 * el auto —para que los dos vehículos midan igual dentro de un ícono chico y
 * no haya que ajustar cada sitio donde se usan—. Es la forma que de verdad se
 * reconoce como "reparto" a 36 px: la cabina tiene que ser claramente
 * **pequeña** al lado de la caja, o a ese tamaño el trazo grueso redondea
 * cualquier escalón chico y todo el vehículo se lee como un auto más.
 *
 * El vehículo mira hacia la derecha —la estela y el faro del auto van del
 * mismo lado—, así que la cabina va junto a la rueda derecha (delantera) y
 * la caja ocupa el resto hacia la izquierda, igual que en un camión de
 * reparto de verdad: la cabina nunca va detrás de la caja.
 *
 * A diferencia de `carroceria`, los dos trajes no comparten una sola fórmula:
 * la cabina ya está pegada al arco de la rueda delantera y no hay margen para
 * bajarla más en el traje oscuro, así que solo se achica la caja.
 */
const TRICI_CLARO = {
  cuerpo:
    "M14 44V37Q14 32 20 31L24 30Q28 12 36 12H76L80 28H96L100 30Q106 32 112 36V44" +
    "H101A11 11 0 0 0 79 44H45A11 11 0 0 0 23 44Z",
  vidrios: "M83 30V28Q83 25 86 25H94V30Z",
};
const TRICI_OSCURO = {
  cuerpo:
    "M14 44V37Q14 32 20 31L24 30Q28 17 36 17H76L80 30H96L100 32Q106 34 112 38V44" +
    "H101A11 11 0 0 0 79 44H45A11 11 0 0 0 23 44Z",
  vidrios: "M83 32V30Q83 27 86 27H94V32Z",
};

const AUTO = { claro: carroceria(10), oscuro: carroceria(17) };
const MOTO = { claro: TRICI_CLARO, oscuro: TRICI_OSCURO };

export function Auto({
  vehiculo = "auto",
  className = "",
  sobreAcento = false,
  mono = false,
  animado = false,
}: {
  /** Cuál de los dos vehículos dibujar. Cualquiera que no sea "moto" es el auto. */
  vehiculo?: TipoVehiculo;
  className?: string;
  sobreAcento?: boolean;
  mono?: boolean;
  /** Entra rodando, una vez. Con «reducir movimiento» se queda quieto. */
  animado?: boolean;
}) {
  const formas = vehiculo === "moto" ? MOTO : AUTO;

  const clases = [
    "auto",
    sobreAcento ? "auto--sobre-acento" : "",
    mono ? "auto--mono" : "",
    animado ? "auto--anima" : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <svg className={clases} viewBox="0 6 142 52" aria-hidden="true" focusable="false">
      {/* Las estelas van detrás y cambian con el traje, no con el vehículo. */}
      <g className="auto-estela c-claro">
        <path d="M0 54C10 54 14 50 24 46" strokeWidth="3.2" strokeDasharray="0.1 6.5" strokeLinecap="round" />
        <path d="M4 36h16" strokeWidth="3" strokeLinecap="round" opacity=".55" />
      </g>
      <g className="auto-estela c-oscuro">
        <path d="M0 30h21M7 38h14M0 46h21" strokeWidth="3" strokeDasharray="8 5" />
      </g>

      <g transform="translate(22 0)">
        <g className="c-claro">
          <path className="auto-cuerpo auto-borde" d={formas.claro.cuerpo} />
          <path className="auto-vidrio" d={formas.claro.vidrios} />
        </g>
        <g className="c-oscuro">
          <path className="auto-cuerpo" d={formas.oscuro.cuerpo} />
          <path className="auto-vidrio" d={formas.oscuro.vidrios} />
        </g>
        <rect className="auto-faro" x="107" y="34" width="6" height="4" rx="2" />
        <circle className="auto-rueda" cx="34" cy="44" r="8.5" />
        <circle className="auto-rueda" cx="90" cy="44" r="8.5" />
        <circle className="auto-buje" cx="34" cy="44" r="3.4" />
        <circle className="auto-buje" cx="90" cy="44" r="3.4" />
      </g>
    </svg>
  );
}
