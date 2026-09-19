import { Alerta, Check, Equis, Medio } from "@/components/iconos";
import { formatearFecha, nombreDelDia, type FechaISO } from "@/lib/fechas";
import { formatearSoles } from "@/lib/pagos/reglas";

/**
 * Piezas de interfaz que se repiten por toda la app.
 *
 * Son componentes de servidor: no llevan estado. Lo interactivo vive en los
 * componentes marcados con "use client".
 */

/* --------------------------------------------------------------------------
 * Avisos (§6): bloqueos y advertencias en lenguaje claro
 * ------------------------------------------------------------------------ */

export function Aviso({
  tono,
  titulo,
  children,
}: {
  tono: "bien" | "atento" | "mal";
  titulo: string;
  children?: React.ReactNode;
}) {
  const estilos = {
    bien: "bg-bien-suave text-bien",
    atento: "bg-aviso-suave text-aviso",
    mal: "bg-mal-suave text-mal",
  }[tono];
  const Icono = tono === "bien" ? Check : Alerta;

  return (
    <div className={`flex gap-3 rounded-btn px-4 py-3 text-sm ${estilos}`}>
      <Icono className="mt-0.5 size-[18px] shrink-0" />
      <div>
        <strong className="block font-bold">{titulo}</strong>
        {children && <div className="opacity-95">{children}</div>}
      </div>
    </div>
  );
}

/* --------------------------------------------------------------------------
 * Estado de un pedido.
 * §9: color Y icono Y etiqueta. Nunca color solo — verde/ámbar/rojo no se
 * distinguen con daltonismo, así que el icono y el texto son obligatorios.
 * ------------------------------------------------------------------------ */

export function EstadoPedido({ estado }: { estado: string }) {
  const mapa: Record<string, { clase: string; Icono: typeof Check }> = {
    /* Sin rojo: entregado o no, el pedido se paga igual. El rojo lo hacía
       parecer un error que había que arreglar, y no lo es. */
    Entregado: { clase: "text-bien", Icono: Check },
    "Entrega parcial": { clase: "text-tinta-2", Icono: Medio },
    "No entregado": { clase: "text-tinta-2", Icono: Equis },
  };
  const { clase, Icono } = mapa[estado] ?? { clase: "text-tinta-2", Icono: Medio };

  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-semibold ${clase}`}>
      <Icono className="size-[13px]" />
      {estado}
    </span>
  );
}

export function ChipTramo({ tramo }: { tramo: number }) {
  const fuera = tramo > 1;
  return (
    <span
      className={`inline-flex items-center rounded-chip px-2 py-0.5 font-mono text-xs ${
        fuera
          ? "bg-acento-suave font-medium text-acento-tinta"
          : "border border-linea-fuerte text-tinta-3"
      }`}
    >
      T{tramo}
    </span>
  );
}

/* --------------------------------------------------------------------------
 * Cifras clave
 * ------------------------------------------------------------------------ */

export function Cifras({ datos }: { datos: { etiqueta: string; valor: string; pie?: string }[] }) {
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      {datos.map((d) => (
        <div
          key={d.etiqueta}
          className="flex flex-col gap-0.5 rounded-card bg-sup-2 px-4 pt-3 pb-4"
        >
          <span className="text-xs font-medium text-tinta-3">{d.etiqueta}</span>
          <span className="font-display text-[22px] leading-tight font-bold tabular-nums">
            {d.valor}
            {d.pie && <small className="ml-1 font-sans text-sm font-medium text-tinta-2">{d.pie}</small>}
          </span>
        </div>
      ))}
    </div>
  );
}

export function MontoHero({
  centimos,
  pie,
}: {
  centimos: number;
  pie: string;
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="font-display text-[44px] leading-none font-bold tracking-tight text-acento tabular-nums">
        {formatearSoles(centimos)}
      </span>
      <span className="text-sm text-tinta-2">{pie}</span>
    </div>
  );
}

/* --------------------------------------------------------------------------
 * Tira de la semana (lunes a domingo)
 * ------------------------------------------------------------------------ */

const LETRAS = ["L", "M", "X", "J", "V", "S", "D"];

export function TiraSemana({
  dias,
  hoy,
}: {
  dias: { fecha: FechaISO; cargado: boolean; pedidos: number }[];
  hoy: FechaISO;
}) {
  return (
    <div className="grid grid-cols-7 gap-1">
      {dias.map((d, i) => (
        <div
          key={d.fecha}
          title={`${nombreDelDia(d.fecha)} ${formatearFecha(d.fecha)}${
            d.cargado ? ` · ${d.pedidos} pedidos` : " · sin carga"
          }`}
          className={`flex flex-col items-center gap-1 rounded-chip py-2 text-[10px] ${
            d.fecha === hoy ? "bg-sup-2 font-bold" : ""
          } ${d.cargado ? "text-tinta" : "text-tinta-3"}`}
        >
          <span>{LETRAS[i]}</span>
          <span className="font-mono text-xs">{Number(d.fecha.slice(8, 10))}</span>
          <span
            className={`h-1 w-full rounded-full ${d.cargado ? "bg-acento" : "bg-linea"}`}
          />
        </div>
      ))}
    </div>
  );
}

/* --------------------------------------------------------------------------
 * Estado vacío
 * ------------------------------------------------------------------------ */

export function Vacio({ children }: { children: React.ReactNode }) {
  return <p className="py-10 text-center text-sm text-tinta-3">{children}</p>;
}
