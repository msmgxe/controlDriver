"use client";

import { useState } from "react";

import { guardarBloqueApoyoTramos } from "@/app/(app)/jornada/acciones";
import { Campo } from "@/components/FormularioApoyoHora";
import { Equis } from "@/components/iconos";
import { Aviso } from "@/components/ui";
import { horaEnLima, type FechaISO } from "@/lib/fechas";
import type { FuenteDeKm, Tienda } from "@/lib/db/tipos";

const TRAMOS = [1, 2, 3, 4, 5, 6] as const;

interface PedidoLocal {
  tramo: number;
  km: string;
}

export function FormularioApoyoTramos({
  fecha,
  tiendas,
  alGuardar,
}: {
  fecha: FechaISO;
  tiendas: Tienda[];
  alGuardar: () => void;
}) {
  const [tiendaId, setTiendaId] = useState<string | null>(null);
  const [horaInicio] = useState(horaEnLima());
  const [horaFin, setHoraFin] = useState("");
  const [pedidos, setPedidos] = useState<PedidoLocal[]>([{ tramo: 1, km: "" }]);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const puedeGuardar = tiendaId !== null && pedidos.length > 0 && !guardando;

  function agregarPedido() {
    setPedidos((p) => [...p, { tramo: 1, km: "" }]);
  }

  function quitarPedido(i: number) {
    setPedidos((p) => p.filter((_, j) => j !== i));
  }

  function cambiarTramo(i: number, tramo: number) {
    setPedidos((p) => p.map((x, j) => (j === i ? { ...x, tramo } : x)));
  }

  function cambiarKm(i: number, km: string) {
    setPedidos((p) => p.map((x, j) => (j === i ? { ...x, km } : x)));
  }

  async function guardar() {
    if (!tiendaId) return;
    setGuardando(true);
    setError(null);
    const r = await guardarBloqueApoyoTramos({
      fecha,
      horaInicio,
      horaFin: horaFin || null,
      tiendaId,
      pedidos: pedidos.map((p) => ({
        km: p.km ? Number(p.km.replace(",", ".")) : null,
        kmFuente: p.km ? ("manual" as FuenteDeKm) : null,
        tramo: p.tramo,
      })),
      notas: null,
    });
    setGuardando(false);
    if (!r.ok) {
      setError(r.error);
      return;
    }
    alGuardar();
  }

  return (
    <>
      <div className="flex flex-1 flex-col gap-4 overflow-y-auto px-4 pb-4">
        {error && <Aviso tono="mal" titulo="No se pudo guardar">{error}</Aviso>}

        <Campo etiqueta="Tienda a la que apoyaste">
          <div className="flex flex-wrap gap-2">
            {tiendas.map((t) => (
              <button
                key={t.id}
                type="button"
                aria-pressed={t.id === tiendaId}
                onClick={() => setTiendaId(t.id)}
                className={`min-h-10 rounded-chip border-2 px-3 text-sm font-semibold ${
                  t.id === tiendaId
                    ? "border-acento bg-acento-suave text-acento-tinta"
                    : "border-linea bg-sup text-tinta-2 hover:bg-sup-2"
                }`}
              >
                {t.nombre}
              </button>
            ))}
          </div>
          {tiendas.length === 0 && (
            <p className="text-xs text-tinta-3">No tienes otras tiendas guardadas todavía —agrégalas en Ajustes.</p>
          )}
        </Campo>

        <Campo etiqueta="Hasta qué hora (opcional)">
          <input
            type="time"
            value={horaFin}
            onChange={(e) => setHoraFin(e.target.value)}
            className="min-h-11 w-32 rounded-btn border border-linea-fuerte bg-sup px-3 text-base"
          />
        </Campo>

        <div className="flex flex-col gap-2">
          <span className="text-sm font-semibold">Pedidos cubiertos</span>
          {pedidos.map((p, i) => (
            <div key={i} className="tarjeta flex items-center gap-2 !p-3">
              <div className="flex flex-1 flex-wrap gap-1.5">
                {TRAMOS.map((t) => (
                  <button
                    key={t}
                    type="button"
                    aria-pressed={p.tramo === t}
                    onClick={() => cambiarTramo(i, t)}
                    className={`min-h-8 min-w-8 rounded-chip border-2 px-2 text-xs font-bold ${
                      p.tramo === t
                        ? "border-acento bg-acento-suave text-acento-tinta"
                        : "border-linea bg-sup text-tinta-2"
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
              <input
                inputMode="decimal"
                value={p.km}
                onChange={(e) => cambiarKm(i, e.target.value)}
                placeholder="km"
                className="min-h-9 w-16 rounded-btn border border-linea-fuerte bg-sup px-2 text-center text-sm"
              />
              {pedidos.length > 1 && (
                <button
                  type="button"
                  aria-label="Quitar este pedido"
                  onClick={() => quitarPedido(i)}
                  className="grid size-8 shrink-0 place-items-center rounded-full text-tinta-3 hover:bg-sup-2"
                >
                  <Equis className="size-4" />
                </button>
              )}
            </div>
          ))}
          <button type="button" className="boton-sec self-start !min-h-9 !px-3 !text-sm" onClick={agregarPedido}>
            + Agregar pedido
          </button>
          <p className="text-xs text-tinta-3">El tramo decide el monto, con la tarifa de esa tienda. El km es solo para tu registro.</p>
        </div>
      </div>

      <div className="flex flex-col gap-2 border-t border-linea px-4 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom,0px))]">
        <button type="button" className="boton-principal !min-h-11 !text-base" disabled={!puedeGuardar} onClick={() => void guardar()}>
          {guardando ? "Guardando…" : "Guardar apoyo"}
        </button>
      </div>
    </>
  );
}
