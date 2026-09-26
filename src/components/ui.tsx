import { Auto } from "@/components/Auto";
import type { TipoVehiculo } from "@/lib/pagos/reglas";
import { Alerta, Check, Equis, Medio } from "@/components/iconos";

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

/* --------------------------------------------------------------------------
 * La cifra del día
 *
 * Es el «Hoy cargaste 21» de la propuesta Turbo, en los colores de la cara
 * activa: el número grande, cuánto suma, y el auto con su estela.
 * ------------------------------------------------------------------------ */

export function TarjetaDelDia({
  encabezado,
  cifra,
  pie,
  monto,
  vehiculo = "auto",
  animado = true,
}: {
  encabezado: string;
  cifra: string;
  pie: string;
  /** Lo que se cobra; sin él, no hay pastilla. */
  monto?: string;
  /** Con qué vehículo, para dibujar el que toca (ver `useVehiculo`). */
  vehiculo?: TipoVehiculo;
  animado?: boolean;
}) {
  return (
    <section className="tarjeta-dia" aria-label={`${encabezado} ${cifra} ${pie}`}>
      <p className="text-[13px] font-semibold opacity-90">{encabezado}</p>
      <p className="font-display text-[56px] leading-[0.95] font-bold tracking-tight tabular-nums">
        {cifra}
      </p>
      <p className="text-[13px] font-semibold opacity-90">{pie}</p>
      {monto && <span className="pastilla">{monto}</span>}
      <Auto
        vehiculo={vehiculo}
        sobreAcento
        animado={animado}
        className="pointer-events-none absolute -right-2 bottom-3 w-[44%] max-w-[190px] -rotate-[4deg]"
      />
    </section>
  );
}

/* --------------------------------------------------------------------------
 * Estado vacío
 * ------------------------------------------------------------------------ */

export function Vacio({ children }: { children: React.ReactNode }) {
  return <p className="py-10 text-center text-sm text-tinta-3">{children}</p>;
}
