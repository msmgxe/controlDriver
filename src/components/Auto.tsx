/**
 * El vehículo de Rutas-A: la marca.
 *
 * Hay dos: el **auto** —un auto compacto de perfil con su conductor en la
 * ventanilla y una estela detrás— y la **moto**, un repartidor en su scooter
 * con la caja de reparto a la espalda. Cuál de los dos se dibuja lo decide
 * `vehiculo`, normalmente el del perfil (`perfil.vehiculo`): quien reparte en
 * moto ve su moto en la cabecera, en el menú y en las tarjetas, no un auto que
 * no es el suyo.
 *
 * Los dos toman los colores de la cara elegida (ver `src/lib/apariencia.ts`) a
 * través de variables CSS —por eso no hay ni un hex aquí—:
 *
 *   · **claro («Mapa»)**: colores llenos, borde y una estela de puntos, como
 *     un rastro sobre un plano;
 *   · **oscuro («Asfalto»)**: sin borde, con la estela en rayas discontinuas,
 *     como la línea de eje de la carretera;
 *   · **turbo** y **menta**: los suyos, por sus propios tokens.
 *
 * La estela cambia con el traje y se dibuja detrás; el vehículo, por encima.
 * Las dos estelas conviven en el mismo SVG y el CSS enseña la que toca según
 * `data-modo` (`.auto` en `globals.css`).
 *
 * Variantes:
 *   · `sobreAcento`: para ponerlo encima de una tarjeta del color de la marca,
 *     donde el vehículo normal se confundiría con el fondo.
 *   · `mono`: a una sola tinta —la del texto—, para iconos pequeños como el de
 *     la barra de abajo.
 *   · `icono`: el tamaño de un icono de la barra (la moto es más alta que el
 *     auto, así que no miden lo mismo de ancho).
 */
import type { TipoVehiculo } from "@/lib/pagos/reglas";

/**
 * El auto: un compacto de perfil, con las dos ventanillas y el conductor en la
 * de delante. Mira hacia la derecha; la estela va a su izquierda.
 */
const TECHO = 12;
const AUTO = {
  cuerpo:
    `M14 44V36Q14 31 20 30L30 28Q36 ${TECHO + 1} 52 ${TECHO}H74Q88 ${TECHO} 94 26` +
    `L104 29Q112 31 112 37V44H101A11 11 0 0 0 79 44H45A11 11 0 0 0 23 44Z`,
  vidrios:
    `M37 26Q41 ${TECHO + 4} 53 ${TECHO + 3.5}H60V26Z` +
    `M64 ${TECHO + 3.5}H73Q83 ${TECHO + 3.5} 88 26H64Z`,
  cabeza: { cx: 72, cy: TECHO + 9.2, r: 3.1 },
  hombros: `M66.5 26Q67 ${TECHO + 12.6} 72 ${TECHO + 12.6}Q77 ${TECHO + 12.6} 77.5 26Z`,
};

/**
 * La moto: un repartidor en su scooter, con la caja de reparto detrás. Es un
 * dibujo de trazo —casco, torso, brazo hacia el manubrio, pierna, dos ruedas—
 * con la caja y el torso rellenos del color de la cara, para que se lea igual
 * de reparto que el auto a 30 px. Mira hacia la derecha, como el auto.
 */
const MOTO = {
  caja: "M6 22H38V46H6Z",
  tapa: "M6 29H38",
  carroceria: "M14 66Q14 49 30 49H58L60 58H78Q79 44 87 35",
  manubrio: "M86 27L89 35M83 26H95",
  horquilla: "M88 42L97 66",
  guardabarro: "M86 57Q98 50 108 59",
  torso: "M46 48L50 30Q52 26 58 27Q64 28 63 34L60 48Z",
  brazo: "M57 32Q71 37 85 27",
  pierna: "M47 49L66 52L68 62",
  casco: { cx: 57, cy: 17, r: 8.5 },
  visera: "M63 16.5H67",
  ruedas: [28, 98],
};

export function Auto({
  vehiculo = "auto",
  className = "",
  sobreAcento = false,
  mono = false,
  animado = false,
  icono = false,
}: {
  /** Cuál de los dos vehículos dibujar. Cualquiera que no sea "moto" es el auto. */
  vehiculo?: TipoVehiculo;
  className?: string;
  sobreAcento?: boolean;
  mono?: boolean;
  /** Entra rodando, una vez. Con «reducir movimiento» se queda quieto. */
  animado?: boolean;
  /** Del tamaño de un icono de la barra de abajo. */
  icono?: boolean;
}) {
  const esMoto = vehiculo === "moto";

  const clases = [
    "auto",
    esMoto ? "auto--moto" : "",
    sobreAcento ? "auto--sobre-acento" : "",
    mono ? "auto--mono" : "",
    animado ? "auto--anima" : "",
    icono ? (esMoto ? "w-8" : "w-10") : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  if (esMoto) {
    return (
      <svg className={clases} viewBox="-14 0 134 90" aria-hidden="true" focusable="false">
        <Estelas x0={-14} ancho={12} punteada={[82, 74]} centro={36} />

        <path className="moto-caja" d={MOTO.caja} />
        <path className="moto-trazo" d={MOTO.tapa} />
        <path className="moto-trazo" d={MOTO.carroceria} />
        <path className="moto-trazo" d={MOTO.manubrio} />
        <path className="moto-trazo" d={MOTO.horquilla} />
        <path className="moto-trazo" d={MOTO.guardabarro} />
        {MOTO.ruedas.map((x) => (
          <g key={x}>
            <circle className="moto-rueda" cx={x} cy={69} r={11} />
            <circle className="moto-buje" cx={x} cy={69} r={3} />
          </g>
        ))}
        <path className="moto-caja" d={MOTO.torso} />
        <path className="moto-trazo" d={MOTO.brazo} />
        <path className="moto-trazo" d={MOTO.pierna} />
        <circle className="moto-casco" cx={MOTO.casco.cx} cy={MOTO.casco.cy} r={MOTO.casco.r} />
        <path className="moto-trazo" d={MOTO.visera} />
      </svg>
    );
  }

  return (
    <svg className={clases} viewBox="0 6 142 52" aria-hidden="true" focusable="false">
      <Estelas x0={0} ancho={21} punteada={[54, 46]} centro={38} />

      <g transform="translate(22 0)">
        <path className="auto-cuerpo auto-borde" d={AUTO.cuerpo} />
        <path className="auto-vidrio" d={AUTO.vidrios} />
        <circle className="auto-piloto" cx={AUTO.cabeza.cx} cy={AUTO.cabeza.cy} r={AUTO.cabeza.r} />
        <path className="auto-piloto" d={AUTO.hombros} />
        <rect className="auto-faro" x="107" y="33" width="6" height="4" rx="2" />
        <circle className="auto-rueda" cx="34" cy="44" r="8.5" />
        <circle className="auto-rueda" cx="90" cy="44" r="8.5" />
        <circle className="auto-buje" cx="34" cy="44" r="3.4" />
        <circle className="auto-buje" cx="90" cy="44" r="3.4" />
      </g>
    </svg>
  );
}

/**
 * La estela, detrás del vehículo. Cambia con el traje, no con el vehículo: en
 * claro, un rastro de puntos y una raya; en oscuro, tres rayas discontinuas
 * como la línea de eje. `x0` y `ancho` la sitúan a la izquierda de cada
 * vehículo; `centro` es la altura de la raya del medio.
 */
function Estelas({
  x0,
  ancho,
  punteada,
  centro,
}: {
  x0: number;
  ancho: number;
  punteada: [number, number];
  centro: number;
}) {
  const [desde, hasta] = punteada;
  return (
    <>
      <g className="auto-estela c-claro">
        <path
          d={`M${x0} ${desde}C${x0 + 10} ${desde} ${x0 + 14} ${hasta + 4} ${x0 + ancho + 3} ${hasta}`}
          strokeWidth="3.2"
          strokeDasharray="0.1 6.5"
          strokeLinecap="round"
        />
        <path d={`M${x0 + 4} ${centro - 2}h${ancho - 5}`} strokeWidth="3" strokeLinecap="round" opacity=".55" />
      </g>
      <g className="auto-estela c-oscuro">
        <path
          d={`M${x0} ${centro - 8}h${ancho}M${x0 + 7} ${centro}h${ancho - 7}M${x0} ${centro + 8}h${ancho}`}
          strokeWidth="3"
          strokeDasharray="8 5"
        />
      </g>
    </>
  );
}
