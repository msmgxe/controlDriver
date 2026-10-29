"use client";

import { useState, type CSSProperties } from "react";

import { DialogoConfirmar } from "@/components/DialogoConfirmar";
import { useCifraAnimada } from "@/hooks/useCifraAnimada";

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

/** El color de una zona según lo que paga: de barato (verde) a caro (vino). */
const BANDAS: Array<{ hasta: number; color: string; texto: string }> = [
  { hasta: 850, color: "var(--c-cantidad)", texto: "Hasta 8.50" },
  { hasta: 900, color: "var(--c-apoyo)", texto: "9.00" },
  { hasta: 1050, color: "var(--c-buscar)", texto: "10.00 – 10.50" },
  { hasta: 1200, color: "var(--c-stats)", texto: "11.00 – 12.00" },
  { hasta: Infinity, color: "var(--c-adic)", texto: "Más de 12" },
];
const bandaDe = (centimos: number) => BANDAS.find((b) => centimos <= b.hasta) ?? BANDAS[BANDAS.length - 1];

/**
 * «Zonas del reparto»: una cuadrícula de botones de color, uno por zona del
 * tarifario. Cada toque suma un pedido a esa zona (la insignia lo cuenta); el
 * monto sale del tarifario (precio × pedidos), no se escribe. Debajo, las zonas
 * ya tocadas con − y + para corregir, y «Deshacer» el último toque.
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
  const totalAnimado = Math.round(useCifraAnimada(total, 500));
  const [historial, setHistorial] = useState<string[]>([]);
  const cuenta = (zona: string) => Number(lineas.find((l) => l.zona === zona)?.cantidad) || 0;

  function cambiarCantidad(zona: string, delta: number) {
    const actual = lineas.find((l) => l.zona === zona);
    if (!actual) {
      if (delta <= 0) return;
      // La línea vacía del principio se aprovecha en vez de dejarla suelta.
      const sinVacias = lineas.filter((l) => l.zona !== "");
      setLineas([...sinVacias, { zona, cantidad: String(delta) }]);
      return;
    }
    const nueva = (Number(actual.cantidad) || 0) + delta;
    if (nueva <= 0) {
      const resto = lineas.filter((l) => l.zona !== zona);
      setLineas(resto.length ? resto : [lineaVacia()]);
    } else {
      setLineas(lineas.map((l) => (l.zona === zona ? { ...l, cantidad: String(nueva) } : l)));
    }
  }

  function tocar(zona: string) {
    setHistorial((h) => [...h, zona]);
    cambiarCantidad(zona, 1);
  }
  function deshacer() {
    const z = historial[historial.length - 1];
    if (!z) return;
    setHistorial(historial.slice(0, -1));
    cambiarCantidad(z, -1);
  }

  const tocadas = lineas.filter((l) => l.zona && Number(l.cantidad) > 0);

  return (
    <div className="flex flex-col gap-3">
      <span className="text-sm font-semibold">Zonas del reparto · toca una por cada pedido</span>
      <div className="com-zonas">
        {zonas.map((z, k) => {
          const n = cuenta(z.nombre);
          return (
            <button
              key={z.nombre}
              type="button"
              className="com-zona rise-v2"
              style={{ "--zc": bandaDe(z.montoCentimos).color, animationDelay: `${Math.min(k, 10) * 25}ms` } as CSSProperties}
              onClick={() => tocar(z.nombre)}
              aria-label={`${z.nombre}, ${formatearSoles(z.montoCentimos)}${n ? `, ${n} pedidos` : ""}`}
            >
              <b>{z.nombre}</b>
              <small>{formatearSoles(z.montoCentimos)}</small>
              {n > 0 && (
                <i key={n} className="com-zona__n" aria-hidden>
                  {n}
                </i>
              )}
            </button>
          );
        })}
      </div>
      <div className="com-leyenda" aria-hidden>
        {BANDAS.map((b) => (
          <span key={b.texto}>
            <i style={{ background: b.color }} />
            {b.texto}
          </span>
        ))}
      </div>

      {tocadas.length > 0 && (
        <div className="flex flex-col gap-2">
          {tocadas.map((l) => (
            <div key={l.zona} className="com-dato !py-1.5">
              <b className="!text-left">{l.zona}</b>
              <span className="flex-none text-right font-mono text-sm">× {l.cantidad}</span>
              <button
                type="button"
                aria-label={`Un pedido menos en ${l.zona}`}
                className="boton-sec !min-h-11 !w-11 !px-0"
                onClick={() => cambiarCantidad(l.zona, -1)}
              >
                −
              </button>
              <button
                type="button"
                aria-label={`Un pedido más en ${l.zona}`}
                className="boton-sec !min-h-11 !w-11 !px-0"
                onClick={() => cambiarCantidad(l.zona, 1)}
              >
                +
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="com-total" aria-live="polite">
        <b>
          {pedidos} {pedidos === 1 ? "pedido" : "pedidos"} · {formatearSoles(totalAnimado)}
        </b>
        <button type="button" className="boton-sec" disabled={historial.length === 0 || pedidos === 0} onClick={deshacer}>
          Deshacer
        </button>
      </div>
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
  const [quitando, setQuitando] = useState<number | null>(null);
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
                onClick={() => (f.nombre.trim() || f.texto.trim() ? setQuitando(i) : setFilas(filas.filter((_, k) => k !== i)))}
                className="grid size-11 shrink-0 place-items-center rounded-btn bg-mal-suave text-lg text-mal"
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
      {quitando !== null && filas[quitando] && (
        <DialogoConfirmar
          titulo={`¿Quitar la zona ${filas[quitando].nombre.trim() || "sin nombre"}?`}
          texto={`Ya no se podrá elegir en ${tipo.nombre} cuando pulses «Guardar tarifas». Lo ya registrado no cambia.`}
          confirmar="Sí, quitar la zona"
          alCancelar={() => setQuitando(null)}
          alConfirmar={() => {
            setFilas(filas.filter((_, k) => k !== quitando));
            setQuitando(null);
          }}
        />
      )}
    </div>
  );
}
