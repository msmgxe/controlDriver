import type { PuntoMes } from "@/lib/licencia/panel";

/**
 * Barras por mes en SVG propio, sin librerías. Cada barra lleva su `<title>`
 * (el texto al pasar el dedo o el ratón) y la gráfica entera, un resumen para
 * lectores de pantalla.
 */
export function GraficaBarras({
  titulo,
  datos,
  formato,
  clase,
}: {
  titulo: string;
  datos: PuntoMes[];
  formato: (valor: number) => string;
  clase: string;
}) {
  const W = 600;
  const H = 210;
  const izq = 8;
  const der = 8;
  const arriba = 24;
  const abajo = 26;
  const alto = H - arriba - abajo;
  const maximo = Math.max(1, ...datos.map((d) => d.valor));
  const paso = (W - izq - der) / datos.length;
  const ancho = paso * 0.64;
  const resumen = datos.map((d) => `${d.mes}: ${formato(d.valor)}`).join(", ");

  return (
    <section className="tarjeta lic-grafica">
      <h3 className="mb-2 text-base font-semibold">{titulo}</h3>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${titulo}. ${resumen}`}>
        <line className="lic-guia" x1={izq} x2={W - der} y1={arriba} y2={arriba} />
        <line className="lic-guia" x1={izq} x2={W - der} y1={arriba + alto / 2} y2={arriba + alto / 2} />
        <line className="lic-eje" x1={izq} x2={W - der} y1={arriba + alto} y2={arriba + alto} />
        {datos.map((d, i) => {
          const h = (d.valor / maximo) * alto;
          const x = izq + i * paso + (paso - ancho) / 2;
          const y = arriba + alto - h;
          const actual = i === datos.length - 1;
          return (
            <g key={d.mes}>
              <title>{`${d.mes}: ${formato(d.valor)}`}</title>
              {d.valor > 0 && (
                <rect className={clase} data-actual={actual ? "1" : "0"} x={x} y={y} width={ancho} height={Math.max(h, 2)} rx={4} />
              )}
              {d.valor > 0 && (
                <text className="lic-svg-v" x={x + ancho / 2} y={y - 5} textAnchor="middle">
                  {formato(d.valor)}
                </text>
              )}
              <text className="lic-svg-t" x={x + ancho / 2} y={H - 8} textAnchor="middle">
                {d.corto}
              </text>
            </g>
          );
        })}
      </svg>
    </section>
  );
}

/** Las dos gráficas del panel, lado a lado. */
export function Graficas({ ingresos, activos }: { ingresos: PuntoMes[]; activos: PuntoMes[] }) {
  return (
    <div className="lic-graficas">
      <GraficaBarras
        titulo="Ingresos por mes (últimos 12)"
        datos={ingresos}
        formato={(c) => `S/ ${Math.round(c / 100)}`}
        clase="lic-barra"
      />
      <GraficaBarras
        titulo="Usuarios activos por mes"
        datos={activos}
        formato={(n) => String(n)}
        clase="lic-barra-activos"
      />
    </div>
  );
}
