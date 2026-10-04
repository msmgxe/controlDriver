import { useId } from "react";

import type { TipoVehiculo } from "@/lib/pagos/reglas";

/**
 * El vehículo de Control Driver: el auto o la moto de reparto, en dos acabados.
 *
 *   · **3D suave** (por defecto): con brillos, cristal, llantas con radios y
 *     sombra de contacto. Es el protagonista de la tarjeta del día, la
 *     carretera de la meta y el selector de transporte.
 *   · **Glifo** (`glifo` o `icono`): trazo uniforme de una sola tinta, con un
 *     relleno suave. Es el de la cabecera y la barra de abajo, donde manda la
 *     legibilidad a tamaño chico. Toma el color del texto que lo rodea.
 *
 * Los colores salen de la cara activa por variables CSS (ver `.veh` en
 * `globals.css`): el cuerpo es el acento, o el segundo color sobre una tarjeta
 * del color del acento (`sobreAcento`). Los cristales, las llantas y el casco
 * son neutros en todas las caras.
 *
 * El auto y la moto miran a la derecha, como avanza la carretera.
 */
export function Auto({
  vehiculo = "auto",
  className = "",
  sobreAcento = false,
  mono = false,
  animado = false,
  icono = false,
  glifo = false,
}: {
  /** Cuál de los dos vehículos dibujar. Cualquiera que no sea "moto" es el auto. */
  vehiculo?: TipoVehiculo;
  className?: string;
  /** Sobre una tarjeta del color del acento: el cuerpo toma el segundo color de la cara. */
  sobreAcento?: boolean;
  /** Apagado, en grises: el día todavía no tiene nada. */
  mono?: boolean;
  /** Entra rodando, una vez. Con «reducir movimiento» se queda quieto. */
  animado?: boolean;
  /** Para la barra de abajo: el glifo, al tamaño de los demás iconos. */
  icono?: boolean;
  /** El glifo de una sola tinta (cabecera). */
  glifo?: boolean;
}) {
  const id = useId().replace(/:/g, "");
  const esMoto = vehiculo === "moto";

  if (icono || glifo) {
    return (
      <svg
        className={`veh-glifo ${icono ? "size-7" : ""} ${className}`.trim()}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
        focusable="false"
      >
        {esMoto ? <GlifoMoto /> : <GlifoAuto />}
      </svg>
    );
  }

  const clases = [
    "veh",
    sobreAcento ? "veh--sobre-acento" : "",
    mono ? "veh--apagado" : "",
    animado ? "veh--anima" : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <svg className={clases} viewBox="0 0 160 80" aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id={`${id}gl`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fff" stopOpacity=".55" />
          <stop offset=".5" stopColor="#fff" stopOpacity=".06" />
          <stop offset="1" stopColor="#000" stopOpacity=".34" />
        </linearGradient>
        <linearGradient id={`${id}gv`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#eaf7ff" />
          <stop offset="1" stopColor="#6ea6dc" />
        </linearGradient>
        <radialGradient id={`${id}gr`} cx=".38" cy=".34" r=".85">
          <stop offset="0" stopColor="#fff" />
          <stop offset="1" stopColor="#8d96a6" />
        </radialGradient>
        <radialGradient id={`${id}gs`}>
          <stop offset="0" stopColor="#000" stopOpacity=".42" />
          <stop offset="1" stopColor="#000" stopOpacity="0" />
        </radialGradient>
        <linearGradient id={`${id}gb`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#fff" stopOpacity=".5" />
          <stop offset=".5" stopColor="#fff" stopOpacity="0" />
          <stop offset="1" stopColor="#000" stopOpacity=".3" />
        </linearGradient>
      </defs>
      <ellipse cx="82" cy="74" rx={esMoto ? 64 : 72} ry="5.5" fill={`url(#${id}gs)`} />
      <g className="veh-estela" stroke="#1c2230" strokeWidth="3" strokeLinecap="round" fill="none" opacity=".5">
        <path d="M0 34h14" />
        <path d="M-2 44h18" />
        <path d="M2 54h10" />
      </g>
      {esMoto ? <Moto id={id} /> : <Carro id={id} />}
    </svg>
  );
}

/* ----------------------------- el 3D suave ----------------------------- */

const CUERPO =
  "M10 54C10 47 13 44 20 43L38 40C44 27 55 19 71 19H98C112 19 122 28 128 40L144 44C151 46 153 50 153 57V63H10Z";
const CRISTALES = "M48 40C52 29 60 24 71 24H80V40ZM86 24H98C108 24 115 30 120 40H86Z";

function Llanta({ id, x, y, r }: { id: string; x: number; y: number; r: number }) {
  return (
    <g>
      <circle cx={x} cy={y} r={r + 2.6} fill="#141824" />
      <circle cx={x} cy={y} r={r} fill="#262c3a" />
      <g className="veh-gira">
        <circle cx={x} cy={y} r={r * 0.62} fill={`url(#${id}gr)`} />
        <path
          d={`M${x} ${y - r * 0.55}V${y + r * 0.55}M${x - r * 0.55} ${y}H${x + r * 0.55}M${x - r * 0.39} ${y - r * 0.39}L${x + r * 0.39} ${y + r * 0.39}M${x + r * 0.39} ${y - r * 0.39}L${x - r * 0.39} ${y + r * 0.39}`}
          stroke="#8d96a6"
          strokeWidth="1.4"
          strokeLinecap="round"
        />
      </g>
      <circle cx={x} cy={y} r="2.4" fill="#5a6372" />
    </g>
  );
}

function Carro({ id }: { id: string }) {
  return (
    <>
      <g className="veh-bota">
        <path d={CUERPO} fill="var(--v1)" />
        <path d={CUERPO} fill={`url(#${id}gl)`} />
        <path d="M52 31C60 22 72 20 88 20" stroke="#fff" strokeOpacity=".55" strokeWidth="2.2" strokeLinecap="round" fill="none" />
        <path d={CRISTALES} fill={`url(#${id}gv)`} />
        <path d="M83 24V45" stroke="#000" strokeOpacity=".2" strokeWidth="1.6" />
        <rect x="88" y="42" width="9" height="2.6" rx="1.3" fill="#000" opacity=".25" />
        <path d="M146 46L153 48V53H147Z" fill="#fff6c8" />
        <ellipse cx="152" cy="50" rx="7" ry="4" fill="#fff6c8" opacity=".45" />
        <rect x="9" y="47" width="5.5" height="7" rx="2" fill="#ff4d5a" />
      </g>
      <Llanta id={id} x={40} y={63} r={13} />
      <Llanta id={id} x={118} y={63} r={13} />
    </>
  );
}

function Moto({ id }: { id: string }) {
  const tapa = "M24 56C24 44 32 40 44 40H82L92 54H28Z";
  const frente = "M94 56L104 28C105 25 108 24 111 24H119L122 28L116 56Z";
  return (
    <>
      <g className="veh-bota">
        <rect x="3" y="10" width="48" height="31" rx="8" fill="var(--caja)" />
        <rect x="3" y="10" width="48" height="31" rx="8" fill={`url(#${id}gb)`} />
        <path d="M3 21H51" stroke="#000" strokeOpacity=".16" strokeWidth="3" />
        <circle cx="27" cy="31" r="5" fill="#fff" opacity=".85" />
        <path d="M24.4 31.2l1.8 1.8 3.4-3.6" stroke="var(--v1)" strokeWidth="1.8" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M66 40C72 43 82 47 93 49L97 55" stroke="#2b3550" strokeWidth="10" strokeLinecap="round" fill="none" />
        <path d={tapa} fill="var(--v1)" />
        <path d="M40 40H80L85 46H38Z" fill="#1c2230" />
        <path d={tapa} fill={`url(#${id}gl)`} />
        <path d="M64 38C62 28 66 22 74 23L86 29L108 24" stroke="#2b3550" strokeWidth="10.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
        <path d={frente} fill="var(--v1)" />
        <path d={frente} fill={`url(#${id}gl)`} />
        <rect x="85" y="52" width="14" height="5" rx="2.5" fill="#1c2230" />
        <path d="M118 30L128 58" stroke="#1c2230" strokeWidth="4.4" strokeLinecap="round" />
        <path d="M108 22H127" stroke="#1c2230" strokeWidth="4.4" strokeLinecap="round" />
        <circle cx="124" cy="35" r="4.6" fill="#fff6c8" />
        <ellipse cx="129" cy="35" rx="7" ry="4" fill="#fff6c8" opacity=".4" />
        <circle cx="76" cy="13" r="9.5" fill="var(--casco)" />
        <path d="M76 6A9.5 9.5 0 0 1 85.5 13H76Z" fill="#1c2230" />
        <path d="M69 9Q72 6 76 6" stroke="#fff" strokeOpacity=".7" strokeWidth="1.8" fill="none" strokeLinecap="round" />
      </g>
      <Llanta id={id} x={36} y={62} r={12} />
      <Llanta id={id} x={126} y={62} r={12} />
    </>
  );
}

/* ------------------------------ el glifo ------------------------------ */

function GlifoAuto() {
  return (
    <>
      <path
        d="M5 17H3a1 1 0 0 1-1-1v-4c0-.8.4-1.5 1-2l1.4-2.9C4.9 6.4 5.4 6 6 6h6c.7 0 1.3.3 1.8.7L16 10s2.7.6 4.5 1.1c.8.2 1.5 1 1.5 1.9v3a1 1 0 0 1-1 1h-2"
        fill="currentColor"
        fillOpacity=".22"
        stroke="none"
      />
      <path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2" />
      <path d="M9 17h6" />
      <path d="M6 10.5h7.2M13.8 7.2v3.3" strokeOpacity=".6" />
      <circle cx="7" cy="17" r="2" fill="var(--sup, #fff)" />
      <circle cx="17" cy="17" r="2" fill="var(--sup, #fff)" />
    </>
  );
}

function GlifoMoto() {
  return (
    <>
      <rect x="1.6" y="4.6" width="8" height="6.4" rx="1.8" fill="currentColor" fillOpacity=".22" />
      <path d="M7 13.4h5.6l2.2 3.6M9 17h5.4M14.4 17l1.5-5.4h2.3M15.9 11.6L14.6 8.6h-2.2M5.2 11v2.4" />
      <circle cx="12" cy="6.6" r="1.7" fill="currentColor" fillOpacity=".22" />
      <circle cx="5.2" cy="17" r="2.9" fill="var(--sup, #fff)" />
      <circle cx="18.8" cy="17" r="2.9" fill="var(--sup, #fff)" />
    </>
  );
}
