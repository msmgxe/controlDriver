"use client";

import { useRef, useState } from "react";

import { BotonDeAccion, FilaDeColor } from "@/components/Acciones";
import { ConfirmacionEnLinea, FormularioDeAccion, Stepper } from "@/components/ControlesDeRegistro";
import { Check, Flecha, Galeria } from "@/components/iconos";
import { useOpcion } from "@/components/OpcionActiva";
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
  const [abierto, setAbierto, oculta] = useOpcion("ruta-manual");
  const [numero, setNumero] = useState(Math.min(99, Math.max(1, siguienteNumero)));
  const [horaInicio, setHoraInicio] = useState("");
  const [horaFin, setHoraFin] = useState("");

  const numeroValido = Number.isInteger(numero) && numero >= 1 && numero <= 99;

  function guardar() {
    if (!numeroValido) return;
    onGuardar({
      numero,
      horaInicio: horaInicio || null,
      horaFin: horaFin || null,
    });
    setAbierto(false);
    setNumero(Math.min(99, siguienteNumero + 1));
    setHoraInicio("");
    setHoraFin("");
  }

  if (oculta) return null;

  if (!abierto) {
    return (
      <FilaDeColor
        k="tienda"
        titulo="Añadir una ruta"
        detalle="Número, salida y regreso"
        onClick={() => {
          setNumero(Math.min(99, Math.max(1, siguienteNumero)));
          setAbierto(true);
        }}
      />
    );
  }

  return (
    <FormularioDeAccion k="tienda" titulo="Ruta a mano" detalle="Lo mínimo para que los pedidos tengan dónde apuntar">
      <div>
        <span className="reg-lbl">Número de ruta</span>
        <Stepper k="tienda" etiqueta="Número de ruta" valor={numero} min={1} max={99} alCambiar={setNumero} />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <label className="block">
          <span className="reg-lbl">Salida</span>
          <input type="time" value={horaInicio} onChange={(e) => setHoraInicio(e.target.value)} className="reg-campo" />
        </label>
        <label className="block">
          <span className="reg-lbl">Regreso</span>
          <input type="time" value={horaFin} onChange={(e) => setHoraFin(e.target.value)} className="reg-campo" />
        </label>
      </div>

      <BotonDeAccion k="tienda" onClick={guardar} disabled={!numeroValido}>
        <Check className="size-5" />
        Guardar ruta
      </BotonDeAccion>
      <button type="button" onClick={() => setAbierto(false)} className="boton-secundario">
        Cancelar
      </button>
    </FormularioDeAccion>
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
  const [quitando, setQuitando] = useState<number | null>(null);
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
                onClick={() => setQuitando(r.numero)}
                className="reg-chip !min-h-9 !px-3 !text-xs text-mal"
              >
                Quitar
              </button>
            )}
          </div>
        ))}
      {quitando !== null && onBorrar && (
        <ConfirmacionEnLinea
          texto={`¿Quitar la ruta ${quitando}? Sus pedidos no se borran.`}
          confirmar="Sí, quitar"
          alConfirmar={() => {
            onBorrar(quitando);
            setQuitando(null);
          }}
          alCancelar={() => setQuitando(null)}
        />
      )}
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
      <FilaDeColor k="ajustes" titulo="Reordenar por hora" detalle="Numera del 1 en adelante" onClick={() => setConfirmando(true)} />
    );
  }

  return (
    <ConfirmacionEnLinea
      texto="Cambia el número de TODAS las rutas del día: quedarán del 1 en adelante, de la que salió más temprano a la más tarde. No se puede deshacer."
      confirmar={aplicando ? "Reordenando…" : "Sí, reordenar"}
      cancelar="No"
      ocupado={aplicando}
      alConfirmar={() => void aplicar()}
      alCancelar={() => setConfirmando(false)}
    />
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
  const [abierto, setAbierto, oculta] = useOpcion("ruta-foto");
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

  if (oculta) return null;

  if (!abierto) {
    return (
      <FilaDeColor
        k="foto"
        titulo="Leer rutas de una foto"
        detalle="Captura de la pestaña Rutas"
        onClick={() => {
          setFechaElegida(fecha);
          setLeidas([]);
          setEstado("reposo");
          setAbierto(true);
        }}
      />
    );
  }

  return (
    <FormularioDeAccion k="foto" titulo="Rutas desde una foto" detalle="Capturas de la pestaña Rutas">
      <label className="block">
        <span className="reg-lbl">¿De qué día son esas rutas?</span>
        <input
          type="date"
          value={fechaElegida}
          max={hoyEnLima()}
          disabled={!fechaEditable}
          onChange={(e) => setFechaElegida(e.target.value)}
          className="reg-campo disabled:opacity-60"
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
          <div className="flex flex-col gap-2">
            <BotonDeAccion k="foto" onClick={() => void confirmar()} disabled={leidas.length === 0 || estado === "guardando"}>
              <Check className="size-5" />
              {estado === "guardando"
                ? "Guardando…"
                : `Guardar ${leidas.length === 1 ? "esta ruta" : "estas rutas"}`}
            </BotonDeAccion>
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
          <label className="boton-sec reg-archivo">
            <Galeria className="size-5" />
            Elegir fotos
            <input
              ref={entrada}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              multiple
              onChange={(e) => void alElegirFotos(e)}
              disabled={estado === "leyendo"}
            />
          </label>
          <p className="text-xs text-tinta-3">
            Una o varias capturas de la pestaña Rutas. Si se repiten por el scroll, se juntan solas.
          </p>
          {estado === "leyendo" && <p className="text-sm text-tinta-2">Leyendo…</p>}
          {error && <p className="text-sm text-mal">{error}</p>}
          <button type="button" onClick={() => setAbierto(false)} className="boton-secundario">
            Cancelar
          </button>
        </>
      )}
    </FormularioDeAccion>
  );
}
