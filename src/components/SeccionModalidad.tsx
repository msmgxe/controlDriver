"use client";

import { useState } from "react";

import { Auto } from "@/components/Auto";
import { Check } from "@/components/iconos";
import { useDatos } from "@/hooks/useDatos";
import { hoyEnLima } from "@/lib/fechas";
import { reglaVigente } from "@/lib/db/sqlite/jornadas";
import {
  guardarPerfil,
  guardarRegla,
  guardarTienda,
  listarTiendas,
  perfilActual,
  sembrarSiHaceFalta,
} from "@/lib/db/sqlite/perfil";
import type { Tienda } from "@/lib/db/tipos";
import {
  REGLA_INICIAL,
  TARIFA_MOTO_ELECTRICA,
  VEHICULO_POR_DEFECTO,
  reglaTarifaUnica,
  type ReglaPago,
  type TipoVehiculo,
} from "@/lib/pagos/reglas";

/**
 * Con qué tienda repartes, con qué vehículo, y cuánto paga cada uno.
 *
 * Tres decisiones, cada una debajo de la anterior porque la de arriba acota a
 * la de abajo:
 *
 *   1. **La tienda.** Quien reparte para más de una elige aquí para cuál es
 *      la carga de hoy. No hay límite: se agregan las que hagan falta.
 *   2. **La modalidad** (auto o moto eléctrica) de esa tienda. Cambiarla no
 *      toca ni un día ya cargado: cada jornada guarda su propia tienda y su
 *      propio vehículo (§13), así que un cambio a mitad de semana no
 *      reescribe lo que ya se cobró con el anterior.
 *   3. **La tarifa** de esa tienda con esa modalidad, editable debajo. No va
 *      atada a la modalidad: hay tiendas que pagan por tramo de distancia y
 *      tiendas que pagan un monto fijo por pedido, **para cualquiera de los
 *      dos vehículos** —hay tiendas donde el auto también cobra parejo, S/
 *      8.50 o S/ 10 sea cual sea el recorrido—. Por eso el editor no es "el
 *      del auto" y "el de la moto": es uno solo, con un interruptor
 *      Única/Por tramo, y lo que se haya elegido se guarda para la tienda y
 *      la modalidad activas, sin tocar las demás combinaciones.
 *
 * La primera vez que una tienda pasa a moto eléctrica, si esa tienda nunca
 * tuvo una tarifa de moto, se crea sola con el monto por defecto (§
 * TARIFA_MOTO_ELECTRICA) — sin eso, `reglaVigente` caería al azar en la tabla
 * por tramos del auto, que es justo lo que la moto no tiene. Una tienda
 * **nueva** no necesita este empujón para el auto: su primera tarifa, si no
 * se toca, es la del código (§ REGLA_INICIAL), que ya es una tabla por
 * tramos razonable de por sí.
 */
export function SeccionModalidad() {
  const hoy = hoyEnLima();
  /* `sembrarSiHaceFalta` antes de leer, igual que hace el armazón: en el
     primerísimo arranque, esta sección monta su propio efecto antes de que el
     del armazón termine de crear la tienda —React monta los efectos de los
     hijos antes que los del padre—, y sin esto se quedaba diciendo "no hay
     tienda" para siempre, porque la consulta no se repite sola. Llamarla aquí
     también es gratis: si ya existe, no hace nada (ver su propio doc). */
  const { datos: perfil, recargar: recargarPerfil } = useDatos(
    async () => {
      await sembrarSiHaceFalta();
      return perfilActual();
    },
    [],
    { conservar: true },
  );
  /* Misma razón que la de arriba: sin `sembrarSiHaceFalta` aquí también, esta
     lista podía resolver antes de que la tienda del código existiera todavía
     y quedarse vacía para siempre —el chip de "Wong - Aldabas" no llegaba a
     aparecer nunca en el primerísimo arranque—. */
  const { datos: tiendas, recargar: recargarTiendas } = useDatos(
    async () => {
      await sembrarSiHaceFalta();
      return listarTiendas();
    },
    [],
    { conservar: true },
  );

  const vehiculo = perfil?.vehiculo ?? VEHICULO_POR_DEFECTO;
  const tiendaId = perfil?.tiendaId ?? null;
  const tienda = tiendas?.find((t) => t.id === tiendaId) ?? null;

  const {
    datos: vigente,
    cargando: cargandoRegla,
    recargar: recargarRegla,
  } = useDatos(() => reglaVigente(hoy, tiendaId, vehiculo), [tiendaId, vehiculo], {
    conservar: true,
  });

  const [ocupado, setOcupado] = useState(false);
  const [mensaje, setMensaje] = useState<string | null>(null);
  const [agregando, setAgregando] = useState(false);
  const [nombreNuevo, setNombreNuevo] = useState("");
  const [errorTienda, setErrorTienda] = useState<string | null>(null);

  /**
   * Si la tienda pasa a moto eléctrica y nunca tuvo tarifa de moto, se le pone
   * la del código para que no caiga en la tabla por tramos del auto.
   */
  async function asegurarTarifaMoto(deTienda: string) {
    const actual = await reglaVigente(hoy, deTienda, "moto");
    if (actual.id === null) {
      await guardarRegla(deTienda, "moto", hoy, reglaTarifaUnica(TARIFA_MOTO_ELECTRICA));
    }
  }

  async function elegirTienda(elegida: Tienda) {
    if (!perfil || elegida.id === tiendaId || ocupado) return;
    setOcupado(true);
    setMensaje(null);
    try {
      await guardarPerfil({ nombre: perfil.nombre, tiendaId: elegida.id });
      if (vehiculo === "moto") await asegurarTarifaMoto(elegida.id);
      recargarPerfil();
      setMensaje(`Tienda: ${elegida.nombre}.`);
    } finally {
      setOcupado(false);
    }
  }

  async function agregarTienda() {
    const nombre = nombreNuevo.trim();
    if (!nombre || !perfil || ocupado) return;
    setOcupado(true);
    setErrorTienda(null);
    try {
      const id = await guardarTienda({ nombre });
      await guardarPerfil({ nombre: perfil.nombre, tiendaId: id });
      if (vehiculo === "moto") await asegurarTarifaMoto(id);
      recargarTiendas();
      recargarPerfil();
      setNombreNuevo("");
      setAgregando(false);
      setMensaje(`Tienda: ${nombre}. Nueva, con la tarifa del código hasta que la edites.`);
    } catch (e) {
      const texto = e instanceof Error ? e.message : "";
      setErrorTienda(
        texto.includes("UNIQUE") ? "Ya hay una tienda con ese nombre." : texto || "No se pudo crear la tienda.",
      );
    } finally {
      setOcupado(false);
    }
  }

  async function elegirModalidad(nuevo: TipoVehiculo) {
    if (!perfil || nuevo === vehiculo || ocupado) return;
    setOcupado(true);
    setMensaje(null);
    try {
      await guardarPerfil({ nombre: perfil.nombre, vehiculo: nuevo });
      if (tiendaId && nuevo === "moto") await asegurarTarifaMoto(tiendaId);
      recargarPerfil();
      setMensaje(
        nuevo === "moto"
          ? "Modalidad: Moto eléctrica. Las jornadas nuevas se leen con su tarifa."
          : "Modalidad: Auto. Las jornadas nuevas se leen con su tarifa.",
      );
    } finally {
      setOcupado(false);
    }
  }

  return (
    <section className="tarjeta flex flex-col gap-4" aria-labelledby="titulo-modalidad">
      <div>
        <h3 id="titulo-modalidad" className="text-lg">
          Tienda, modalidad y tarifa
        </h3>
        <p className="text-sm text-tinta-2">
          Para quién repartes, con qué, y cuánto paga cada pedido. Un cambio no toca lo ya cargado.
        </p>
      </div>

      <div className="flex flex-col gap-2">
        <span className="rotulo">Tienda</span>
        <div className="flex flex-wrap gap-2">
          {tiendas?.map((t) => (
            <button
              key={t.id}
              type="button"
              aria-pressed={t.id === tiendaId}
              disabled={ocupado}
              onClick={() => void elegirTienda(t)}
              className={`min-h-10 rounded-chip border-2 px-3 text-sm font-semibold disabled:opacity-60 ${
                t.id === tiendaId
                  ? "border-acento bg-acento-suave text-acento-tinta"
                  : "border-linea bg-sup text-tinta-2 hover:bg-sup-2"
              }`}
            >
              {t.nombre}
            </button>
          ))}
          {!agregando && (
            <button
              type="button"
              onClick={() => setAgregando(true)}
              className="min-h-10 rounded-chip border-2 border-dashed border-linea-fuerte px-3 text-sm font-semibold text-tinta-2 hover:bg-sup-2"
            >
              + Nueva tienda
            </button>
          )}
        </div>

        {agregando && (
          <div className="flex flex-col gap-2 rounded-btn bg-sup-2 p-3">
            <label htmlFor="tienda-nueva" className="text-sm font-semibold">
              Nombre de la tienda
            </label>
            <div className="flex gap-2">
              <input
                id="tienda-nueva"
                value={nombreNuevo}
                onChange={(e) => setNombreNuevo(e.target.value)}
                placeholder="Wong - Gardenias"
                className="min-h-10 min-w-0 flex-1 rounded-btn border border-linea-fuerte bg-sup px-3 text-sm outline-none"
              />
              <button
                type="button"
                className="boton-sec shrink-0"
                disabled={ocupado || !nombreNuevo.trim()}
                onClick={() => void agregarTienda()}
              >
                Agregar
              </button>
              <button
                type="button"
                className="shrink-0 px-2 text-sm text-tinta-2"
                onClick={() => {
                  setAgregando(false);
                  setNombreNuevo("");
                  setErrorTienda(null);
                }}
              >
                Cancelar
              </button>
            </div>
            {errorTienda && <p className="text-sm text-mal">{errorTienda}</p>}
          </div>
        )}
      </div>

      <div role="radiogroup" aria-label="Modalidad" className="grid grid-cols-2 gap-2">
        <BotonModalidad
          valor="auto"
          activa={vehiculo === "auto"}
          disabled={ocupado}
          onClick={() => void elegirModalidad("auto")}
          titulo="Auto"
        />
        <BotonModalidad
          valor="moto"
          activa={vehiculo === "moto"}
          disabled={ocupado}
          onClick={() => void elegirModalidad("moto")}
          titulo="Moto eléctrica"
        />
      </div>

      {mensaje && (
        <p role="status" className="text-sm font-semibold text-bien">
          {mensaje}
        </p>
      )}

      {!tiendaId || !tienda ? (
        <p className="border-t border-linea pt-4 text-sm text-tinta-2">
          Elige o crea una tienda arriba para poder guardar una tarifa.
        </p>
      ) : (
        !cargandoRegla && (
          <EditorTarifa
            key={`${tienda.id}-${vehiculo}-${vigente?.id ?? "nueva"}`}
            tiendaId={tienda.id}
            hoy={hoy}
            vehiculo={vehiculo}
            regla={vigente?.regla ?? (vehiculo === "moto" ? reglaTarifaUnica(TARIFA_MOTO_ELECTRICA) : REGLA_INICIAL)}
            alGuardar={() => {
              recargarRegla();
              setMensaje("Tarifa actualizada.");
            }}
          />
        )
      )}
    </section>
  );
}

function BotonModalidad({
  valor,
  activa,
  disabled,
  onClick,
  titulo,
}: {
  valor: TipoVehiculo;
  activa: boolean;
  disabled: boolean;
  onClick: () => void;
  titulo: string;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={activa}
      disabled={disabled}
      onClick={onClick}
      className={`flex min-w-0 flex-col items-start gap-2 rounded-btn border-2 p-2.5 text-left disabled:opacity-60 ${
        activa ? "border-acento bg-acento-suave" : "border-linea bg-sup hover:bg-sup-2"
      }`}
    >
      <span className="flex w-full items-center justify-between">
        <span className="grid size-9 shrink-0 place-items-center rounded-chip bg-sup-2">
          <Auto vehiculo={valor} className="w-7" />
        </span>
        {activa && <Check className="size-4 shrink-0 text-acento-tinta" />}
      </span>
      <b className="text-sm leading-tight font-semibold">{titulo}</b>
    </button>
  );
}

/** El campo de texto de un monto en soles: acepta coma o punto. */
function CampoSoles({
  id,
  valor,
  onChange,
  ancho = "w-20",
}: {
  id?: string;
  valor: string;
  onChange: (v: string) => void;
  ancho?: string;
}) {
  return (
    <div className="flex min-h-10 items-center gap-1 rounded-btn border border-linea-fuerte bg-sup px-2.5">
      <span className="text-xs text-tinta-3">S/</span>
      <input
        id={id}
        value={valor}
        onChange={(e) => onChange(e.target.value)}
        inputMode="decimal"
        className={`${ancho} bg-transparent text-right font-mono text-sm outline-none`}
      />
    </div>
  );
}

/** Un texto de monto a número, aceptando coma decimal. `null` si no es válido. */
function aMonto(texto: string): number | null {
  const n = Number(texto.trim().replace(",", "."));
  return Number.isFinite(n) && n >= 0 ? n : null;
}

function mensajeDeFallo(e: unknown): string {
  return e instanceof Error ? e.message : "No se pudo guardar.";
}

/**
 * La tarifa de la tienda y modalidad activas: **única** (un monto por
 * pedido, sea cual sea la distancia) o **por tramo** (la tabla de siempre).
 * Ninguna de las dos formas es "la del auto" o "la de la moto", ni tampoco
 * "la de tal tienda": cualquier tienda, con cualquier vehículo, puede cobrar
 * de cualquiera de las dos maneras, así que el interruptor manda sobre lo
 * que diga la modalidad o la tienda.
 *
 * Al cambiar de modo se ofrece un punto de partida razonable —el primer
 * tramo, o la tabla de siempre— y se pide **Guardar** para que tome efecto:
 * cambiar de idea sin guardar no hace ni una sola escritura.
 */
function EditorTarifa({
  tiendaId,
  hoy,
  vehiculo,
  regla,
  alGuardar,
}: {
  tiendaId: string;
  hoy: string;
  vehiculo: TipoVehiculo;
  regla: ReglaPago;
  alGuardar: () => void;
}) {
  const [modo, setModo] = useState<"unica" | "tramos">(regla.tramos.length <= 1 ? "unica" : "tramos");
  const [montoUnico, setMontoUnico] = useState(
    String(regla.tramos[0]?.monto ?? (vehiculo === "moto" ? TARIFA_MOTO_ELECTRICA : 10)),
  );
  const [tramos, setTramos] = useState(() =>
    (regla.tramos.length > 1 ? regla.tramos : REGLA_INICIAL.tramos).map((t) => ({
      ...t,
      texto: String(t.monto),
    })),
  );
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function cambiarTramo(id: number, texto: string) {
    setTramos((previos) => previos.map((t) => (t.id === id ? { ...t, texto } : t)));
  }

  async function guardar() {
    setError(null);

    if (modo === "unica") {
      const valor = aMonto(montoUnico);
      if (valor === null || valor <= 0) {
        setError("Pon un monto válido, mayor que cero.");
        return;
      }
      setGuardando(true);
      try {
        await guardarRegla(tiendaId, vehiculo, hoy, reglaTarifaUnica(valor));
        alGuardar();
      } catch (e) {
        setError(mensajeDeFallo(e));
      } finally {
        setGuardando(false);
      }
      return;
    }

    const montos = tramos.map((t) => aMonto(t.texto));
    if (montos.some((m) => m === null)) {
      setError("Revisa los montos: alguno no es un número válido.");
      return;
    }
    setGuardando(true);
    try {
      const nuevaRegla: ReglaPago = {
        moneda: "PEN",
        base: "por_pedido",
        tramos: tramos.map((t, i) => ({
          id: t.id,
          desde: t.desde,
          hasta: t.hasta,
          monto: montos[i] as number,
        })),
        garantiaPermanencia: regla.garantiaPermanencia,
      };
      await guardarRegla(tiendaId, vehiculo, hoy, nuevaRegla);
      alGuardar();
    } catch (e) {
      setError(mensajeDeFallo(e));
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div className="flex flex-col gap-3 border-t border-linea pt-4">
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-semibold">Tarifa</span>
        <div role="radiogroup" aria-label="Forma de cobrar" className="flex gap-0.5 rounded-chip bg-sup-2 p-0.5">
          {(
            [
              ["unica", "Única"],
              ["tramos", "Por tramo"],
            ] as const
          ).map(([valor, etiqueta]) => (
            <button
              key={valor}
              type="button"
              role="radio"
              aria-checked={modo === valor}
              onClick={() => setModo(valor)}
              className={`rounded-chip px-3 py-1.5 text-xs font-bold ${
                modo === valor ? "bg-sup text-tinta" : "text-tinta-3"
              }`}
            >
              {etiqueta}
            </button>
          ))}
        </div>
      </div>

      {modo === "unica" ? (
        <div className="flex flex-col gap-1.5">
          <label htmlFor="tarifa-unica" className="text-sm text-tinta-2">
            Monto por pedido
          </label>
          <CampoSoles id="tarifa-unica" valor={montoUnico} onChange={setMontoUnico} ancho="w-full" />
        </div>
      ) : (
        <div className="flex flex-col gap-1.5">
          {tramos.map((t) => (
            <div key={t.id} className="flex items-center justify-between gap-3">
              <span className="text-sm text-tinta-2">
                {t.desde} a {t.hasta} km
              </span>
              <CampoSoles valor={t.texto} onChange={(v) => cambiarTramo(t.id, v)} />
            </div>
          ))}
        </div>
      )}

      <button
        type="button"
        className="boton-sec self-start"
        disabled={guardando}
        onClick={() => void guardar()}
      >
        {guardando ? "Guardando…" : "Guardar tarifa"}
      </button>
      <p className="text-xs text-tinta-3">
        {modo === "unica"
          ? "Cobra lo mismo cualquier pedido, sin importar la distancia."
          : "Cobra según el tramo de distancia de cada pedido."}{" "}
        Se aplica desde hoy: las jornadas ya cargadas conservan la tarifa con la que se guardaron.
      </p>
      {error && <p className="text-sm text-mal">{error}</p>}
    </div>
  );
}
