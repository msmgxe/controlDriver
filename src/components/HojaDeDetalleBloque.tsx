"use client";

import { useState } from "react";
import { createPortal } from "react-dom";

import { eliminarBloque } from "@/app/(app)/jornada/acciones";
import { FONDO_DE_BLOQUE, ICONO_DE_BLOQUE, tituloYDetalleDeBloque } from "@/components/bloques-visual";
import { HojaDeBloqueExtraAutonoma } from "@/components/HojaDeBloqueExtra";
import { Equis } from "@/components/iconos";
import { LineaDeHorario } from "@/components/LineaDeHorario";
import { useCapa } from "@/hooks/useCapa";
import type { BloqueExtraFila } from "@/lib/db/tipos";
import { formatearFechaLarga, type FechaISO } from "@/lib/fechas";
import { formatearSoles } from "@/lib/pagos/reglas";

const FUENTE_DE_KM = {
  recta: "en línea recta",
  ruta: "por calles",
  estimado: "por calles, estimado",
  manual: "escrito a mano",
} as const;

/**
 * El detalle de un apoyo o un taxi: de dónde sale su monto, hora, kilómetros y,
 * en un apoyo por tramos, cada pedido con su tramo. Es lo que se abre al tocar
 * la tarjeta, para corroborar las cuentas.
 *
 * Desde aquí se puede **corregir** (abre la misma hoja con sus datos) o quitar.
 * En una semana ya pagada solo se mira.
 */
export function HojaDeDetalleBloque({
  bloque,
  fecha,
  editable,
  alCerrar,
  alCambiar,
}: {
  bloque: BloqueExtraFila;
  fecha: FechaISO;
  editable: boolean;
  alCerrar: () => void;
  alCambiar: () => void;
}) {
  useCapa(alCerrar);
  const [corrigiendo, setCorrigiendo] = useState(false);
  const [confirmando, setConfirmando] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const Icono = ICONO_DE_BLOQUE[bloque.tipo];
  const { titulo } = tituloYDetalleDeBloque(bloque);
  const horario = bloque.horaInicio ? `${bloque.horaInicio}${bloque.horaFin ? ` → ${bloque.horaFin}` : ""}` : null;

  async function quitar() {
    setOcupado(true);
    const r = await eliminarBloque(fecha, bloque.id);
    setOcupado(false);
    if (!r.ok) {
      setError(r.error);
      return;
    }
    alCambiar();
    alCerrar();
  }

  if (corrigiendo) {
    return createPortal(
      <HojaDeBloqueExtraAutonoma
        tipo={bloque.tipo === "taxi" ? "taxi" : "apoyo"}
        fecha={fecha}
        corregir={bloque}
        alCerrar={() => setCorrigiendo(false)}
        alGuardar={() => {
          alCambiar();
          alCerrar();
        }}
      />,
      document.body,
    );
  }

  // En un portal, fuera de la fila que la abre: una hoja `fixed` no debe depender de sus ancestros.
  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center sm:p-5"
      onClick={(e) => {
        if (e.target === e.currentTarget) alCerrar();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Detalle: ${titulo}`}
        className="flex max-h-[92dvh] w-full max-w-md flex-col gap-4 overflow-y-auto rounded-t-hoja bg-sup px-4 pt-3 pb-[calc(1rem+env(safe-area-inset-bottom,0px))] shadow-alta sm:rounded-hoja"
      >
        <span className="mx-auto h-1 w-9 shrink-0 rounded-full bg-linea-fuerte sm:hidden" />

        <div className="flex items-start gap-3">
          <span className={`grid size-12 shrink-0 place-items-center rounded-full ${FONDO_DE_BLOQUE[bloque.tipo]}`}>
            <Icono className="size-6" />
          </span>
          <div className="min-w-0 flex-1">
            <h3 className="truncate text-xl leading-tight">{titulo}</h3>
            <p className="text-xs text-tinta-3 first-letter:uppercase">{formatearFechaLarga(fecha)}</p>
          </div>
          <button
            type="button"
            onClick={alCerrar}
            aria-label="Cerrar"
            className="grid size-11 shrink-0 place-items-center rounded-full bg-sup-2"
          >
            <Equis className="size-5" />
          </button>
        </div>

        <div className="rounded-card bg-sup-2 px-4 py-3">
          <span className="rotulo">
            {bloque.tipo === "taxi" ? "Cobraste" : bloque.tipo === "apoyo_hora" ? "Apoyo por hora" : "Apoyo por tramos"}
          </span>
          <b className="block font-display text-[34px] leading-tight text-acento tabular-nums">
            {formatearSoles(bloque.montoCentimos)}
          </b>
        </div>

        {bloque.tipo !== "apoyo_tramos" && bloque.horaInicio && (
          <LineaDeHorario
            inicio={bloque.horaInicio}
            fin={bloque.horaFin}
            color={bloque.tipo === "taxi" ? "#5b2bd6" : "#c99700"}
            etiqueta={bloque.tipo === "apoyo_hora" ? `${bloque.horas} h` : undefined}
          />
        )}

        <dl className="flex flex-col">
          {horario && <Fila etiqueta="Horario" valor={horario} />}

          {bloque.tipo === "apoyo_hora" && (
            <>
              <Fila etiqueta="Horas" valor={`${bloque.horas} h`} />
              <Fila etiqueta="Tarifa por hora" valor={formatearSoles(bloque.tarifaHoraCentimos)} />
              <Fila
                etiqueta="Cuenta"
                valor={`${bloque.horas} × ${formatearSoles(bloque.tarifaHoraCentimos)} = ${formatearSoles(bloque.montoCentimos)}`}
              />
              {bloque.motivo && <Fila etiqueta="Motivo" valor={bloque.motivo} />}
            </>
          )}

          {bloque.tipo === "taxi" && (
            <>
              <Fila
                etiqueta="Distancia"
                valor={bloque.km !== null ? `${bloque.km} km${bloque.kmFuente ? ` · ${FUENTE_DE_KM[bloque.kmFuente]}` : ""}` : "—"}
              />
              <Fila etiqueta="Con GPS" valor={bloque.origen && bloque.destino ? "Inicio y fin marcados" : "No (todo a mano)"} />
            </>
          )}
        </dl>

        {bloque.tipo === "apoyo_tramos" && (
          <div className="flex flex-col gap-2">
            <span className="rotulo">Pedidos cubiertos</span>
            <div className="overflow-hidden rounded-card border border-linea">
              {bloque.pedidos.map((p, i) => (
                <div
                  key={p.id}
                  className="grid grid-cols-[28px_1fr_auto] items-center gap-2 border-b border-linea px-3 py-2.5 text-sm last:border-b-0"
                >
                  <span className="font-mono text-xs text-tinta-3">{i + 1}</span>
                  <span>
                    <b>Tramo {p.tramo}</b>
                    <span className="text-tinta-2">{p.km !== null ? ` · ${p.km} km` : ""}</span>
                  </span>
                  <b className="font-mono tabular-nums">{formatearSoles(p.montoCentimos)}</b>
                </div>
              ))}
            </div>
            <p className="text-xs text-tinta-3">
              Cada pedido se paga según su tramo, con la tarifa de esa tienda. Si uno está mal, toca «Corregir».
            </p>
          </div>
        )}

        {bloque.notas && <p className="text-sm text-tinta-2">{bloque.notas}</p>}
        {error && <p className="text-sm text-mal">{error}</p>}

        {editable ? (
          confirmando ? (
            <div className="flex items-center gap-3 rounded-card border border-mal/30 bg-mal-suave px-4 py-3">
              <p className="flex-1 text-sm text-mal">¿Quitar {titulo.toLowerCase()}?</p>
              <button type="button" className="boton-sec !min-h-9 !px-3 !text-xs" disabled={ocupado} onClick={() => setConfirmando(false)}>
                No
              </button>
              <button
                type="button"
                className="min-h-9 rounded-chip bg-mal px-3 text-xs font-bold text-white disabled:opacity-60"
                disabled={ocupado}
                onClick={() => void quitar()}
              >
                {ocupado ? "Quitando…" : "Sí, quitar"}
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              <button type="button" className="boton-principal !min-h-11 !text-base" onClick={() => setCorrigiendo(true)}>
                Corregir
              </button>
              <button type="button" className="boton-sec !min-h-11" onClick={() => setConfirmando(true)}>
                Quitar
              </button>
            </div>
          )
        ) : (
          <p className="text-xs text-tinta-3">Esta semana ya está pagada: solo se puede mirar.</p>
        )}
      </div>
    </div>,
    document.body,
  );
}

function Fila({ etiqueta, valor }: { etiqueta: string; valor: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-linea py-2 text-sm last:border-b-0">
      <dt className="text-tinta-2">{etiqueta}</dt>
      <dd className="text-right font-medium">{valor}</dd>
    </div>
  );
}
