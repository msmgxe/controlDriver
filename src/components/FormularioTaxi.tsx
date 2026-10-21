"use client";

import { useEffect, useState } from "react";

import {
  crearTipoDeAdicional,
  guardarBloqueTaxi,
} from "@/app/(app)/jornada/acciones";
import {
  EditorDeTarifario,
  ZonasDelReparto,
  lineaVacia,
  lineasConMonto,
  type LineaDeZona,
} from "@/components/AdicionalPorZona";
import { Campo } from "@/components/FormularioApoyoHora";
import { Aviso } from "@/components/ui";
import { horaEnLima, type FechaISO } from "@/lib/fechas";
import type { Punto } from "@/lib/geo/distancia";
import { posicionParaBloqueExtra } from "@/lib/geo/nativo";
import { distanciaDeTaxi } from "@/lib/geo/taxi";
import { aCentimos } from "@/lib/pagos/reglas";
import {
  CATEGORIA_TAXI,
  listarCategorias,
} from "@/lib/db/sqlite/bloques-extra";
import type {
  BloqueExtraFila,
  CategoriaAdicional,
  FuenteDeKm,
} from "@/lib/db/tipos";

/**
 * Registrar un adicional: Taxi, Movilidad, Expo Vino, Especiales… lo que la
 * persona cobra aparte de sus pedidos. El tipo se elige entre chips o se crea
 * allí mismo. **Taxi** pide además los km (con GPS); los demás, solo el monto y
 * una descripción opcional.
 */
export function FormularioTaxi({
  fecha,
  factorCalles,
  inicial,
  categoriaInicial,
  alGuardar,
}: {
  /** El tipo con que se abre al añadir desde la fila de uno; «sin» = Taxi. */
  categoriaInicial?: string;
  fecha: FechaISO;
  factorCalles: number;
  /** Si se corrige una carrera ya guardada: sus datos de partida. */
  inicial?: Extract<BloqueExtraFila, { tipo: "taxi" }>;
  alGuardar: () => void;
}) {
  const [origen, setOrigen] = useState<Punto | null>(inicial?.origen ?? null);
  const [destino, setDestino] = useState<Punto | null>(
    inicial?.destino ?? null,
  );
  const [horaInicio, setHoraInicio] = useState<string | null>(
    inicial?.horaInicio ?? null,
  );
  const [horaFin, setHoraFin] = useState<string | null>(
    inicial?.horaFin ?? null,
  );
  const [km, setKm] = useState(inicial?.km != null ? String(inicial.km) : "");
  const [kmFuente, setKmFuente] = useState<FuenteDeKm>(
    inicial?.kmFuente ?? "manual",
  );
  const [monto, setMonto] = useState(
    inicial ? String(inicial.montoCentimos / 100) : "",
  );
  const [buscando, setBuscando] = useState<"inicio" | "fin" | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tipos, setTipos] = useState<CategoriaAdicional[]>([]);
  const [categoriaId, setCategoriaId] = useState<string>(
    inicial?.categoriaId ??
      (categoriaInicial && categoriaInicial !== "sin"
        ? categoriaInicial
        : CATEGORIA_TAXI),
  );
  const [descripcion, setDescripcion] = useState(inicial?.descripcion ?? "");
  const [nuevo, setNuevo] = useState<string | null>(null);
  const [lineas, setLineas] = useState<LineaDeZona[]>(
    inicial?.zona
      ? [{ zona: inicial.zona, cantidad: String(inicial.cantidad ?? 1) }]
      : [lineaVacia()],
  );
  const [verTarifas, setVerTarifas] = useState(false);

  const recargarTipos = () =>
    listarCategorias()
      .then(setTipos)
      .catch(() => {});

  useEffect(() => {
    let vigente = true;
    listarCategorias()
      .then((l) => vigente && setTipos(l))
      .catch(() => {});
    return () => {
      vigente = false;
    };
  }, []);

  const esTaxi = categoriaId === CATEGORIA_TAXI;
  const tipoActual = tipos.find((t) => t.id === categoriaId) ?? null;
  // Un tipo con tarifario se registra por zonas (zona × pedidos), también al corregir uno ya guardado.
  const usaZonas = !esTaxi && (tipoActual?.tarifario.length ?? 0) > 0;
  const porZona = lineasConMonto(tipoActual?.tarifario ?? [], lineas);
  // Los activos, y el de este registro aunque ya esté archivado.
  const visibles = tipos.filter((t) => t.activa || t.id === categoriaId);

  async function crearTipo() {
    if (nuevo === null) return;
    const r = await crearTipoDeAdicional(nuevo);
    if (!r.ok) {
      setError(r.error);
      return;
    }
    setError(null);
    setTipos((previos) =>
      previos.some((t) => t.id === r.categoria.id)
        ? previos
        : [...previos, r.categoria],
    );
    setCategoriaId(r.categoria.id);
    setNuevo(null);
  }

  async function marcarInicio() {
    setBuscando("inicio");
    const p = await posicionParaBloqueExtra();
    setBuscando(null);
    setOrigen(p);
    setHoraInicio(horaEnLima());
  }

  async function marcarFin() {
    setBuscando("fin");
    const p = await posicionParaBloqueExtra();
    setBuscando(null);
    setDestino(p);
    setHoraFin(horaEnLima());
    if (origen && p) {
      const d = await distanciaDeTaxi(origen, p, factorCalles);
      setKm(String(d.km));
      setKmFuente(d.fuente);
    }
  }

  const montoCentimos = aCentimos(Number(monto.replace(",", ".")) || 0);
  const kmNumero = Number(km.replace(",", "."));
  const puedeGuardar = usaZonas
    ? porZona.length > 0 && !guardando
    : (!esTaxi || kmNumero > 0) && montoCentimos > 0 && !guardando;

  async function guardar() {
    setGuardando(true);
    setError(null);
    if (usaZonas) {
      // Un registro por zona: «San Borja × 5», con su monto ya calculado.
      for (const l of porZona) {
        const r = await guardarBloqueTaxi({
          fecha,
          horaInicio: null,
          horaFin: null,
          origen: null,
          destino: null,
          km: 0,
          kmFuente: "manual",
          montoCentimos: l.montoCentimos,
          notas: null,
          categoriaId,
          zona: l.zona,
          cantidad: l.cantidad,
        });
        if (!r.ok) {
          setGuardando(false);
          setError(r.error);
          return;
        }
      }
      setGuardando(false);
      alGuardar();
      return;
    }
    const r = await guardarBloqueTaxi({
      fecha,
      horaInicio: esTaxi ? horaInicio : null,
      horaFin: esTaxi ? horaFin : null,
      origen: esTaxi ? origen : null,
      destino: esTaxi ? destino : null,
      km: esTaxi ? kmNumero : 0,
      kmFuente: esTaxi ? kmFuente : "manual",
      montoCentimos,
      notas: null,
      categoriaId,
      descripcion: descripcion.trim() || null,
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
        {error && (
          <Aviso tono="mal" titulo="No se pudo guardar">
            {error}
          </Aviso>
        )}

        <div className="flex flex-col gap-2">
          <span className="text-sm font-semibold">Tipo de adicional</span>
          <div
            role="radiogroup"
            aria-label="Tipo de adicional"
            className="flex flex-wrap gap-2"
          >
            {visibles.map((t) => (
              <button
                key={t.id}
                type="button"
                role="radio"
                aria-checked={categoriaId === t.id}
                onClick={() => setCategoriaId(t.id)}
                className={`min-h-11 rounded-btn border-2 px-4 text-sm font-semibold ${
                  categoriaId === t.id
                    ? "border-acento bg-acento-suave text-acento-tinta"
                    : "border-linea-fuerte text-tinta-2"
                }`}
              >
                {t.nombre}
              </button>
            ))}
            {nuevo === null && (
              <button
                type="button"
                onClick={() => setNuevo("")}
                className="min-h-11 rounded-btn border-2 border-dashed border-linea-fuerte px-4 text-sm font-semibold text-acento-tinta"
              >
                + Nuevo tipo
              </button>
            )}
          </div>
          {nuevo !== null && (
            <div className="flex gap-2">
              <input
                value={nuevo}
                onChange={(e) => setNuevo(e.target.value)}
                placeholder="Ej.: Expo Vino"
                maxLength={40}
                autoFocus
                aria-label="Nombre del nuevo tipo"
                className="min-h-11 min-w-0 flex-1 rounded-btn border border-linea-fuerte bg-sup px-3 text-base"
              />
              <button
                type="button"
                className="boton-sec"
                disabled={nuevo.trim().length < 2}
                onClick={() => void crearTipo()}
              >
                Crear
              </button>
              <button
                type="button"
                className="boton-sec"
                onClick={() => setNuevo(null)}
              >
                ✕
              </button>
            </div>
          )}
        </div>

        {esTaxi && (
          <>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => void marcarInicio()}
                disabled={buscando !== null}
                className={`boton-sec flex-1 !min-h-14 flex-col !gap-0.5 ${origen ? "!border-acento !text-acento-tinta" : ""}`}
              >
                <span className="text-xs font-semibold opacity-80">
                  {buscando === "inicio" ? "Ubicando…" : "Inicio"}
                </span>
                <span className="text-sm font-bold">
                  {origen ? `${horaInicio} marcado` : "Marcar inicio"}
                </span>
              </button>
              <button
                type="button"
                onClick={() => void marcarFin()}
                disabled={buscando !== null || !origen}
                className={`boton-sec flex-1 !min-h-14 flex-col !gap-0.5 ${destino ? "!border-acento !text-acento-tinta" : ""}`}
              >
                <span className="text-xs font-semibold opacity-80">
                  {buscando === "fin" ? "Ubicando…" : "Fin"}
                </span>
                <span className="text-sm font-bold">
                  {destino ? `${horaFin} marcado` : "Marcar fin"}
                </span>
              </button>
            </div>
            {(!origen || !destino) && (
              <p className="-mt-2 text-xs text-tinta-3">
                Sin GPS no hay problema: escribe los km a mano abajo.
              </p>
            )}

            <Campo etiqueta="Kilómetros">
              <input
                inputMode="decimal"
                value={km}
                onChange={(e) => {
                  setKm(e.target.value);
                  setKmFuente("manual");
                }}
                placeholder="8.2"
                className="min-h-11 rounded-btn border border-linea-fuerte bg-sup px-3 text-base"
              />
            </Campo>
          </>
        )}

        {usaZonas ? (
          <ZonasDelReparto
            zonas={tipoActual?.tarifario ?? []}
            lineas={lineas}
            setLineas={setLineas}
          />
        ) : (
          <>
            {!esTaxi && (
              <Campo etiqueta="Descripción (opcional)">
                <input
                  value={descripcion}
                  onChange={(e) => setDescripcion(e.target.value)}
                  placeholder="Ej.: Entrega en Barranco"
                  maxLength={120}
                  className="min-h-11 rounded-btn border border-linea-fuerte bg-sup px-3 text-base"
                />
              </Campo>
            )}

            <Campo etiqueta="Cuánto cobraste (S/)">
              <input
                inputMode="decimal"
                value={monto}
                onChange={(e) => setMonto(e.target.value)}
                placeholder="22.00"
                className="min-h-11 rounded-btn border border-linea-fuerte bg-sup px-3 text-base"
              />
            </Campo>
          </>
        )}

        {!esTaxi && tipoActual && (
          <div className="flex flex-col gap-2 border-t border-linea pt-3">
            <button
              type="button"
              aria-expanded={verTarifas}
              onClick={() => setVerTarifas((v) => !v)}
              className="min-h-11 self-start text-sm font-semibold text-acento-tinta"
            >
              {verTarifas ? "▾" : "▸"} Tarifas de {tipoActual.nombre}
              {tipoActual.tarifario.length > 0
                ? ` (${tipoActual.tarifario.length} zonas)`
                : " · cargar zonas y precios"}
            </button>
            {verTarifas && (
              <EditorDeTarifario
                key={tipoActual.id + tipoActual.tarifario.length}
                tipo={tipoActual}
                alGuardar={() => void recargarTipos()}
              />
            )}
          </div>
        )}
      </div>

      <div className="flex flex-col gap-2 border-t border-linea px-4 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom,0px))]">
        <button
          type="button"
          className="boton-principal !min-h-11 !text-base"
          disabled={!puedeGuardar}
          onClick={() => void guardar()}
        >
          {guardando
            ? "Guardando…"
            : inicial
              ? "Guardar cambios"
              : "Guardar adicional"}
        </button>
      </div>
    </>
  );
}
