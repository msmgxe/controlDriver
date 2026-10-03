"use client";

import { useState } from "react";

import { Equis, Reloj, Taxi, Tienda } from "@/components/iconos";
import type { FechaISO } from "@/lib/fechas";
import { eliminarBloque } from "@/app/(app)/jornada/acciones";
import type { BloqueExtraFila } from "@/lib/db/tipos";
import { formatearSoles } from "@/lib/pagos/reglas";

const ICONO = { apoyo_hora: Reloj, apoyo_tramos: Tienda, taxi: Taxi } as const;
const FONDO = {
  apoyo_hora: "bg-[#fff4d6] text-[#8a6200]",
  apoyo_tramos: "bg-acento-suave text-acento-tinta",
  taxi: "bg-[#ece7ff] text-[#5b2bd6]",
} as const;

function tituloYDetalle(b: BloqueExtraFila): { titulo: string; detalle: string } {
  if (b.tipo === "apoyo_hora") {
    return { titulo: b.tiendaNombre || "Apoyo por hora", detalle: `${b.horas} h${b.motivo ? ` · ${b.motivo}` : ""}` };
  }
  if (b.tipo === "apoyo_tramos") {
    return { titulo: b.tiendaNombre || "Apoyo por tramos", detalle: `${b.pedidos.length} pedido${b.pedidos.length === 1 ? "" : "s"}` };
  }
  return { titulo: "Taxi libre", detalle: b.km !== null ? `${b.km} km` : "Carrera suelta" };
}

export function TarjetaBloqueExtra({
  bloque,
  fecha,
  editable,
  alCambiar,
}: {
  bloque: BloqueExtraFila;
  fecha: FechaISO;
  editable: boolean;
  alCambiar: () => void;
}) {
  const [confirmando, setConfirmando] = useState(false);
  const [borrando, setBorrando] = useState(false);
  const Icono = ICONO[bloque.tipo];
  const { titulo, detalle } = tituloYDetalle(bloque);

  async function borrar() {
    setBorrando(true);
    const r = await eliminarBloque(fecha, bloque.id);
    setBorrando(false);
    if (r.ok) alCambiar();
  }

  if (confirmando) {
    return (
      <div className="flex items-center gap-3 rounded-card border border-mal/30 bg-mal-suave px-4 py-3">
        <p className="flex-1 text-sm text-mal">¿Quitar {titulo.toLowerCase()}?</p>
        <button type="button" className="boton-sec !min-h-9 !px-3 !text-xs" disabled={borrando} onClick={() => setConfirmando(false)}>
          No
        </button>
        <button
          type="button"
          className="min-h-9 rounded-chip bg-mal px-3 text-xs font-bold text-white disabled:opacity-60"
          disabled={borrando}
          onClick={() => void borrar()}
        >
          {borrando ? "Quitando…" : "Sí, quitar"}
        </button>
      </div>
    );
  }

  return (
    <div className="tarjeta flex items-center gap-3">
      <span className={`grid size-10 shrink-0 place-items-center rounded-full ${FONDO[bloque.tipo]}`}>
        <Icono className="size-[19px]" />
      </span>
      <div className="min-w-0 flex-1">
        <b className="block truncate text-sm font-bold">{titulo}</b>
        <span className="block truncate text-xs text-tinta-2">
          {bloque.horaInicio ? `${bloque.horaInicio} · ` : ""}
          {detalle}
        </span>
      </div>
      <b className="shrink-0 font-mono text-sm tabular-nums">{formatearSoles(bloque.montoCentimos)}</b>
      {editable && (
        <button
          type="button"
          aria-label={`Quitar ${titulo}`}
          className="grid size-8 shrink-0 place-items-center rounded-full text-tinta-3 hover:bg-sup-2"
          onClick={() => setConfirmando(true)}
        >
          <Equis className="size-4" />
        </button>
      )}
    </div>
  );
}
