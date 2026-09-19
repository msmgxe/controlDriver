"use client";

import { useState } from "react";

import { Check } from "@/components/iconos";
import { comprimir } from "@/lib/carga";
import { agregarPedidoManual } from "@/lib/db/sqlite/jornadas";
import { guardarPrueba } from "@/lib/db/sqlite/pruebas";
import type { FechaISO } from "@/lib/fechas";
import { RE_CODIGO_PEDIDO } from "@/lib/extraccion/esquema";
import { formatearSoles, pagoDelTramo, type ReglaPago } from "@/lib/pagos/reglas";

const ESTADOS = ["Entregado", "Entrega parcial", "No entregado"] as const;

/**
 * Añadir un pedido a mano.
 *
 * Hace falta más de lo que parece. Una captura puede salir cortada, un pedido
 * puede no aparecer en ninguna, o la app de reparto puede haber fallado ese
 * día. Sin esta salida, el repartidor tendría que elegir entre guardar mal o
 * no guardar, y perdería el pago de un trabajo que sí hizo.
 *
 * La foto es opcional y sirve para lo mismo que las capturas: si la tienda
 * discute ese pedido, la foto lo respalda. Se guarda en el almacenamiento
 * privado de la aplicación, no en la galería.
 */
export function PedidoManual({
  fecha,
  regla,
  rutas,
  alAgregar,
}: {
  fecha: FechaISO;
  regla: ReglaPago;
  /** Números de ruta del día, para poder elegir a cuál pertenece. */
  rutas: number[];
  alAgregar: () => void;
}) {
  const [abierto, setAbierto] = useState(false);
  const [codigo, setCodigo] = useState("");
  const [ruta, setRuta] = useState<string>("");
  const [estado, setEstado] = useState<string>("Entregado");
  const [tramo, setTramo] = useState(1);
  const [foto, setFoto] = useState<File | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const montoCentimos = pagoDelTramo(regla, tramo) ?? 1000;
  const codigoLimpio = codigo.trim().toLowerCase();
  const codigoValido = RE_CODIGO_PEDIDO.test(codigoLimpio);

  async function guardar() {
    if (!codigoValido) {
      setError("El código debe tener la forma v12238726wofp-01.");
      return;
    }
    setGuardando(true);
    setError(null);

    try {
      const { ordenId } = await agregarPedidoManual(fecha, {
        codigo: codigoLimpio,
        ruta: ruta === "" ? null : Number(ruta),
        estado,
        tramo,
        km: null,
        montoCentimos,
      });

      if (foto) {
        // Se comprime igual que las capturas: quita el EXIF —la ubicación
        // incluida— y evita guardar doce megas por una foto de un recibo.
        await guardarPrueba(fecha, await comprimir(foto), ordenId);
      }

      setCodigo("");
      setFoto(null);
      setTramo(1);
      setAbierto(false);
      alAgregar();
    } catch (fallo) {
      setError(fallo instanceof Error ? fallo.message : "No se pudo añadir el pedido.");
    } finally {
      setGuardando(false);
    }
  }

  if (!abierto) {
    return (
      <button type="button" onClick={() => setAbierto(true)} className="boton-secundario self-start">
        Añadir un pedido a mano
      </button>
    );
  }

  return (
    <div className="flex flex-col gap-3 rounded-card border border-linea-fuerte bg-sup p-4">
      <h4 className="font-semibold">Pedido a mano</h4>

      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-semibold">Código</span>
        <input
          value={codigo}
          onChange={(e) => {
            setCodigo(e.target.value);
            setError(null);
          }}
          placeholder="v12238726wofp-01"
          inputMode="text"
          autoCapitalize="off"
          autoCorrect="off"
          className="min-h-[52px] rounded-btn border border-linea-fuerte bg-sup px-3 font-mono text-base"
        />
        {codigo !== "" && !codigoValido && (
          <span className="text-xs text-mal">Debe tener la forma v12238726wofp-01.</span>
        )}
      </label>

      <div className="grid grid-cols-2 gap-3">
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-semibold">Ruta</span>
          <select
            value={ruta}
            onChange={(e) => setRuta(e.target.value)}
            className="min-h-[52px] rounded-btn border border-linea-fuerte bg-sup px-3 text-base"
          >
            <option value="">Sin ruta</option>
            {rutas.map((n) => (
              <option key={n} value={n}>
                Ruta {n}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-semibold">Estado</span>
          <select
            value={estado}
            onChange={(e) => setEstado(e.target.value)}
            className="min-h-[52px] rounded-btn border border-linea-fuerte bg-sup px-3 text-base"
          >
            {ESTADOS.map((e) => (
              <option key={e} value={e}>
                {e}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="flex flex-col gap-1.5">
        <span className="text-sm font-semibold">Tramo · {formatearSoles(montoCentimos)}</span>
        <div className="flex flex-wrap gap-2">
          {regla.tramos.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTramo(t.id)}
              aria-pressed={tramo === t.id}
              className={`min-h-11 rounded-btn border px-3 text-sm font-semibold ${
                tramo === t.id
                  ? "border-acento bg-acento text-acento-texto"
                  : "border-linea bg-sup-2 text-tinta-2"
              }`}
            >
              T{t.id}
            </button>
          ))}
        </div>
      </div>

      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-semibold">Foto de respaldo (opcional)</span>
        <input
          type="file"
          accept="image/*"
          capture="environment"
          onChange={(e) => setFoto(e.target.files?.[0] ?? null)}
          className="text-sm"
        />
        {foto && <span className="text-xs text-tinta-3">{foto.name}</span>}
      </label>

      {error && <p className="rounded-btn bg-mal-suave px-3 py-2 text-sm text-mal">{error}</p>}

      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => void guardar()}
          disabled={guardando || !codigoValido}
          className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-btn bg-acento px-4 text-sm font-semibold text-acento-texto disabled:opacity-50"
        >
          <Check className="size-4" />
          {guardando ? "Guardando…" : "Añadir"}
        </button>
        <button
          type="button"
          onClick={() => setAbierto(false)}
          className="boton-secundario"
        >
          Cancelar
        </button>
      </div>
    </div>
  );
}
