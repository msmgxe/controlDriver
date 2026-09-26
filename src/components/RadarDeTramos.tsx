import { rumbo, type Punto } from "@/lib/geo/distancia";
import type { ReglaPago } from "@/lib/pagos/reglas";

/**
 * Los tramos de la tarifa como círculos alrededor de la tienda, y el cliente
 * como un punto donde le toca.
 *
 * No es un mapa —no trae calles ni hace falta clave ni internet—: es lo que
 * importa para saber en qué tramo cae un pedido. La tienda va al centro; cada
 * círculo es el límite de un tramo («3 km», «8 km»…); el cliente, un punto en
 * la dirección en que está y a la distancia que le toca. Arriba es el norte.
 *
 * Para ver las calles de verdad, la pantalla ofrece abrir el punto en Maps.
 */
export function RadarDeTramos({
  regla,
  km,
  tienda,
  cliente,
}: {
  regla: ReglaPago;
  /** La distancia usada para el tramo (puede ser por calles). */
  km: number | null;
  tienda: Punto | null;
  cliente: Punto | null;
}) {
  const T = 260;
  const C = T / 2;
  const RADIO = 108;

  // Los tramos con techo razonable; una tarifa única llega a 9999 km y no se dibuja.
  const anillos = regla.tramos.map((t) => t.hasta).filter((h) => h > 0 && h <= 60);
  const tope = Math.max(...anillos, 1, km ?? 0) * 1.08;
  const escala = RADIO / tope;

  let punto: { x: number; y: number } | null = null;
  if (km !== null && tienda && cliente) {
    const g = (rumbo(tienda, cliente) * Math.PI) / 180;
    // La línea recta se dibuja a la distancia usada: si se midió por calles,
    // el punto queda algo más lejos que en el mapa, y eso es lo que decide el tramo.
    punto = { x: C + Math.sin(g) * km * escala, y: C - Math.cos(g) * km * escala };
  }

  const tramoDelPunto = km === null ? null : regla.tramos.find((t) => km <= t.hasta)?.id;

  return (
    <svg
      viewBox={`0 0 ${T} ${T}`}
      role="img"
      aria-label={
        km === null
          ? "Los tramos alrededor de la tienda. El cliente todavía no está ubicado."
          : `El cliente está a ${km.toFixed(1)} kilómetros de la tienda${tramoDelPunto ? `, en el tramo ${tramoDelPunto}` : ", fuera de la tarifa"}.`
      }
      className="mx-auto aspect-square h-auto w-full max-w-[300px] shrink-0 rounded-card border border-linea bg-sup-2"
    >
      {anillos.map((h, i) => (
        <g key={h}>
          <circle
            cx={C}
            cy={C}
            r={h * escala}
            fill="none"
            strokeDasharray="4 4"
            className={`stroke-acento ${i < 3 ? "opacity-60" : "opacity-30"}`}
            strokeWidth={1.4}
          />
          {(i === 0 || i === anillos.length - 1 || h === 8) && (
            <text
              x={C + h * escala * 0.707 + 3}
              y={C - h * escala * 0.707 - 1}
              className="fill-acento-tinta font-mono text-[9px] font-bold"
              stroke="var(--sup-2)"
              strokeWidth={3}
              paintOrder="stroke"
            >
              {h} km
            </text>
          )}
        </g>
      ))}

      <text x={C} y={12} textAnchor="middle" className="fill-tinta-3 text-[9px] font-bold">
        N
      </text>

      {punto && (
        <>
          <line x1={C} y1={C} x2={punto.x} y2={punto.y} className="stroke-tinta" strokeWidth={1.6} strokeDasharray="5 4" />
          <circle cx={punto.x} cy={punto.y} r={8} className="fill-acento stroke-sup" strokeWidth={2.5} />
          <circle cx={punto.x} cy={punto.y} r={2.5} className="fill-acento-texto" />
        </>
      )}

      {/* La tienda, al centro. */}
      <circle cx={C} cy={C} r={9} className="fill-acento-2 stroke-tinta" strokeWidth={1.8} />
      <text x={C} y={C + 3.5} textAnchor="middle" className="fill-acento-2-tinta text-[10px] font-extrabold">
        T
      </text>
    </svg>
  );
}
