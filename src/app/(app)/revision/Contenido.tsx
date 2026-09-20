"use client";

import { useCapa } from "@/hooks/useCapa";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { CLAVE_REVISION } from "@/lib/carga";
import { Alerta, Check } from "@/components/iconos";
import { Aviso } from "@/components/ui";
import { confirmarJornada } from "./acciones";
import { FilaPedidoSimple } from "@/components/FilaPedidoSimple";
import { RE_CODIGO_PEDIDO } from "@/lib/extraccion/esquema";
import type { Alerta as AlertaValidacion } from "@/lib/extraccion/validar";
import type { JornadaFusionada } from "@/lib/extraccion/fusionar";
import { hoyEnLima } from "@/lib/fechas";
import {
  REGLA_INICIAL,
  TRAMO_MAS_DE_12_KM,
  formatearSoles,
  horasDePermanencia,
  montoPorPermanencia,
  pagoDelTramo,
  type ReglaPago,
} from "@/lib/pagos/reglas";

/**
 * Revisión (§4.7, §6, §13).
 *
 * Lista editable de rutas y pedidos, con la fecha de la jornada arriba —
 * grande y editable, porque una captura recortada puede no traerla y sin ella
 * no se sabe en qué semana entra el pago (§4.5).
 *
 * Todos los pedidos nacen en tramo 1. El driver solo toca los que pasaron de
 * 3 km, que es la excepción: así la carga diaria sigue siendo rápida.
 */

interface RespuestaExtraccion {
  // La ruta de extracción añade `tramo` a cada pedido antes de devolverlos:
  // todos nacen en tramo 1 y el driver solo toca las excepciones (§13).
  jornada: Omit<JornadaFusionada, "ordenes"> & {
    ordenes: (JornadaFusionada["ordenes"][number] & { tramo: number })[];
    /** Lo que se quitó por ser de la noche anterior o estar ya guardado. */
    descartes?: {
      rutas: JornadaFusionada["rutas"];
      ordenes: Array<JornadaFusionada["ordenes"][number] & { motivo: string }>;
    };
  };
  alertas: AlertaValidacion[];
  regla: ReglaPago;
  /** Horario propuesto desde el perfil; el driver lo corrige si el día cambió. */
  permanencia: {
    tiendaId: string | null;
    horaEntrada: string | null;
    horaSalida: string | null;
  } | null;
  imagenesLeidas: number;
  imagenesDescartadas: number;
  uso: { modelo: string; tokensEntrada: number; tokensSalida: number } | null;
}

interface PedidoEditable {
  codigo: string;
  estado: string;
  posicion: number;
  ruta: number | null;
  tramo: number;
  km: number | null;
  montoManualCentimos: number | null;
}

/**
 * Los días pendientes de revisar.
 *
 * Una carga puede traer varios: al final de la semana nadie va seleccionando
 * las capturas de tres en tres, sube el carrete entero. El sistema los separa
 * por fecha y Revisión los encadena, uno detrás de otro.
 */
function leerCola(): RespuestaExtraccion[] {
  try {
    const crudo = sessionStorage.getItem(CLAVE_REVISION);
    if (!crudo) return [];
    const guardado = JSON.parse(crudo) as { dias?: RespuestaExtraccion[] };
    return Array.isArray(guardado.dias) ? guardado.dias : [];
  } catch {
    return [];
  }
}

/** Quita el día ya guardado y deja el resto para la vuelta siguiente. */
function descartarPrimero(): number {
  try {
    const quedan = leerCola().slice(1);
    if (quedan.length === 0) sessionStorage.removeItem(CLAVE_REVISION);
    else sessionStorage.setItem(CLAVE_REVISION, JSON.stringify({ dias: quedan }));
    return quedan.length;
  } catch {
    return 0;
  }
}

export function Contenido({ alSiguiente }: { alSiguiente?: () => void } = {}) {
  const router = useRouter();
  const hoy = hoyEnLima();

  // Este componente solo se monta en cliente (ver page.tsx), así que se puede
  // leer sessionStorage en el inicializador en vez de sincronizarlo con un
  // efecto: menos renders y ningún desajuste de hidratación.
  const [cola] = useState<RespuestaExtraccion[]>(leerCola);
  const datos = cola[0] ?? null;
  const diasEnCola = cola.length;
  const [fecha, setFecha] = useState(() => datos?.jornada.fecha ?? "");
  const [pedidos, setPedidos] = useState<PedidoEditable[]>(() =>
    (datos?.jornada.ordenes ?? []).map((o) => ({
      codigo: o.codigo,
      estado: o.estado,
      posicion: o.posicion,
      ruta: o.ruta,
      tramo: o.tramo ?? 1,
      km: null,
      montoManualCentimos: null,
    })),
  );
  const [horaEntrada, setHoraEntrada] = useState(() => datos?.permanencia?.horaEntrada ?? "");
  const [horaSalida, setHoraSalida] = useState(() => datos?.permanencia?.horaSalida ?? "");
  // Por posición en la lista y no por código: el código también se puede corregir.
  const [editando, setEditando] = useState<number | null>(null);

  /* Lo descartado como arrastre se puede recuperar con un toque. La regla
     acierta casi siempre, pero si un día se equivoca, la persona tiene que
     poder deshacerlo sin volver a subir nada: es su dinero. */
  const [recuperados, setRecuperados] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const regla = datos?.regla ?? REGLA_INICIAL;

  const montoDe = useMemo(
    () => (p: PedidoEditable) =>
      p.tramo === TRAMO_MAS_DE_12_KM
        ? (p.montoManualCentimos ?? 0)
        : (pagoDelTramo(regla, p.tramo) ?? 0),
    [regla],
  );

  const totalPedidos = pedidos.reduce((acc, p) => acc + montoDe(p), 0);
  const fueraTramo1 = pedidos.filter((p) => p.tramo > 1).length;

  /* Garantía por permanencia (§13 bis): la tienda paga por hora de presencia y
     al cerrar el día paga el MAYOR de los dos. No se suman: compiten. */
  const pagaPermanencia = Boolean(regla.garantiaPermanencia?.activa);
  const horasEnTienda = horasDePermanencia(horaEntrada || null, horaSalida || null);
  const montoPermanencia =
    montoPorPermanencia(regla, horaEntrada || null, horaSalida || null) ?? 0;
  const ganaPermanencia = montoPermanencia > totalPedidos;
  const total = Math.max(totalPedidos, montoPermanencia);
  const sinTarifar = pedidos.filter(
    (p) => p.tramo === TRAMO_MAS_DE_12_KM && p.montoManualCentimos === null,
  );

  if (!datos) {
    return (
      <div className="mx-auto flex max-w-[880px] flex-col gap-4">
        <Aviso tono="atento" titulo="No hay ninguna carga en revisión">
          <p>
            Esta pantalla se abre sola después de subir las capturas. Vuelve a Hoy y toca «Cargar
            capturas».
          </p>
        </Aviso>
        <button type="button" className="boton-sec self-start" onClick={() => router.push("/")}>
          Ir a Hoy
        </button>
      </div>
    );
  }

  const { jornada, alertas } = datos;
  const bloqueos = alertas.filter((a) => a.nivel === "bloqueo");
  const avisos = alertas.filter((a) => a.nivel === "aviso");
  const informativas = alertas.filter((a) => a.nivel === "info");
  const descartes = datos?.jornada.descartes;
  const rutasDelDia = recuperados && descartes
    ? [...(datos?.jornada.rutas ?? []), ...descartes.rutas].sort((a, b) => a.numero - b.numero)
    : (datos?.jornada.rutas ?? []);

  const horaDeRuta = new Map(rutasDelDia.map((r) => [r.numero, r.hora_inicio]));
  const pedidosEnOrden = [...pedidos].sort((a, b) => {
    const ha = a.ruta === null ? "99:99" : (horaDeRuta.get(a.ruta) ?? "99:99");
    const hb = b.ruta === null ? "99:99" : (horaDeRuta.get(b.ruta) ?? "99:99");
    return ha.localeCompare(hb) || a.posicion - b.posicion;
  });

  function recuperarDescartados() {
    if (!descartes) return;
    setPedidos((lista) => [
      ...descartes.ordenes.map((o) => ({
        codigo: o.codigo,
        estado: o.estado,
        posicion: o.posicion,
        ruta: o.ruta,
        tramo: 1,
        km: null,
        montoManualCentimos: null,
      })),
      ...lista,
    ]);
    setRecuperados(true);
  }
  const faltaFecha = fecha === "";
  const fechaFutura = fecha !== "" && fecha > hoy;
  const puedeGuardar =
    !faltaFecha && !fechaFutura && sinTarifar.length === 0 && !guardando;

  const pedidosPorRuta = new Map<number | null, PedidoEditable[]>();
  for (const p of pedidos) {
    const lista = pedidosPorRuta.get(p.ruta) ?? [];
    lista.push(p);
    pedidosPorRuta.set(p.ruta, lista);
  }

  async function guardar() {
    setGuardando(true);
    setError(null);
    const resultado = await confirmarJornada({
      fecha,
      rutasDeclaradas: jornada.contadorRutas,
      ordenesDeclaradas: jornada.contadorOrdenes,
      validacionOk: bloqueos.length === 0,
      modo: "reemplazar",
      horaEntrada: horaEntrada || null,
      horaSalida: horaSalida || null,
      rutas: rutasDelDia.map((r) => ({
        numero: r.numero,
        estado: r.estado,
        horaInicio: r.hora_inicio,
        horaFin: r.hora_fin,
      })),
      ordenes: pedidos,
      uso: datos!.uso,
    });
    setGuardando(false);

    if (!resultado.ok) {
      setError(resultado.error);
      return;
    }
    const pendientes = descartarPrimero();
    if (pendientes > 0) {
      /* Quedan días de esta misma carga. La pantalla se monta de nuevo para
         que arranque limpia con el siguiente: reutilizar el estado del día
         anterior dejaría tramos y horarios del día que se acaba de guardar. */
      window.scrollTo({ top: 0 });
      alSiguiente?.();
      return;
    }
    router.push("/");
    router.refresh();
  }

  return (
    <div className="mx-auto flex max-w-[880px] flex-col gap-4">
      {diasEnCola > 1 && (
        <div className="flex items-center gap-3 rounded-btn bg-acento-suave px-4 py-3 text-sm text-acento-tinta">
          <b className="shrink-0 rounded-chip bg-acento px-2 py-0.5 text-xs font-bold text-acento-texto">
            1 de {diasEnCola}
          </b>
          <p>
            Tus capturas son de {diasEnCola} días distintos. Se guardan de uno en uno; al
            confirmar este pasarás al siguiente.
          </p>
        </div>
      )}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h2 className="text-[30px] leading-tight">Revisión</h2>
        <span className="rotulo">
          {datos.imagenesLeidas} captura{datos.imagenesLeidas === 1 ? "" : "s"} leída
          {datos.imagenesLeidas === 1 ? "" : "s"}
        </span>
      </div>

      {/* §4.5 — la fecha va arriba, grande y editable */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-card bg-acento-suave px-4 py-3">
        <div className="flex min-w-0 flex-col gap-0.5">
          <label
            htmlFor="fecha-jornada"
            className="text-xs font-bold tracking-wide text-acento-tinta uppercase"
          >
            Fecha de la jornada
          </label>
          <input
            id="fecha-jornada"
            type="date"
            value={fecha}
            max={hoy}
            onChange={(e) => setFecha(e.target.value)}
            className="max-w-full border-b-2 border-dashed border-acento bg-transparent pb-0.5 font-display text-[22px] font-bold text-tinta"
          />
        </div>
        <span className="max-w-[17em] text-xs text-acento-tinta">
          {jornada.fecha
            ? "Leída en el encabezado de la captura. Manda esta fecha, no la de hoy."
            : "No se pudo leer en las capturas. Elígela antes de guardar."}
        </span>
      </div>

      {datos.imagenesDescartadas > 0 && (
        <Aviso
          tono="atento"
          titulo={`Se descartaron ${datos.imagenesDescartadas} captura${datos.imagenesDescartadas === 1 ? "" : "s"}`}
        >
          <p>No se pudieron leer. Revisa que los totales de abajo cuadren.</p>
        </Aviso>
      )}

      {bloqueos.map((a) => (
        <Aviso key={a.codigo} tono="mal" titulo={a.mensaje}>
          {a.referencias && a.referencias.length > 0 && (
            <p className="font-mono text-xs">{a.referencias.join(", ")}</p>
          )}
        </Aviso>
      ))}

      {informativas.map((a) => (
        <Aviso key={a.codigo} tono="bien" titulo={recuperados && a.codigo === "arrastre-descartado"
          ? "Recuperados: estos pedidos se cuentan en este día."
          : a.mensaje}>
          {a.referencias && a.referencias.length > 0 && (
            <p className="font-mono text-xs">{a.referencias.join(", ")}</p>
          )}
          {a.codigo === "arrastre-descartado" && !recuperados && (
            <button
              type="button"
              onClick={recuperarDescartados}
              className="mt-2 min-h-11 rounded-btn border border-current px-3 text-sm font-semibold"
            >
              Contarlos igual en este día
            </button>
          )}
        </Aviso>
      ))}

      {avisos.map((a) => (
        <Aviso key={a.codigo} tono="atento" titulo={a.mensaje}>
          {a.referencias && a.referencias.length > 0 && (
            <p className="font-mono text-xs">{a.referencias.join(", ")}</p>
          )}
        </Aviso>
      ))}

      {bloqueos.length === 0 && avisos.length === 0 && (
        <Aviso tono="bien" titulo="Los totales cuadran">
          <p>
            {rutasDelDia.length} rutas y {pedidos.length} pedidos, igual que los contadores de la
            captura.
          </p>
        </Aviso>
      )}

      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-col gap-0.5">
          <span className="font-display text-[44px] leading-none font-bold tracking-tight text-acento tabular-nums">
            {formatearSoles(total)}
          </span>
          <span className="text-sm text-tinta-2">
            {pedidos.length} pedidos · {rutasDelDia.length} rutas
          </span>
        </div>
        <span className="rotulo">{fueraTramo1} fuera del tramo 1</span>
      </div>

      {/* §13 bis — permanencia en tienda.
          Las horas no vienen de las capturas: se proponen desde el horario del
          perfil y se corrigen aquí el día que se entre tarde o se salga antes. */}
      {pagaPermanencia && (
        <section className="flex flex-col gap-3 rounded-card bg-sup-2 p-4">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <span className="rotulo">Permanencia en tienda</span>
            <span className="text-xs text-tinta-3">
              {formatearSoles(Math.round((regla.garantiaPermanencia?.solesPorHora ?? 0) * 100))} por
              hora
            </span>
          </div>

          <div className="flex flex-wrap items-end gap-3">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="hora-entrada" className="text-sm font-semibold">
                Entrada
              </label>
              <input
                id="hora-entrada"
                type="time"
                value={horaEntrada}
                onChange={(e) => setHoraEntrada(e.target.value)}
                className="min-h-11 rounded-btn border border-linea-fuerte bg-sup px-3 font-mono text-base"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="hora-salida" className="text-sm font-semibold">
                Salida
              </label>
              <input
                id="hora-salida"
                type="time"
                value={horaSalida}
                onChange={(e) => setHoraSalida(e.target.value)}
                className="min-h-11 rounded-btn border border-linea-fuerte bg-sup px-3 font-mono text-base"
              />
            </div>
            <p className="pb-2 text-sm text-tinta-2">
              {horasEnTienda > 0
                ? `${horasEnTienda} h → ${formatearSoles(montoPermanencia)}`
                : "Pon tu horario para que cuente la permanencia."}
            </p>
          </div>

          {/* Se paga el mayor de los dos, no la suma. Decirlo así evita que
              alguien lea el total como si fuera pedidos + permanencia. */}
          <dl className="flex flex-col border-t border-linea pt-3">
            <div className="flex items-baseline justify-between gap-3 py-1 text-sm">
              <dt className={ganaPermanencia ? "text-tinta-3" : "font-semibold"}>Por pedidos</dt>
              <dd
                className={`font-mono tabular-nums ${ganaPermanencia ? "text-tinta-3 line-through" : "font-semibold"}`}
              >
                {formatearSoles(totalPedidos)}
              </dd>
            </div>
            <div className="flex items-baseline justify-between gap-3 py-1 text-sm">
              <dt className={ganaPermanencia ? "font-semibold" : "text-tinta-3"}>
                Por permanencia
              </dt>
              <dd
                className={`font-mono tabular-nums ${ganaPermanencia ? "font-semibold" : "text-tinta-3 line-through"}`}
              >
                {formatearSoles(montoPermanencia)}
              </dd>
            </div>
          </dl>

          {ganaPermanencia ? (
            <Aviso tono="bien" titulo="Hoy te cubre la permanencia">
              <p>
                Tus pedidos suman {formatearSoles(totalPedidos)}, por debajo del piso de{" "}
                {formatearSoles(montoPermanencia)}. Cobras el piso: la diferencia son{" "}
                {formatearSoles(montoPermanencia - totalPedidos)} a tu favor.
              </p>
            </Aviso>
          ) : (
            horasEnTienda > 0 && (
              <p className="text-sm text-tinta-2">
                Los pedidos superan el piso de {formatearSoles(montoPermanencia)}, así que cobras por
                pedido. Se paga el mayor de los dos, nunca la suma.
              </p>
            )
          )}
        </section>
      )}

      <p className="text-sm text-tinta-2">
        Todos los pedidos entran en el tramo 1 (0 a 3 km). Toca solo los que pasaron de 3 km.
      </p>

      {/* Un pedido por fila: el código, y al lado su ruta con la hora y el
          estado. En el orden en que se hicieron —por la hora de su ruta— y los
          que no tienen ruta al final, donde se ven y se tocan para asignarla. */}
      <div className="overflow-hidden rounded-card border border-linea bg-sup">
        {pedidosEnOrden.length === 0 ? (
          <p className="px-4 py-6 text-sm text-tinta-3">No se leyó ningún pedido.</p>
        ) : (
          pedidosEnOrden.map((p) => (
            <FilaPedidoSimple
              key={p.codigo}
              codigo={p.codigo}
              ruta={p.ruta}
              hora={p.ruta !== null ? (horaDeRuta.get(p.ruta) ?? null) : null}
              estado={p.estado}
              tramo={p.tramo}
              monto={
                p.tramo === TRAMO_MAS_DE_12_KM && p.montoManualCentimos === null
                  ? "falta monto"
                  : formatearSoles(montoDe(p))
              }
              onClick={() => setEditando(pedidos.indexOf(p))}
            />
          ))
        )}
      </div>

      {error && <Aviso tono="mal" titulo="No se pudo guardar">{error}</Aviso>}

      <div className="sticky bottom-0 -mx-4 -mb-16 border-t border-linea bg-papel/90 px-4 pt-3 pb-[calc(1rem+env(safe-area-inset-bottom,0px))] backdrop-blur-md">
        <div className="mx-auto max-w-[880px]">
          <button
            type="button"
            className="boton-principal"
            disabled={!puedeGuardar}
            onClick={() => void guardar()}
          >
            <Check className="size-[22px]" />
            {guardando ? "Guardando…" : "Confirmar y guardar"}
          </button>
          {faltaFecha && (
            <p className="mt-2 flex items-center gap-2 text-xs text-aviso">
              <Alerta className="size-4" /> Elige la fecha de la jornada para poder guardar.
            </p>
          )}
          {sinTarifar.length > 0 && (
            <p className="mt-2 flex items-center gap-2 text-xs text-aviso">
              <Alerta className="size-4" /> Falta el monto de {sinTarifar.length} pedido
              {sinTarifar.length === 1 ? "" : "s"} de más de 12 km.
            </p>
          )}
        </div>
      </div>

      {editando !== null && pedidos[editando] && (
        <HojaPedido
          pedido={pedidos[editando]}
          regla={regla}
          rutas={rutasDelDia.map((r) => ({ numero: r.numero, inicio: r.hora_inicio }))}
          otrosCodigos={pedidos.filter((_, i) => i !== editando).map((p) => p.codigo)}
          onCerrar={() => setEditando(null)}
          onGuardar={(cambios, cerrar = true) => {
            setPedidos((lista) => lista.map((p, i) => (i === editando ? { ...p, ...cambios } : p)));
            if (cerrar) setEditando(null);
          }}
          onBorrar={() => {
            setPedidos((lista) => lista.filter((_, i) => i !== editando));
            setEditando(null);
          }}
        />
      )}
    </div>
  );
}


/* --------------------------------------------------------------------------
 * Hoja inferior con los cinco tramos (§13)
 * ------------------------------------------------------------------------ */

const ESTADOS_EDITABLES = ["Entregado", "Entrega parcial", "No entregado"] as const;

/**
 * Corregir un pedido: su código, su ruta, su estado y su tramo, o borrarlo.
 *
 * Existe porque el lector se equivoca, y cuando se equivoca la única salida
 * que había era aceptar el dato malo o no guardar el día. El código se puede
 * reescribir —si leyó un 3 por un 8—, la ruta elegir de la lista, y el pedido
 * entero borrar si nunca debió estar.
 *
 * Borrar pide confirmación porque no se puede deshacer desde aquí. El resto se
 * aplica al momento: es fácil de volver a cambiar.
 */
function HojaPedido({
  pedido,
  regla,
  rutas,
  otrosCodigos,
  onCerrar,
  onGuardar,
  onBorrar,
}: {
  pedido: PedidoEditable;
  regla: ReglaPago;
  rutas: Array<{ numero: number; inicio: string | null }>;
  otrosCodigos: string[];
  onCerrar: () => void;
  onGuardar: (cambios: Partial<PedidoEditable>, cerrar?: boolean) => void;
  onBorrar: () => void;
}) {
  const [codigo, setCodigo] = useState(pedido.codigo);
  const [confirmandoBorrado, setConfirmandoBorrado] = useState(false);
  const codigoLimpio = codigo.trim().toLowerCase();
  const errorCodigo = !RE_CODIGO_PEDIDO.test(codigoLimpio)
    ? "Debe tener la forma v12238726wofp-01."
    : otrosCodigos.includes(codigoLimpio)
      ? "Ese código ya está en la lista: un pedido no se cuenta dos veces."
      : null;
  const [km, setKm] = useState(pedido.km === null ? "" : String(pedido.km));
  const [manual, setManual] = useState(
    pedido.montoManualCentimos === null ? "" : String(pedido.montoManualCentimos / 100),
  );

  useEffect(() => {
    function alPulsar(e: KeyboardEvent) {
      if (e.key === "Escape") onCerrar();
    }
    document.addEventListener("keydown", alPulsar);
    return () => document.removeEventListener("keydown", alPulsar);
  }, [onCerrar]);

  useCapa(onCerrar);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center sm:p-5"
      onClick={(e) => {
        if (e.target === e.currentTarget) onCerrar();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Corregir el pedido"
        className="flex max-h-[92dvh] w-full max-w-md flex-col gap-4 overflow-y-auto rounded-t-hoja bg-sup px-4 pt-4 pb-[calc(1.25rem+env(safe-area-inset-bottom,0px))] shadow-alta sm:rounded-hoja sm:pb-5"
      >
        <span className="mx-auto h-1 w-9 rounded-full bg-linea-fuerte sm:hidden" />

        <div>
          <h3 className="text-[22px]">Corregir el pedido</h3>
          <p className="text-sm text-tinta-2">
            Compara con tu captura y cambia lo que el lector haya tomado mal.
          </p>
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="codigo-pedido" className="text-sm font-semibold">
            Código del pedido
          </label>
          <div className="flex gap-2">
            <input
              id="codigo-pedido"
              value={codigo}
              onChange={(e) => setCodigo(e.target.value)}
              autoCapitalize="off"
              autoCorrect="off"
              spellCheck={false}
              className="min-h-11 flex-1 rounded-btn border border-linea-fuerte bg-sup px-3 font-mono text-base"
            />
            <button
              type="button"
              className="boton-sec"
              disabled={codigoLimpio === pedido.codigo || errorCodigo !== null}
              onClick={() => onGuardar({ codigo: codigoLimpio }, false)}
            >
              Cambiar
            </button>
          </div>
          {codigoLimpio !== pedido.codigo && errorCodigo && (
            <p className="text-xs text-mal">{errorCodigo}</p>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-semibold">Ruta</span>
            <select
              value={pedido.ruta ?? ""}
              onChange={(e) =>
                onGuardar({ ruta: e.target.value === "" ? null : Number(e.target.value) }, false)
              }
              className="min-h-11 rounded-btn border border-linea-fuerte bg-sup px-2 text-base"
            >
              <option value="">Sin ruta</option>
              {rutas.map((r) => (
                <option key={r.numero} value={r.numero}>
                  Ruta {r.numero}
                  {r.inicio ? ` · ${r.inicio}` : ""}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-semibold">Estado</span>
            <select
              value={pedido.estado}
              onChange={(e) => onGuardar({ estado: e.target.value }, false)}
              className="min-h-11 rounded-btn border border-linea-fuerte bg-sup px-2 text-base"
            >
              {ESTADOS_EDITABLES.map((e) => (
                <option key={e} value={e}>
                  {e}
                </option>
              ))}
            </select>
          </label>
        </div>

        <h4 className="border-t border-linea pt-4 text-sm font-semibold">
          Tramo de distancia
        </h4>

        <div role="radiogroup" aria-label="Tramo de distancia" className="flex flex-col gap-2">
          {regla.tramos.map((t) => (
            <button
              key={t.id}
              type="button"
              role="radio"
              aria-checked={pedido.tramo === t.id}
              onClick={() => onGuardar({ tramo: t.id, km: null, montoManualCentimos: null })}
              className={`flex min-h-[54px] items-center gap-3 rounded-btn border px-3 py-2 text-left ${
                pedido.tramo === t.id
                  ? "border-acento bg-acento-suave"
                  : "border-linea-fuerte hover:bg-sup-2"
              }`}
            >
              <span
                className={`grid size-7 shrink-0 place-items-center rounded-chip font-mono text-xs font-medium ${
                  pedido.tramo === t.id ? "bg-acento text-acento-texto" : "bg-sup-2"
                }`}
              >
                {t.id}
              </span>
              <span className="flex flex-1 flex-col">
                <b className="text-sm font-bold">
                  {t.desde} a {t.hasta} km
                </b>
                <span className="text-xs text-tinta-3">
                  {t.id === 1 ? "el caso normal" : "excepción, se marca a mano"}
                </span>
              </span>
              <span className="monto">{formatearSoles(Math.round(t.monto * 100))}</span>
            </button>
          ))}
        </div>

        <div className="flex flex-col gap-2 border-t border-linea pt-4">
          <label htmlFor="km-exactos" className="text-sm font-semibold">
            O escribe los km exactos
          </label>
          <div className="flex gap-2">
            <input
              id="km-exactos"
              type="number"
              inputMode="decimal"
              step="0.1"
              min="0"
              placeholder="3.5"
              value={km}
              onChange={(e) => setKm(e.target.value)}
              className="min-h-11 flex-1 rounded-btn border border-linea-fuerte bg-sup px-4 text-base"
            />
            <button
              type="button"
              className="boton-sec"
              disabled={km === ""}
              onClick={() => {
                const valor = Number(km);
                if (Number.isNaN(valor)) return;
                const ordenados = [...regla.tramos].sort((a, b) => a.hasta - b.hasta);
                const t = ordenados.find((x) => valor <= x.hasta);
                onGuardar({
                  tramo: t ? t.id : TRAMO_MAS_DE_12_KM,
                  km: valor,
                  montoManualCentimos: null,
                });
              }}
            >
              Aplicar
            </button>
          </div>
          <p className="text-xs text-tinta-3">
            El valor exacto del límite entra en el tramo de abajo: 3.0 km paga S/ 10.00 y 3.1 km
            paga S/ 11.50.
          </p>
        </div>

        {/* §17.2 sigue abierto: la tarifa no cubre más de 12 km. */}
        <div className="flex flex-col gap-2 border-t border-linea pt-4">
          <label htmlFor="monto-manual" className="text-sm font-semibold">
            Más de 12 km
          </label>
          <div className="flex gap-2">
            <input
              id="monto-manual"
              type="number"
              inputMode="decimal"
              step="0.5"
              min="0"
              placeholder="18.00"
              value={manual}
              onChange={(e) => setManual(e.target.value)}
              className="min-h-11 flex-1 rounded-btn border border-linea-fuerte bg-sup px-4 text-base"
            />
            <button
              type="button"
              className="boton-sec"
              disabled={manual === ""}
              onClick={() => {
                const valor = Number(manual);
                if (Number.isNaN(valor)) return;
                onGuardar({
                  tramo: TRAMO_MAS_DE_12_KM,
                  km: null,
                  montoManualCentimos: Math.round(valor * 100),
                });
              }}
            >
              Aplicar
            </button>
          </div>
          <p className="text-xs text-tinta-3">
            La tarifa de la tienda no cubre este caso todavía. El monto se escribe a mano y queda
            señalado en la liquidación.
          </p>
        </div>

        <div className="border-t border-linea pt-4">
          {confirmandoBorrado ? (
            <div className="flex flex-col gap-3 rounded-btn bg-mal-suave p-3">
              <p className="text-sm text-mal">
                ¿Borrar el pedido <b className="font-mono">{pedido.codigo}</b>? No se contará ni se
                pagará en este día.
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={onBorrar}
                  className="min-h-11 flex-1 rounded-btn bg-mal px-4 text-sm font-semibold text-white"
                >
                  Sí, borrarlo
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmandoBorrado(false)}
                  className="boton-sec flex-1"
                >
                  No
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setConfirmandoBorrado(true)}
              className="min-h-11 w-full rounded-btn px-4 text-sm font-semibold text-mal"
            >
              Borrar este pedido
            </button>
          )}
        </div>

        <button type="button" className="boton-sec" onClick={onCerrar}>
          Listo
        </button>
      </div>
    </div>
  );
}
