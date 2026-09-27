/**
 * El ícono de la marca: un cuadro redondeado con un visto, un anillo y dos
 * puntos de estela. El cuadro toma el degradado de la cara activa
 * (`--acento` → `--acento-tinta`); el anillo, el segundo color de esa misma
 * cara (`--acento-2`); el visto es blanco siempre, para que se lea igual
 * sobre cualquiera.
 *
 * Vive aparte porque lo usan dos pantallas que no se montan juntas: la
 * marca de inicio (`SplashDeMarca`) y el aviso legal (`AvisoLegal`).
 */
export function IconoApp({ className }: { className?: string }) {
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
