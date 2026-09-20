"use client";

import { useRef, useState } from "react";

import { Check, Flecha } from "@/components/iconos";
import { hoyEnLima } from "@/lib/fechas";

/**
 * Añadir o corregir una ruta a mano.
 *
 * Hace falta por dos caminos que se cruzan. Uno: la captura de Rutas puede
 * salir cortada, o el lector puede perderse una, y entonces sus pedidos no
 * tienen a qué ruta apuntar —el selector de ruta de un pedido sale vacío, sin
 * nada que elegir—. Dos: un día escrito enteramente a mano no tiene ninguna
 * ruta todavía.
 *
 * Solo pide el número y el horario: es lo mínimo para que el pedido tenga
 * dónde apuntar y las estadísticas cuenten el tiempo en ruta.
 */
export function RutaManual({
  siguienteNumero,
  onGuardar,
}: {
  /** El número que se propone por defecto: el que sigue a la última ruta. */
  siguienteNumero: number;
  onGuardar: (datos: { numero: number; horaInicio: string | null; horaFin: string | null }) => void;
}) {
  const [abierto, setAbierto] = useState(false);
  const [numero, setNumero] = useState(String(siguienteNumero));
  const [horaInicio, setHoraInicio] = useState("");
  const [horaFin, setHoraFin] = useState("");

  const numeroValido = /^\d{1,2}$/.test(numero) && Number(numero) >= 1 && Number(numero) <= 99;

  function guardar() {
    if (!numeroValido) return;
    onGuardar({
      numero: Number(numero),
      horaInicio: horaInicio || null,
      horaFin: horaFin || null,
    });
    setAbierto(false);
    setNumero(String(siguienteNumero + 1));
    setHoraInicio("");
    setHoraFin("");
  }

  if (!abierto) {
    return (
      <button
        type="button"
        onClick={() => {
          setNumero(String(siguienteNumero));
          setAbierto(true);
        }}
        className="boton-secundario self-start"
      >
        Añadir una ruta
      </button>
    );
  }

  return (
    <div className="flex flex-col gap-3 rounded-card border border-linea-fuerte bg-sup p-4">
      <h4 className="font-semibold">Ruta a mano</h4>

      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-semibold">Número de ruta</span>
        <input
          value={numero}
          onChange={(e) => setNumero(e.target.value.replace(/\D/g, "").slice(0, 2))}
          inputMode="numeric"
          className="min-h-[52px] w-24 rounded-btn border border-linea-fuerte bg-sup px-3 text-base"
        />
        {numero !== "" && !numeroValido && (
          <span className="text-xs text-mal">Un número entre 1 y 99.</span>
        )}
      </label>

      <div className="grid grid-cols-2 gap-3">
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-semibold">Salida</span>
          <input
            type="time"
            value={horaInicio}
            onChange={(e) => setHoraInicio(e.target.value)}
            className="min-h-[52px] rounded-btn border border-linea-fuerte bg-sup px-3 text-base"
          />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-semibold">Regreso</span>
          <input
            type="time"
            value={horaFin}
            onChange={(e) => setHoraFin(e.target.value)}
            className="min-h-[52px] rounded-btn border border-linea-fuerte bg-sup px-3 text-base"
          />
        </label>
      </div>

      <div className="flex gap-2">
        <button
          type="button"
          onClick={guardar}
          disabled={!numeroValido}
          className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-btn bg-acento px-4 text-sm font-semibold text-acento-texto disabled:opacity-50"
        >
          <Check className="size-4" />
          Guardar
        </button>
        <button type="button" onClick={() => setAbierto(false)} className="boton-secundario">
          Cancelar
        </button>
      </div>
    </div>
  );
}

/**
 * Las rutas del día, en una lista compacta con su horario y un botón para
 * borrarlas. Va junto a `RutaManual`: una construye rutas, esta las enseña.
 */
export function ListaDeRutas({
  rutas,
  onBorrar,
}: {
  rutas: Array<{ numero: number; horaInicio: string | null; horaFin: string | null }>;
  onBorrar?: (numero: number) => void;
}) {
  if (rutas.length === 0) {
    return <p className="text-sm text-tinta-3">Todavía no hay ninguna ruta este día.</p>;
  }

  return (
    <div className="flex flex-col gap-1.5">
      {rutas
        .slice()
        .sort((a, b) => a.numero - b.numero)
        .map((r) => (
          <div
            key={r.numero}
            className="flex items-center gap-3 rounded-btn bg-sup-2 px-3 py-2 text-sm"
          >
            <span className="grid size-7 shrink-0 place-items-center rounded-full bg-acento font-mono text-xs font-bold text-acento-texto">
              {r.numero}
            </span>
            <span className="flex-1 font-mono text-tinta-2">
              {r.horaInicio ?? "--:--"} <Flecha className="inline size-3 -translate-y-px" />{" "}
              {r.horaFin ?? "--:--"}
            </span>
            {onBorrar && (
              <button
                type="button"
                onClick={() => onBorrar(r.numero)}
                className="min-h-8 rounded-btn px-2 text-xs font-semibold text-mal"
              >
                Borrar
              </button>
            )}
          </div>
        ))}
    </div>
  );
}

/**
 * Reordenar las rutas del 1 al N, por hora de salida.
 *
 * Es opcional a propósito: casi siempre las rutas ya salen en orden, y
 * forzarlo en cada día sería tocar algo que no hace falta tocar. Existe para
 * cuando sí se desordenan —capturas subidas fuera de secuencia, una ruta
 * añadida a mano al final que en realidad fue la primera—.
 *
 * Pide confirmación porque cambia el número de todas las rutas del día a la
 * vez y no hay un solo paso atrás una vez guardado: mejor preguntar antes que
 * sorprender después.
 */
export function BotonReordenar({
  onConfirmar,
}: {
  onConfirmar: () => void | Promise<void>;
}) {
  const [confirmando, setConfirmando] = useState(false);
  const [aplicando, setAplicando] = useState(false);

  async function aplicar() {
    setAplicando(true);
    try {
      await onConfirmar();
    } finally {
      setAplicando(false);
      setConfirmando(false);
    }
  }

  if (!confirmando) {
    return (
      <button
        type="button"
        onClick={() => setConfirmando(true)}
        className="boton-secundario self-start"
      >
        Reordenar por hora
      </button>
    );
  }

  return (
    <div className="flex flex-col gap-2 rounded-btn bg-aviso-suave p-3">
      <p className="text-sm text-aviso">
        Las rutas quedarán numeradas del 1 en adelante, de la que salió más temprano a la que
        salió más tarde.
      </p>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => void aplicar()}
          disabled={aplicando}
          className="min-h-11 flex-1 rounded-btn bg-acento px-4 text-sm font-semibold text-acento-texto disabled:opacity-60"
        >
          {aplicando ? "Reordenando…" : "Sí, reordenar"}
        </button>
        <button
          type="button"
          onClick={() => setConfirmando(false)}
          disabled={aplicando}
          className="boton-secundario"
        >
          No
        </button>
      </div>
    </div>
  );
}

/**
 * Rutas de una o más fotos, con la fecha a la que pertenecen.
 *
 * El mismo lector que usa la carga principal, pero acotado a **solo rutas**:
 * sin pedidos, sin arrastre de la noche anterior, sin las alertas de un día
 * completo. Sirve para el caso suelto —"tengo la foto de dos rutas que me
 * faltaron"— sin tener que rehacer la revisión de un día entero.
 *
 * La fecha es explícita y no se adivina de la captura: si `fechaEditable` es
 * `false` —dentro de Revisión, donde ya existe un selector de fecha para todo
 * el día— se usa tal cual; si no, se puede elegir, porque desde el detalle de
 * un día concreto puede llegar la foto de la ruta de *otro* día.
 */
export function LectorDeRutas({
  fecha,
  fechaEditable = true,
  onLeidas,
}: {
  fecha: string;
  fechaEditable?: boolean;
  onLeidas: (
    fecha: string,
    rutas: Array<{ numero: number; horaInicio: string | null; horaFin: string | null }>,
  ) => void | Promise<void>;
}) {
  const [abierto, setAbierto] = useState(false);
  const [fechaElegida, setFechaElegida] = useState(fecha);
  const [estado, setEstado] = useState<"reposo" | "leyendo" | "listas" | "guardando" | "error">(
    "reposo",
  );
  const [leidas, setLeidas] = useState<Array<{ numero: number; horaInicio: string | null; horaFin: string | null }>>([]);
  const [error, setError] = useState<string | null>(null);
  const entrada = useRef<HTMLInputElement>(null);

  async function alElegirFotos(e: React.ChangeEvent<HTMLInputElement>) {
    const archivos = Array.from(e.target.files ?? []);
    if (entrada.current) entrada.current.value = "";
    if (archivos.length === 0) return;

    setEstado("leyendo");
    setError(null);
    try {
      const { lecturaDisponible, leerRutasDeCapturas } = await import("@/lib/extraccion/enDispositivo");
      if (!lecturaDisponible()) {
        throw new Error("Leer capturas solo funciona en la app instalada, no en el navegador.");
      }
      const { paraLeer } = await import("@/lib/carga");
      const preparadas = await Promise.all(archivos.map((a) => paraLeer(a)));
      const rutas = await leerRutasDeCapturas(preparadas);

      if (rutas.length === 0) {
        throw new Error("No se reconoció ninguna ruta en esas fotos. Asegúrate de que son de la pestaña Rutas.");
      }
      setLeidas(rutas);
      setEstado("listas");
    } catch (fallo) {
      setEstado("error");
      setError(fallo instanceof Error ? fallo.message : "No se pudieron leer las fotos.");
    }
  }

  async function confirmar() {
    setEstado("guardando");
    try {
      await onLeidas(fechaElegida, leidas);
      setAbierto(false);
      setLeidas([]);
      setEstado("reposo");
    } catch (fallo) {
      setEstado("error");
      setError(fallo instanceof Error ? fallo.message : "No se pudieron guardar las rutas.");
    }
  }

  if (!abierto) {
    return (
      <button
        type="button"
        onClick={() => {
          setFechaElegida(fecha);
          setLeidas([]);
          setEstado("reposo");
          setAbierto(true);
        }}
        className="boton-secundario self-start"
      >
        Leer rutas de una foto
      </button>
    );
  }

  return (
    <div className="flex flex-col gap-3 rounded-card border border-linea-fuerte bg-sup p-4">
      <h4 className="font-semibold">Rutas desde una foto</h4>

      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-semibold">Fecha de esas rutas</span>
        <input
          type="date"
          value={fechaElegida}
          max={hoyEnLima()}
          disabled={!fechaEditable}
          onChange={(e) => setFechaElegida(e.target.value)}
          className="min-h-[52px] rounded-btn border border-linea-fuerte bg-sup px-3 text-base disabled:opacity-60"
        />
        {!fechaEditable && (
          <span className="text-xs text-tinta-3">La del día que estás revisando.</span>
        )}
      </label>

      {estado === "listas" || estado === "guardando" ? (
        <>
          <p className="text-sm text-tinta-2">
            {leidas.length} {leidas.length === 1 ? "ruta encontrada" : "rutas encontradas"}:
          </p>
          <ListaDeRutas
            rutas={leidas}
            onBorrar={
              estado === "guardando"
                ? undefined
                : (n) => setLeidas((l) => l.filter((r) => r.numero !== n))
            }
          />
          {error && <p className="text-sm text-mal">{error}</p>}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => void confirmar()}
              disabled={leidas.length === 0 || estado === "guardando"}
              className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-btn bg-acento px-4 text-sm font-semibold text-acento-texto disabled:opacity-50"
            >
              <Check className="size-4" />
              {estado === "guardando"
                ? "Guardando…"
                : `Guardar ${leidas.length === 1 ? "esta ruta" : "estas rutas"}`}
            </button>
            <button
              type="button"
              onClick={() => setAbierto(false)}
              disabled={estado === "guardando"}
              className="boton-secundario"
            >
              Cancelar
            </button>
          </div>
        </>
      ) : (
        <>
          <input
            ref={entrada}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            multiple
            onChange={(e) => void alElegirFotos(e)}
            disabled={estado === "leyendo"}
            className="text-sm"
          />
          <p className="text-xs text-tinta-3">
            Una o varias capturas de la pestaña Rutas. Si se repiten por el scroll, se juntan solas.
          </p>
          {estado === "leyendo" && <p className="text-sm text-tinta-2">Leyendo…</p>}
          {error && <p className="text-sm text-mal">{error}</p>}
          <button type="button" onClick={() => setAbierto(false)} className="boton-secundario self-start">
            Cancelar
          </button>
        </>
      )}
    </div>
  );
}
