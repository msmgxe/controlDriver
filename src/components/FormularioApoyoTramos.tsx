"use client";

import { useState, type CSSProperties } from "react";

import { guardarBloqueApoyoTramos } from "@/app/(app)/jornada/acciones";
import { Campo } from "@/components/FormularioApoyoHora";
import { BotonDeAccion } from "@/components/Acciones";
import { DialogoConfirmar } from "@/components/DialogoConfirmar";
import { Check, Equis, Suma, Tienda as IconoTienda } from "@/components/iconos";
import { Aviso } from "@/components/ui";
import { horaEnLima, type FechaISO } from "@/lib/fechas";
import type { BloqueExtraFila, FuenteDeKm, Tienda } from "@/lib/db/tipos";

const TRAMOS = [1, 2, 3, 4, 5, 6] as const;

interface PedidoLocal {
  tramo: number;
  km: string;
}

export function FormularioApoyoTramos({
  fecha,
  tiendas,
  inicial,
  alGuardar,
}: {
  fecha: FechaISO;
  tiendas: Tienda[];
  /** Si se corrige un apoyo ya guardado: sus datos de partida. */
  inicial?: Extract<BloqueExtraFila, { tipo: "apoyo_tramos" }>;
  alGuardar: () => void;
}) {
  const [tiendaId, setTiendaId] = useState<string | null>(inicial?.tiendaId ?? null);
  const [horaInicio] = useState(inicial?.horaInicio ?? horaEnLima());
  const [horaFin, setHoraFin] = useState(inicial?.horaFin ?? "");
  const [pedidos, setPedidos] = useState<PedidoLocal[]>(
    inicial && inicial.pedidos.length > 0
      ? inicial.pedidos.map((p) => ({ tramo: p.tramo, km: p.km !== null ? String(p.km) : "" }))
      : [{ tramo: 1, km: "" }],
  );
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [quitando, setQuitando] = useState<number | null>(null);

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

        <div className="flex flex-col gap-1.5">
          <span className="text-sm font-semibold">Tienda a la que apoyaste</span>
          <div className="com-tipos">
            {tiendas.map((t) => (
              <button
                key={t.id}
                type="button"
                role="radio"
                aria-checked={t.id === tiendaId}
                onClick={() => setTiendaId(t.id)}
                className="com-tipo"
                style={{ "--c": "var(--c-apoyo)" } as CSSProperties}
              >
                {t.id === tiendaId ? <Check className="size-4" /> : <IconoTienda className="size-4" />}
                {t.nombre}
              </button>
            ))}
          </div>
          {tiendas.length === 0 && (
            <p className="text-xs text-tinta-3">No tienes otras tiendas guardadas todavía —agrégalas en Ajustes.</p>
          )}
        </div>

        <Campo etiqueta="Hasta qué hora (opcional)">
          <input
            type="time"
            value={horaFin}
            onChange={(e) => setHoraFin(e.target.value)}
            className="min-h-11 w-32 rounded-btn border border-linea-fuerte bg-sup px-3 text-base"
          />
        </Campo>

        <div className="flex flex-col gap-2">
          <span className="text-sm font-semibold">Pedidos cubiertos · toca el tramo de cada uno</span>
          {pedidos.map((p, i) => (
            <div key={i} className="com-ped rise-v2">
              <span className="com-ped__n">{i + 1}</span>
              <div className="flex flex-1 flex-wrap gap-1.5" role="group" aria-label={`Tramo del pedido ${i + 1}`}>
                {TRAMOS.map((t) => (
                  <button key={t} type="button" aria-pressed={p.tramo === t} onClick={() => cambiarTramo(i, t)} className="com-tramo">
                    {t}
                  </button>
                ))}
              </div>
              <input
                inputMode="decimal"
                value={p.km}
                onChange={(e) => cambiarKm(i, e.target.value)}
                placeholder="km"
                aria-label="Kilómetros"
                className="min-h-11 w-16 rounded-btn border border-linea-fuerte bg-sup px-2 text-center text-sm"
              />
              {pedidos.length > 1 && (
                <button
                  type="button"
                  aria-label="Quitar este pedido"
                  onClick={() => setQuitando(i)}
                  className="grid size-11 shrink-0 place-items-center rounded-btn bg-mal-suave text-mal"
                >
                  <Equis className="size-4" />
                </button>
              )}
            </div>
          ))}
          <button type="button" className="boton-sec self-start" onClick={agregarPedido}>
            <Suma className="size-4" />
            Agregar pedido
          </button>
          <p className="text-xs text-tinta-3">El tramo decide el monto, con la tarifa de esa tienda. El km es solo para tu registro.</p>
        </div>
      </div>

      {quitando !== null && (
        <DialogoConfirmar
          titulo={`¿Quitar el pedido ${quitando + 1}?`}
          texto="Deja de contarse en este apoyo cuando lo guardes."
          confirmar="Sí, quitar el pedido"
          alCancelar={() => setQuitando(null)}
          alConfirmar={() => {
            quitarPedido(quitando);
            setQuitando(null);
          }}
        />
      )}

      <div className="flex flex-col gap-2 border-t border-linea px-4 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom,0px))]">
        <BotonDeAccion k="apoyo" disabled={!puedeGuardar} onClick={() => void guardar()}>
          <Check className="size-5" />
          {guardando ? "Guardando…" : inicial ? "Guardar cambios" : "Guardar apoyo"}
        </BotonDeAccion>
      </div>
    </>
  );
}
