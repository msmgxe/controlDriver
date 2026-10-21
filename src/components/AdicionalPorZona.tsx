"use client";

import { useState } from "react";

import { guardarTarifarioDeAdicional } from "@/app/(app)/jornada/acciones";
import type { CategoriaAdicional } from "@/lib/db/tipos";
import {
  montoACentimos,
  montoDeZona,
  parsearTarifario,
  type ZonaDeTarifa,
} from "@/lib/pagos/tarifario";
import { formatearSoles } from "@/lib/pagos/reglas";

/** Una línea del reparto: en qué zona fue y cuántos pedidos. */
export interface LineaDeZona {
  zona: string;
  cantidad: string;
}

export const lineaVacia = (): LineaDeZona => ({ zona: "", cantidad: "1" });

/** Las líneas completas, con su monto: precio de la zona × pedidos. */
export function lineasConMonto(
  zonas: readonly ZonaDeTarifa[],
  lineas: readonly LineaDeZona[],
) {
  return lineas.flatMap((l) => {
    const cantidad = Number(l.cantidad);
    const monto = montoDeZona(zonas, l.zona, cantidad);
    return monto === null
      ? []
      : [{ zona: l.zona, cantidad, montoCentimos: monto }];
  });
}

/**
 * «Zonas del reparto»: por cada zona donde se entregó, la zona y cuántos
 * pedidos. El monto sale del tarifario (precio × pedidos) y se enseña, no se
 * escribe: así no hay una cuenta que equivocar con cinco pedidos y tres zonas.
 */
export function ZonasDelReparto({
  zonas,
  lineas,
  setLineas,
}: {
  zonas: readonly ZonaDeTarifa[];
  lineas: LineaDeZona[];
  setLineas: (l: LineaDeZona[]) => void;
}) {
  const completas = lineasConMonto(zonas, lineas);
  const pedidos = completas.reduce((s, l) => s + l.cantidad, 0);
  const total = completas.reduce((s, l) => s + l.montoCentimos, 0);
  const cambiar = (i: number, cambios: Partial<LineaDeZona>) =>
    setLineas(lineas.map((l, k) => (k === i ? { ...l, ...cambios } : l)));

  return (
    <div className="flex flex-col gap-2">
      <span className="text-sm font-semibold">Zonas del reparto</span>
      {lineas.map((l, i) => {
        const precio = zonas.find((z) => z.nombre === l.zona)?.montoCentimos;
        return (
          <div
            key={i}
            className="flex flex-col gap-1.5 rounded-btn border border-linea bg-sup-2/50 p-2.5"
          >
            <div className="flex items-center gap-2">
              <select
                value={l.zona}
                onChange={(e) => cambiar(i, { zona: e.target.value })}
                aria-label="Zona"
                className="min-h-11 min-w-0 flex-1 rounded-btn border border-linea-fuerte bg-sup px-2 text-base"
              >
                <option value="">Elige la zona…</option>
                {zonas.map((z) => (
                  <option key={z.nombre} value={z.nombre}>
                    {z.nombre} · {formatearSoles(z.montoCentimos)}
                  </option>
                ))}
              </select>
              {lineas.length > 1 && (
                <button
                  type="button"
                  aria-label="Quitar esta zona"
                  onClick={() => setLineas(lineas.filter((_, k) => k !== i))}
                  className="grid size-11 shrink-0 place-items-center rounded-btn text-lg text-mal"
                >
                  ✕
                </button>
              )}
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-tinta-2">Pedidos</span>
              <button
                type="button"
                aria-label="Uno menos"
                className="boton-sec !min-h-11 !w-11 !px-0"
                onClick={() =>
                  cambiar(i, {
                    cantidad: String(
                      Math.max(1, (Number(l.cantidad) || 1) - 1),
                    ),
                  })
                }
              >
                −
              </button>
              <input
                value={l.cantidad}
                onChange={(e) =>
                  cambiar(i, {
                    cantidad: e.target.value.replace(/\D/g, "").slice(0, 3),
                  })
                }
                inputMode="numeric"
                aria-label="Cuántos pedidos"
                className="min-h-11 w-16 rounded-btn border border-linea-fuerte bg-sup px-2 text-center font-mono text-base"
              />
              <button
                type="button"
                aria-label="Uno más"
                className="boton-sec !min-h-11 !w-11 !px-0"
                onClick={() =>
                  cambiar(i, {
                    cantidad: String((Number(l.cantidad) || 0) + 1),
                  })
                }
              >
                +
              </button>
              <span className="ml-auto font-mono text-sm font-semibold">
                {precio !== undefined && Number(l.cantidad) > 0
                  ? formatearSoles(precio * Number(l.cantidad))
                  : "—"}
              </span>
            </div>
          </div>
        );
      })}
      <button
        type="button"
        className="boton-sec self-start"
        onClick={() => setLineas([...lineas, lineaVacia()])}
      >
        + Otra zona
      </button>
      <p className="rounded-btn bg-acento-suave px-3 py-2 text-sm font-semibold text-acento-tinta">
        {pedidos} {pedidos === 1 ? "pedido" : "pedidos"} ·{" "}
        {formatearSoles(total)}
      </p>
    </div>
  );
}

/**
 * Las tarifas de un tipo de adicional: zonas con lo que se paga por pedido.
 * Se puede **pegar la tabla entera** (una zona por línea, o copiada de una hoja
 * de cálculo) y luego retocar fila por fila.
 */
export function EditorDeTarifario({
  tipo,
  alGuardar,
}: {
  tipo: CategoriaAdicional;
  alGuardar: () => void;
}) {
  const [filas, setFilas] = useState(() =>
    tipo.tarifario.map((z) => ({
      nombre: z.nombre,
      texto: String(z.montoCentimos / 100),
    })),
  );
  const [pegado, setPegado] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [mensaje, setMensaje] = useState<{
    tono: "bien" | "mal";
    texto: string;
  } | null>(null);

  function cargarLista() {
    const leidas = parsearTarifario(pegado);
    if (leidas.length === 0) {
      setMensaje({
        tono: "mal",
        texto:
          "No encontré zonas con monto. Pon una por línea, por ejemplo: Miraflores 8.50",
      });
      return;
    }
    // Lo pegado reemplaza lo que había con el mismo nombre y añade lo nuevo.
    const porNombre = new Map(filas.map((f) => [f.nombre.toLowerCase(), f]));
    for (const z of leidas)
      porNombre.set(z.nombre.toLowerCase(), {
        nombre: z.nombre,
        texto: String(z.montoCentimos / 100),
      });
    setFilas([...porNombre.values()]);
    setPegado("");
    setMensaje({
      tono: "bien",
      texto: `${leidas.length} zonas leídas. Revísalas y pulsa «Guardar tarifas».`,
    });
  }

  async function guardar() {
    const zonas = filas.map((f) => ({
      nombre: f.nombre.trim(),
      montoCentimos: montoACentimos(f.texto),
    }));
    if (zonas.some((z) => z.nombre.length < 2 || z.montoCentimos === null)) {
      setMensaje({
        tono: "mal",
        texto: "Cada zona necesita un nombre y un monto mayor que cero.",
      });
      return;
    }
    setGuardando(true);
    const r = await guardarTarifarioDeAdicional(tipo.id, zonas);
    setGuardando(false);
    if (!r.ok) {
      setMensaje({ tono: "mal", texto: r.error });
      return;
    }
    setMensaje({ tono: "bien", texto: "Tarifas guardadas." });
    alGuardar();
  }

  return (
    <div className="flex flex-col gap-3">
      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-semibold">Pegar la tabla de tarifas</span>
        <textarea
          value={pegado}
          onChange={(e) => setPegado(e.target.value)}
          rows={4}
          placeholder={"Miraflores 8.50\nLa Molina 9.00\nSan Borja 8.50"}
          className="rounded-btn border border-linea-fuerte bg-sup px-3 py-2 font-mono text-sm"
        />
        <span className="text-xs text-tinta-3">
          Una zona por línea, con su monto por pedido. También vale copiar la
          tabla de una hoja de cálculo.
        </span>
      </label>
      <button
        type="button"
        className="boton-sec self-start"
        disabled={!pegado.trim()}
        onClick={cargarLista}
      >
        Cargar la lista
      </button>

      {filas.length > 0 && (
        <div className="flex flex-col gap-2">
          <span className="text-sm font-semibold">
            Zonas de {tipo.nombre} ({filas.length})
          </span>
          {filas.map((f, i) => (
            <div key={i} className="flex items-center gap-2">
              <input
                value={f.nombre}
                onChange={(e) =>
                  setFilas(
                    filas.map((x, k) =>
                      k === i ? { ...x, nombre: e.target.value } : x,
                    ),
                  )
                }
                aria-label="Zona"
                maxLength={60}
                className="min-h-11 min-w-0 flex-1 rounded-btn border border-linea-fuerte bg-sup px-3 text-sm"
              />
              <div className="flex min-h-11 items-center gap-1 rounded-btn border border-linea-fuerte bg-sup px-2.5">
                <span className="text-xs text-tinta-3">S/</span>
                <input
                  value={f.texto}
                  onChange={(e) =>
                    setFilas(
                      filas.map((x, k) =>
                        k === i ? { ...x, texto: e.target.value } : x,
                      ),
                    )
                  }
                  inputMode="decimal"
                  aria-label={`Monto por pedido en ${f.nombre}`}
                  className="w-14 bg-transparent text-right font-mono text-sm outline-none"
                />
              </div>
              <button
                type="button"
                aria-label={`Quitar ${f.nombre}`}
                onClick={() => setFilas(filas.filter((_, k) => k !== i))}
                className="grid size-11 shrink-0 place-items-center rounded-btn text-lg text-mal"
              >
                ✕
              </button>
            </div>
          ))}
          <button
            type="button"
            className="boton-sec self-start"
            onClick={() => setFilas([...filas, { nombre: "", texto: "" }])}
          >
            + Añadir zona
          </button>
        </div>
      )}
      {filas.length === 0 && (
        <button
          type="button"
          className="boton-sec self-start"
          onClick={() => setFilas([{ nombre: "", texto: "" }])}
        >
          + Añadir una zona a mano
        </button>
      )}

      <button
        type="button"
        className="boton-principal !min-h-11 !text-base"
        disabled={guardando}
        onClick={() => void guardar()}
      >
        {guardando ? "Guardando…" : "Guardar tarifas"}
      </button>
      <p className="text-xs text-tinta-3">
        Lo ya registrado no cambia: cada registro guarda su monto.
      </p>
      {mensaje && (
        <p
          className={`rounded-btn px-3 py-2 text-sm ${mensaje.tono === "bien" ? "bg-bien-suave text-bien" : "bg-mal-suave text-mal"}`}
        >
          {mensaje.texto}
        </p>
      )}
    </div>
  );
}
