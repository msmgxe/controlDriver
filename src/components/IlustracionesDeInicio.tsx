/**
 * Las ilustraciones pequeñas de los estados vacíos de Inicio. Son SVG de trazo
 * grueso y colores de la cara activa (`--acento`, `--sup`…), así que se leen en
 * claro y en oscuro. Las partes que se mecen usan `.bob-v2`.
 */
export function IlustracionDelDia({ tipo }: { tipo: "vacio" | "luna" | "futuro" | "nube" }) {
  if (tipo === "luna") {
    return (
      <svg viewBox="0 0 160 110" width="160" height="110" aria-hidden>
        <circle cx="80" cy="55" r="44" fill="var(--sup-2)" />
        <path
          className="bob-v2"
          d="M104 70A32 32 0 0166 24a32 32 0 1038 46z"
          fill="var(--descanso)"
        />
        <path d="M28 28l.01 0M130 22l.01 0M138 74l.01 0M22 78l.01 0" stroke="var(--tinta-3)" strokeWidth="6" strokeLinecap="round" />
      </svg>
    );
  }
  if (tipo === "futuro") {
    return (
      <svg viewBox="0 0 160 110" width="160" height="110" aria-hidden>
        <rect x="32" y="18" width="96" height="80" rx="12" fill="var(--sup)" stroke="var(--linea-fuerte)" strokeWidth="3" />
        <path d="M32 42h96" stroke="var(--linea-fuerte)" strokeWidth="3" />
        <path d="M54 12v14M106 12v14" stroke="var(--tinta-3)" strokeWidth="5" strokeLinecap="round" />
        <circle cx="80" cy="70" r="17" fill="var(--acento-suave)" />
        <path className="bob-v2" d="M80 59v11l7 4" stroke="var(--acento)" strokeWidth="4" fill="none" strokeLinecap="round" />
      </svg>
    );
  }
  if (tipo === "nube") {
    return (
      <svg viewBox="0 0 64 48" width="56" height="42" aria-hidden>
        <path
          d="M16 38a10 10 0 010-20 14 14 0 0127-3 9 9 0 011 23z"
          fill="var(--acento-suave)"
          stroke="var(--acento)"
          strokeWidth="3"
          strokeLinejoin="round"
        />
        <path
          className="bob-v2"
          d="M32 33V21M27 26l5-5 5 5"
          stroke="var(--acento)"
          strokeWidth="3"
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 220 112" width="220" height="112" aria-hidden>
      <circle cx="176" cy="26" r="15" fill="var(--descanso)" />
      <rect x="30" y="12" width="56" height="70" rx="9" fill="var(--sup)" stroke="var(--linea-fuerte)" strokeWidth="3" />
      <rect x="48" y="7" width="20" height="10" rx="4" fill="var(--acento)" />
      <path d="M42 36h32M42 48h32M42 60h20" stroke="var(--linea-fuerte)" strokeWidth="4" strokeLinecap="round" />
      <path d="M10 98h200" stroke="var(--linea-fuerte)" strokeWidth="7" strokeLinecap="round" />
      <path d="M22 98h16M58 98h16M94 98h16M130 98h16M166 98h16" stroke="var(--sup)" strokeWidth="3" strokeLinecap="round" />
      <g className="bob-v2" transform="translate(104 52)">
        <path
          d="M3 34l4-13c.8-2.4 3-4 5.6-4h28.8c2.6 0 4.8 1.6 5.6 4l4 13v8c0 1.4-1 2.6-2.6 2.6H41v-4H16v4H5.6C4 44.6 3 43.4 3 42z"
          fill="#ffc800"
        />
        <path
          d="M3 34l4-13c.8-2.4 3-4 5.6-4h28.8c2.6 0 4.8 1.6 5.6 4l4 13M3 34h48"
          fill="none"
          stroke="#0a2260"
          strokeWidth="2.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <circle cx="16" cy="38" r="4" fill="#0a2260" />
        <circle cx="40" cy="38" r="4" fill="#0a2260" />
      </g>
    </svg>
  );
}
