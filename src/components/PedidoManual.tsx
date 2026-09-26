"use client";

import { useRef, useState } from "react";
import Link from "next/link";

import { Check } from "@/components/iconos";
import { comprimir } from "@/lib/carga";
import {
  agregarPedidoManual,
  agregarPedidosPorCantidad,
  codigosYaRegistrados,
  type PedidoLeido,
} from "@/lib/db/sqlite/jornadas";
import { guardarPrueba } from "@/lib/db/sqlite/pruebas";
import { esFechaISO, formatearFecha, hoyEnLima, type FechaISO } from "@/lib/fechas";
import { FORMATO_DE_CODIGO, RE_CODIGO_PEDIDO } from "@/lib/extraccion/esquema";
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
      setError(`El código debe tener la forma ${FORMATO_DE_CODIGO}.`);
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
          <span className="text-xs text-mal">Debe tener la forma {FORMATO_DE_CODIGO}.</span>
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
        {/* Sin `capture`: con él, el navegador abre la cámara directo y no
            deja elegir una foto ya tomada. Sin ese atributo, Android enseña
            las dos puertas —cámara y galería— y decide la persona. */}
        <input
          type="file"
          accept="image/*"
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

/**
 * Anotar **cuántos** pedidos se hicieron, sin el código de ninguno todavía.
 *
 * Es la salida para el día en que no hay cómo leer la lista —se perdió la
 * captura, la app de reparto falló, o el celular no la guardó—: en vez de
 * elegir entre no cobrar esos pedidos o transcribir códigos inventados, se
 * anota el número ahora y cada uno se completa después, a su ritmo, tocándolo
 * en la lista como cualquier otro pedido guardado.
 *
 * Cada uno nace con la tarifa de hoy —tramo 1: S/10 para el auto, la tarifa
 * única para la moto eléctrica— y cuenta para el pago de la semana desde ya.
 * Se corrige luego si alguno era de un tramo distinto.
 *
 * **La fecha se elige**, igual que en `LectorDePedidos`: no siempre es hoy
 * cuando se nota que faltó anotar un día —a veces se descubre días después,
 * al revisar la semana en Pagos—. La capa de datos rechaza un día que ya
 * tenga pedidos leídos de una foto, para no mezclar un conteo a ojo con datos
 * ya confirmados; el mensaje de ese rechazo se enseña igual que cualquier
 * otro error de este formulario.
 */
export function PedidosPorCantidad({
  fecha,
  alAgregar,
}: {
  fecha: FechaISO;
  /** Se llama con la fecha en que de verdad se guardó —puede ser otra—. */
  alAgregar: (fecha: FechaISO) => void;
}) {
  const [abierto, setAbierto] = useState(false);
  const [fechaElegida, setFechaElegida] = useState<string>(fecha);
  const [cantidad, setCantidad] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [agregados, setAgregados] = useState<number | null>(null);

  const numero = Number(cantidad);
  const fechaValida = esFechaISO(fechaElegida) && fechaElegida <= hoyEnLima();
  const valido = fechaValida && cantidad !== "" && Number.isInteger(numero) && numero > 0 && numero <= 60;

  async function guardar() {
    if (!fechaValida) {
      setError("Esa fecha no es válida.");
      return;
    }
    if (!valido) {
      setError(numero > 60 ? "Como mucho 60 pedidos de una vez." : "Pon un número mayor que cero.");
      return;
    }
    setGuardando(true);
    setError(null);
    try {
      const { ordenIds } = await agregarPedidosPorCantidad(fechaElegida as FechaISO, numero);
      setAgregados(ordenIds.length);
      setCantidad("");
      alAgregar(fechaElegida as FechaISO);
    } catch (fallo) {
      setError(fallo instanceof Error ? fallo.message : "No se pudo guardar.");
    } finally {
      setGuardando(false);
    }
  }

  if (!abierto) {
    return (
      <button
        type="button"
        onClick={() => {
          setFechaElegida(fecha);
          setAbierto(true);
          setAgregados(null);
        }}
        className="boton-secundario self-start"
      >
        Anotar cuántos pedidos hice
      </button>
    );
  }

  return (
    <div className="flex flex-col gap-3 rounded-card border border-linea-fuerte bg-sup p-4">
      <h4 className="font-semibold">Cuántos pedidos hiciste</h4>

      {agregados !== null ? (
        <>
          <p className="rounded-btn bg-bien-suave px-3 py-2 text-sm text-bien">
            Se {agregados === 1 ? "agregó 1 pedido" : `agregaron ${agregados} pedidos`} el{" "}
            {formatearFecha(fechaElegida as FechaISO)}.{" "}
            {fechaElegida === fecha
              ? "Tócalos en la lista de arriba —debajo de esta fecha— para ponerles su código, su ruta y su estado."
              : "Entra a la jornada de ese día para ponerles su código, su ruta y su estado."}
          </p>
          <div className="flex flex-wrap gap-2">
            {fechaElegida !== fecha && (
              <Link href={`/?dia=${fechaElegida}`} className="boton-sec">
                Ver esa jornada
              </Link>
            )}
            <button
              type="button"
              onClick={() => {
                setAbierto(false);
                setAgregados(null);
              }}
              className="boton-secundario self-start"
            >
              Cerrar
            </button>
          </div>
        </>
      ) : (
        <>
          <p className="text-sm text-tinta-2">
            Para cuando no tienes cómo leer las capturas de ese día. Anota el número ahora; el
            código, la ruta y el estado de cada uno se completan después. También sirve para
            ponerse al día con un día pasado que se quedó sin captura a tiempo —mientras ese día no
            tenga ya pedidos leídos de una foto.
          </p>

          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-semibold">Fecha de esos pedidos</span>
            <input
              type="date"
              value={fechaElegida}
              max={hoyEnLima()}
              disabled={guardando}
              onChange={(e) => {
                setFechaElegida(e.target.value);
                setError(null);
              }}
              className="min-h-[52px] rounded-btn border border-linea-fuerte bg-sup px-3 text-base disabled:opacity-60"
            />
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-semibold">Cantidad de pedidos</span>
            <input
              value={cantidad}
              onChange={(e) => {
                setCantidad(e.target.value.replace(/\D/g, ""));
                setError(null);
              }}
              placeholder="14"
              inputMode="numeric"
              className="min-h-[52px] rounded-btn border border-linea-fuerte bg-sup px-3 font-mono text-base"
            />
          </label>

          {error && <p className="rounded-btn bg-mal-suave px-3 py-2 text-sm text-mal">{error}</p>}

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => void guardar()}
              disabled={guardando || !valido}
              className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-btn bg-acento px-4 text-sm font-semibold text-acento-texto disabled:opacity-50"
            >
              <Check className="size-4" />
              {guardando ? "Guardando…" : "Agregar"}
            </button>
            <button type="button" onClick={() => setAbierto(false)} className="boton-secundario">
              Cancelar
            </button>
          </div>
        </>
      )}
    </div>
  );
}

/**
 * Pedidos de una o más fotos, para la fecha que se elija, **sin repetir
 * ninguno**.
 *
 * La pareja de `LectorDeRutas`: el mismo lector, acotado a solo pedidos, para
 * el caso suelto —"me faltaron estos pedidos", "tengo la captura de otro
 * día"— sin rehacer la revisión de una jornada entera. Vale también para
 * volver a subir una captura que se solapa con lo ya cargado: lo que ya está
 * se deja fuera, y aquí mismo se dice cuántos eran y en qué día están.
 *
 * "Ya está" quiere decir en **cualquier** día, no solo en el elegido: un
 * pedido no se cobra dos veces, y el que aparece en otro día suele ser el que
 * la app de reparto arrastra de la noche anterior.
 *
 * La fecha es explícita y no se adivina de la captura. Si la foto trae la
 * suya y no coincide, se avisa, pero no se cambia sola ni se impide: quien
 * elige es la persona.
 */
export function LectorDePedidos({
  fecha,
  onGuardar,
  alTerminar,
}: {
  fecha: FechaISO;
  /** Guarda los pedidos en la fecha elegida. Lanza si no se pudo. */
  onGuardar: (
    fecha: FechaISO,
    pedidos: PedidoLeido[],
  ) => Promise<{ nuevos: number; repetidos: number }>;
  /**
   * Se llama al cerrar el resultado, con la fecha en que se guardó.
   *
   * Recargar la pantalla al guardar borraría el resultado —la pantalla entera
   * se vuelve a montar—, y ese resultado es justo lo que hace falta ver: cuántos
   * entraron y cuántos ya estaban. Por eso recargar se deja para este momento.
   */
  alTerminar: (fecha: FechaISO) => void;
}) {
  const [abierto, setAbierto] = useState(false);
  const [fechaElegida, setFechaElegida] = useState<string>(fecha);
  const [estado, setEstado] = useState<
    "reposo" | "leyendo" | "listos" | "guardando" | "hecho" | "error"
  >("reposo");
  const [nuevos, setNuevos] = useState<PedidoLeido[]>([]);
  const [repetidos, setRepetidos] = useState<Array<PedidoLeido & { fecha: FechaISO }>>([]);
  const [fechasDeLaFoto, setFechasDeLaFoto] = useState<FechaISO[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [resultado, setResultado] = useState<string | null>(null);
  const entrada = useRef<HTMLInputElement>(null);

  const fechaValida = esFechaISO(fechaElegida) && fechaElegida <= hoyEnLima();
  const fotoDiceOtroDia = fechasDeLaFoto.some((f) => f !== fechaElegida);

  async function alElegirFotos(e: React.ChangeEvent<HTMLInputElement>) {
    const archivos = Array.from(e.target.files ?? []);
    if (entrada.current) entrada.current.value = "";
    if (archivos.length === 0) return;

    setEstado("leyendo");
    setError(null);
    try {
      const { lecturaDisponible, leerPedidosDeCapturas } = await import("@/lib/extraccion/enDispositivo");
      if (!lecturaDisponible()) {
        throw new Error("Leer capturas solo funciona en la app instalada, no en el navegador.");
      }
      const { paraLeer } = await import("@/lib/carga");
      const preparadas = await Promise.all(archivos.map((a) => paraLeer(a)));
      const { pedidos, fechas } = await leerPedidosDeCapturas(preparadas);

      if (pedidos.length === 0) {
        throw new Error("No se reconoció ningún pedido en esas fotos. Asegúrate de que son de la pestaña Órdenes.");
      }

      // Solo para enseñarlo: el que de verdad impide el duplicado es el
      // guardado, que lo vuelve a comprobar dentro de su transacción.
      const yaEstan = await codigosYaRegistrados(pedidos.map((p) => p.codigo));
      setNuevos(pedidos.filter((p) => !yaEstan[p.codigo]));
      setRepetidos(
        pedidos.filter((p) => yaEstan[p.codigo]).map((p) => ({ ...p, fecha: yaEstan[p.codigo] })),
      );
      setFechasDeLaFoto(fechas);
      setEstado("listos");
    } catch (fallo) {
      setEstado("error");
      setError(fallo instanceof Error ? fallo.message : "No se pudieron leer las fotos.");
    }
  }

  async function confirmar() {
    if (!fechaValida) return;
    setEstado("guardando");
    setError(null);
    try {
      const r = await onGuardar(fechaElegida, nuevos);
      setResultado(
        `${r.nuevos === 1 ? "Se añadió 1 pedido nuevo" : `Se añadieron ${r.nuevos} pedidos nuevos`}` +
          (r.repetidos > 0 ? ` (${r.repetidos} ya ${r.repetidos === 1 ? "estaba" : "estaban"}).` : "."),
      );
      setEstado("hecho");
    } catch (fallo) {
      setEstado("error");
      setError(fallo instanceof Error ? fallo.message : "No se pudieron añadir los pedidos.");
    }
  }

  if (!abierto) {
    return (
      <button
        type="button"
        onClick={() => {
          setFechaElegida(fecha);
          setNuevos([]);
          setRepetidos([]);
          setFechasDeLaFoto([]);
          setResultado(null);
          setError(null);
          setEstado("reposo");
          setAbierto(true);
        }}
        className="boton-secundario self-start"
      >
        Leer pedidos de una foto
      </button>
    );
  }

  if (estado === "hecho") {
    return (
      <div className="flex flex-col gap-3 rounded-card border border-linea-fuerte bg-sup p-4">
        <p className="flex items-center gap-2 text-sm font-semibold text-bien">
          <Check className="size-4 shrink-0" />
          {resultado}
        </p>
        <button
          type="button"
          onClick={() => {
            setAbierto(false);
            alTerminar(fechaElegida);
          }}
          className="boton-secundario self-start"
        >
          Listo
        </button>
      </div>
    );
  }

  const revisando = estado === "listos" || estado === "guardando" || (estado === "error" && nuevos.length + repetidos.length > 0);

  return (
    <div className="flex flex-col gap-3 rounded-card border border-linea-fuerte bg-sup p-4">
      <h4 className="font-semibold">Pedidos desde una foto</h4>

      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-semibold">Fecha de esos pedidos</span>
        <input
          type="date"
          value={fechaElegida}
          max={hoyEnLima()}
          disabled={estado === "guardando"}
          onChange={(e) => setFechaElegida(e.target.value)}
          className="min-h-[52px] rounded-btn border border-linea-fuerte bg-sup px-3 text-base disabled:opacity-60"
        />
      </label>

      {revisando ? (
        <>
          {fotoDiceOtroDia && fechaValida && (
            <p className="rounded-btn bg-aviso-suave px-3 py-2 text-sm text-aviso">
              La foto dice {fechasDeLaFoto.map(formatearFecha).join(" y ")}, y los vas a guardar en el{" "}
              {formatearFecha(fechaElegida)}.
            </p>
          )}

          {nuevos.length > 0 ? (
            <>
              <p className="text-sm text-tinta-2">
                {nuevos.length} {nuevos.length === 1 ? "pedido nuevo" : "pedidos nuevos"}:
              </p>
              <ul className="flex flex-col gap-1.5">
                {nuevos.map((p) => (
                  <li
                    key={p.codigo}
                    className="flex items-center gap-3 rounded-btn bg-sup-2 px-3 py-2 text-sm"
                  >
                    <span className="flex-1 font-mono text-[13px]">{p.codigo}</span>
                    <span className={`text-xs ${p.ruta === null ? "text-aviso" : "text-tinta-2"}`}>
                      {p.ruta === null ? "Sin ruta" : `Ruta ${p.ruta}`}
                      {p.estado !== "Entregado" && ` · ${p.estado}`}
                    </span>
                    {estado !== "guardando" && (
                      <button
                        type="button"
                        onClick={() => setNuevos((l) => l.filter((x) => x.codigo !== p.codigo))}
                        className="min-h-8 rounded-btn px-2 text-xs font-semibold text-mal"
                      >
                        Quitar
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <p className="text-sm text-tinta-2">
              {repetidos.length > 0
                ? "Todos esos pedidos ya estaban registrados: no hay nada que añadir."
                : "No queda ningún pedido por añadir."}
            </p>
          )}

          {repetidos.length > 0 && (
            <details className="rounded-btn bg-sup-2 px-3 py-2 text-sm">
              <summary className="cursor-pointer text-tinta-2">
                {repetidos.length} {repetidos.length === 1 ? "ya registrado" : "ya registrados"}, no se{" "}
                {repetidos.length === 1 ? "añade" : "añaden"}
              </summary>
              <ul className="mt-2 flex flex-col gap-1">
                {repetidos.map((p) => (
                  <li key={p.codigo} className="flex justify-between gap-3 text-xs text-tinta-3">
                    <span className="font-mono">{p.codigo}</span>
                    <span>{p.fecha === fechaElegida ? "en este día" : `el ${formatearFecha(p.fecha)}`}</span>
                  </li>
                ))}
              </ul>
            </details>
          )}

          {error && <p className="rounded-btn bg-mal-suave px-3 py-2 text-sm text-mal">{error}</p>}

          <div className="flex gap-2">
            {nuevos.length > 0 && (
              <button
                type="button"
                onClick={() => void confirmar()}
                disabled={!fechaValida || estado === "guardando"}
                className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-btn bg-acento px-4 text-sm font-semibold text-acento-texto disabled:opacity-50"
              >
                <Check className="size-4" />
                {estado === "guardando"
                  ? "Guardando…"
                  : `Añadir ${nuevos.length} ${nuevos.length === 1 ? "pedido nuevo" : "pedidos nuevos"}`}
              </button>
            )}
            <button
              type="button"
              onClick={() => setAbierto(false)}
              disabled={estado === "guardando"}
              className="boton-secundario"
            >
              {nuevos.length > 0 ? "Cancelar" : "Cerrar"}
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
            Una o varias capturas de la pestaña Órdenes, en el orden en que las tomaste. Los que ya
            estén registrados no se añaden.
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
