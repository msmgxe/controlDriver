"use client";

import Link from "next/link";
import { useEffect, useState, useTransition } from "react";

import {
  cambiarTramoDePedido,
  corregirPedido,
  eliminarPedido,
  fijarDistanciaDePedido,
  guardarClienteDePedido,
  quitarClienteDePedido,
} from "@/app/(app)/jornada/acciones";
import { Alerta, Camara, Check, Equis, Ojo, Pin, Telefono, Ticket } from "@/components/iconos";
import { Pestanas } from "@/components/Pestanas";
import { RadarDeTramos } from "@/components/RadarDeTramos";
import { Aviso } from "@/components/ui";
import { useCapa } from "@/hooks/useCapa";
import { comprimir } from "@/lib/carga";
import { partirDireccion, consultaParaMapa } from "@/lib/comanda/interpretar";
import { leerFotoDeComandas } from "@/lib/comanda/leer";
import type { AjustesDeComandas } from "@/lib/db/sqlite/ajustes";
import { esCodigoPendiente } from "@/lib/db/sqlite/jornadas";
import { borrarPrueba, contenidoDePrueba, guardarPrueba, pruebaDeOrden, type Prueba } from "@/lib/db/sqlite/pruebas";
import type { OrdenFila, Tienda } from "@/lib/db/tipos";
import { nombreDelDia, type FechaISO } from "@/lib/fechas";
import { esPuntoValido, kmEnLinea, type Punto } from "@/lib/geo/distancia";
import { enlaceDeBusqueda, enlaceDeMapa } from "@/lib/geo/enlaces";
import { buscarDireccion, resolverEnlace, rutaPorCalles, type Candidato } from "@/lib/geo/nativo";
import { aDecimas, distanciaAlCliente, tramoPorDistancia, type Distancia } from "@/lib/geo/tramo";
import { TRAMO_MAS_DE_12_KM, formatearSoles, type ReglaPago } from "@/lib/pagos/reglas";

/**
 * La hoja de un pedido, con pestañas: **Pedido**, **Cliente**, **Distancia** y
 * **Evidencia**.
 *
 * Antes era una sola hoja larga con todo junto. Con pestañas cada cosa tiene su
 * sitio y la hoja no se carga: se ve lo del pedido, y el cliente, la distancia
 * y la foto están a un toque. Un punto junto al nombre de la pestaña avisa que
 * hay algo guardado ahí.
 *
 * Lo del cliente es **opcional en todo**: son datos de otra persona. Se guarda
 * lo que la persona escribe o lo que se leyó de su comanda, y nada más.
 */

const ESTADOS = ["Entregado", "Entrega parcial", "No entregado"] as const;

const ETIQUETA_FUENTE = {
  recta: "en línea recta",
  ruta: "por calles",
  estimado: "por calles, estimada",
  manual: "escrita a mano",
} as const;

export function HojaDePedido({
  fecha,
  orden,
  regla,
  rutas,
  tienda,
  ajustes,
  editable,
  pestanaInicial = "pedido",
  alCerrar,
  alCambiar,
}: {
  fecha: FechaISO;
  orden: OrdenFila;
  regla: ReglaPago;
  rutas: Array<{ numero: number; inicio: string | null }>;
  tienda: Tienda | null;
  ajustes: AjustesDeComandas;
  /** Falso en una semana ya pagada: se ve todo, no se cambia nada. */
  editable: boolean;
  pestanaInicial?: string;
  alCerrar: () => void;
  /** Vuelve a leer el día tras un cambio. */
  alCambiar: () => void;
}) {
  const [pestana, setPestana] = useState(pestanaInicial);
  const [pendiente, iniciar] = useTransition();
  const [aviso, setAviso] = useState<{ tono: "bien" | "mal"; texto: string } | null>(null);

  // El formulario del cliente vive aquí, no en su pestaña: la lectura de una
  // foto, que se hace desde «Evidencia», tiene que poder rellenarlo.
  const [nombre, setNombre] = useState(orden.cliente?.nombre ?? "");
  const [telefono, setTelefono] = useState(orden.cliente?.telefono ?? "");
  const [direccion, setDireccion] = useState(orden.cliente?.direccion ?? "");

  // El botón «atrás» de Android y la tecla Escape cierran la hoja.
  useCapa(alCerrar);

  function ejecutar(
    accion: () => Promise<{ ok: true; mensaje: string } | { ok: false; error: string }>,
    alTerminar?: () => void,
  ) {
    setAviso(null);
    iniciar(async () => {
      const r = await accion();
      setAviso(r.ok ? { tono: "bien", texto: r.mensaje } : { tono: "mal", texto: r.error });
      if (r.ok) {
        alTerminar?.();
        alCambiar();
      }
    });
  }

  const sinCodigo = esCodigoPendiente(orden.codigo);
  const ruta = orden.ruta !== null ? rutas.find((r) => r.numero === orden.ruta) : null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center sm:p-5"
      onClick={(e) => {
        if (e.target === e.currentTarget) alCerrar();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="El pedido"
        className="flex max-h-[92dvh] w-full max-w-md flex-col overflow-hidden rounded-t-hoja bg-sup shadow-alta sm:rounded-hoja"
      >
        <div className="flex flex-col gap-3 px-4 pt-3 pb-3">
          <span className="mx-auto h-1 w-9 rounded-full bg-linea-fuerte sm:hidden" />
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h3 className="truncate font-mono text-[19px] leading-tight normal-case [zoom:1]">
                {sinCodigo ? "Pedido sin código" : orden.codigo}
              </h3>
              <p className="text-sm text-tinta-2">
                <span className="capitalize">{nombreDelDia(fecha)}</span> {Number(fecha.slice(8))} ·{" "}
                {ruta ? `Ruta ${ruta.numero}${ruta.inicio ? ` · ${ruta.inicio}` : ""}` : "Sin ruta"}
              </p>
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

          <Pestanas
            etiqueta="Datos del pedido"
            actual={pestana}
            alCambiar={(id) => {
              setPestana(id);
              setAviso(null);
            }}
            items={[
              { id: "pedido", etiqueta: "Pedido" },
              { id: "cliente", etiqueta: "Cliente", punto: orden.cliente !== null },
              { id: "distancia", etiqueta: "Distancia", punto: orden.km !== null },
              { id: "evidencia", etiqueta: "Evidencia", punto: orden.fotos > 0 },
            ]}
          />
        </div>

        <div className="flex flex-1 flex-col gap-4 overflow-y-auto px-4 pb-[calc(1.25rem+env(safe-area-inset-bottom,0px))]">
          {!editable && (
            <Aviso tono="atento" titulo="Esta semana ya está pagada">
              <p>Se puede ver todo, pero no cambiar nada. Reabre la semana desde Pagos para corregir.</p>
            </Aviso>
          )}
          {aviso && <Aviso tono={aviso.tono} titulo={aviso.texto} />}

          {pestana === "pedido" && (
            <TabPedido
              fecha={fecha}
              orden={orden}
              regla={regla}
              rutas={rutas}
              deshabilitado={!editable || pendiente}
              ejecutar={ejecutar}
              alBorrar={alCerrar}
            />
          )}
          {pestana === "cliente" && (
            <TabCliente
              fecha={fecha}
              orden={orden}
              nombre={nombre}
              telefono={telefono}
              direccion={direccion}
              setNombre={setNombre}
              setTelefono={setTelefono}
              setDireccion={setDireccion}
              deshabilitado={!editable || pendiente}
              ejecutar={ejecutar}
              alIrADistancia={() => setPestana("distancia")}
              hayTienda={tienda?.lat != null}
            />
          )}
          {pestana === "distancia" && (
            <TabDistancia
              fecha={fecha}
              orden={orden}
              regla={regla}
              tienda={tienda}
              ajustes={ajustes}
              deshabilitado={!editable || pendiente}
              ejecutar={ejecutar}
              direccion={direccion || orden.cliente?.direccion || ""}
            />
          )}
          {pestana === "evidencia" && (
            <TabEvidencia
              fecha={fecha}
              orden={orden}
              deshabilitado={!editable || pendiente}
              alCambiar={alCambiar}
              alLeer={(datos) => {
                if (datos.nombre) setNombre(datos.nombre);
                if (datos.telefono) setTelefono(datos.telefono);
                if (datos.direccion) setDireccion(datos.direccion);
                setPestana("cliente");
                setAviso({ tono: "bien", texto: "Leído de la foto. Revisa los datos y guárdalos." });
              }}
            />
          )}

          <button type="button" className="boton-sec" onClick={alCerrar} disabled={pendiente}>
            {pendiente ? (
              "Guardando…"
            ) : (
              <>
                <Check className="size-4" />
                Cerrar
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

type Ejecutar = (
  accion: () => Promise<{ ok: true; mensaje: string } | { ok: false; error: string }>,
  alTerminar?: () => void,
) => void;

/* ---------------------------------------------------------------------------
 * Pestaña «Pedido»
 * ------------------------------------------------------------------------- */

function TabPedido({
  fecha,
  orden,
  regla,
  rutas,
  deshabilitado,
  ejecutar,
  alBorrar,
}: {
  fecha: FechaISO;
  orden: OrdenFila;
  regla: ReglaPago;
  rutas: Array<{ numero: number; inicio: string | null }>;
  deshabilitado: boolean;
  ejecutar: Ejecutar;
  alBorrar: () => void;
}) {
  const [codigo, setCodigo] = useState(orden.codigo);
  const [manual, setManual] = useState("");
  const [confirmandoBorrado, setConfirmandoBorrado] = useState(false);

  const alTramo = (tramo: number, montoManualCentimos: number | null = null) =>
    ejecutar(() =>
      cambiarTramoDePedido({
        fecha,
        ordenId: orden.id,
        tramo,
        km: null,
        montoManualCentimos,
        // Elegirlo a mano no borra los kilómetros que ya se habían calculado.
        conservarKm: true,
      }),
    );

  return (
    <>
      <div className="flex flex-col gap-1.5">
        <label htmlFor="codigo-guardado" className="text-sm font-semibold">
          Código del pedido
        </label>
        <div className="flex gap-2">
          <input
            id="codigo-guardado"
            value={codigo}
            onChange={(e) => setCodigo(e.target.value)}
            autoCapitalize="off"
            autoCorrect="off"
            spellCheck={false}
            disabled={deshabilitado}
            className="min-h-11 min-w-0 flex-1 rounded-btn border border-linea-fuerte bg-sup px-3 font-mono text-base"
          />
          <button
            type="button"
            className="boton-sec"
            disabled={deshabilitado || codigo.trim().toLowerCase() === orden.codigo}
            onClick={() => ejecutar(() => corregirPedido(fecha, orden.id, { codigo }))}
          >
            Cambiar
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-semibold">Ruta</span>
          <select
            value={orden.ruta ?? ""}
            disabled={deshabilitado}
            onChange={(e) =>
              ejecutar(() => corregirPedido(fecha, orden.id, { ruta: e.target.value === "" ? null : Number(e.target.value) }))
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
            value={orden.estado}
            disabled={deshabilitado}
            onChange={(e) => ejecutar(() => corregirPedido(fecha, orden.id, { estado: e.target.value }))}
            className="min-h-11 rounded-btn border border-linea-fuerte bg-sup px-2 text-base"
          >
            {ESTADOS.map((e) => (
              <option key={e} value={e}>
                {e}
              </option>
            ))}
          </select>
        </label>
      </div>

      <h4 className="border-t border-linea pt-4 text-sm font-semibold">Tramo de distancia</h4>

      {orden.tramoAuto && orden.km !== null && (
        <Aviso tono="bien" titulo="Calculado con la distancia">
          <p>
            {orden.km.toFixed(1)} km {orden.kmFuente ? ETIQUETA_FUENTE[orden.kmFuente] : ""}. Elige otro tramo
            para cambiarlo a mano: los kilómetros se conservan.
          </p>
        </Aviso>
      )}

      <div role="radiogroup" aria-label="Tramo de distancia" className="flex flex-col gap-2">
        {regla.tramos.map((t) => (
          <button
            key={t.id}
            type="button"
            role="radio"
            aria-checked={orden.tramo === t.id}
            disabled={deshabilitado}
            onClick={() => alTramo(t.id)}
            className={`flex min-h-[54px] items-center gap-3 rounded-btn border px-3 py-2 text-left ${
              orden.tramo === t.id ? "border-acento bg-acento-suave" : "border-linea-fuerte hover:bg-sup-2"
            }`}
          >
            <span
              className={`grid size-7 shrink-0 place-items-center rounded-chip font-mono text-xs font-medium ${
                orden.tramo === t.id ? "bg-acento text-acento-texto" : "bg-sup-2"
              }`}
            >
              {t.id}
            </span>
            <span className="flex flex-1 flex-col">
              <b className="text-sm font-bold">
                {t.desde} a {t.hasta} km
              </b>
            </span>
            <span className="monto">{formatearSoles(Math.round(t.monto * 100))}</span>
          </button>
        ))}
      </div>

      <div className="flex flex-col gap-2 border-t border-linea pt-4">
        <label htmlFor="det-manual" className="text-sm font-semibold">
          Más de 12 km{orden.tramo === TRAMO_MAS_DE_12_KM ? ` · ahora ${formatearSoles(orden.montoCentimos ?? 0)}` : ""}
        </label>
        <div className="flex gap-2">
          <input
            id="det-manual"
            type="number"
            inputMode="decimal"
            step="0.5"
            min="0"
            placeholder="18.00"
            value={manual}
            disabled={deshabilitado}
            onChange={(e) => setManual(e.target.value)}
            className="min-h-11 min-w-0 flex-1 rounded-btn border border-linea-fuerte bg-sup px-4 text-base"
          />
          <button
            type="button"
            className="boton-sec"
            disabled={deshabilitado || manual === ""}
            onClick={() => {
              const valor = Number(manual);
              if (Number.isNaN(valor)) return;
              alTramo(TRAMO_MAS_DE_12_KM, Math.round(valor * 100));
              setManual("");
            }}
          >
            Aplicar
          </button>
        </div>
      </div>

      {/* Borrar pide confirmación: no se puede deshacer, y en un día guardado
          el pedido ya cuenta para el pago de la semana. */}
      <div className="border-t border-linea pt-4">
        {confirmandoBorrado ? (
          <div className="flex flex-col gap-3 rounded-btn bg-mal-suave p-3">
            <p className="text-sm text-mal">
              ¿Borrar el pedido <b className="font-mono">{orden.codigo}</b>? Dejará de contar para el pago de
              esta semana.
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => ejecutar(() => eliminarPedido(fecha, orden.id), alBorrar)}
                disabled={deshabilitado}
                className="min-h-11 flex-1 rounded-btn bg-mal px-4 text-sm font-semibold text-white"
              >
                Sí, borrarlo
              </button>
              <button type="button" onClick={() => setConfirmandoBorrado(false)} className="boton-sec flex-1">
                No
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setConfirmandoBorrado(true)}
            disabled={deshabilitado}
            className="min-h-11 w-full rounded-btn px-4 text-sm font-semibold text-mal disabled:opacity-50"
          >
            Borrar este pedido
          </button>
        )}
      </div>
    </>
  );
}

/* ---------------------------------------------------------------------------
 * Pestaña «Cliente»
 * ------------------------------------------------------------------------- */

/** Solo los dígitos de un teléfono, para `tel:` y WhatsApp. */
const digitos = (t: string) => t.replace(/\D/g, "");

function TabCliente({
  fecha,
  orden,
  nombre,
  telefono,
  direccion,
  setNombre,
  setTelefono,
  setDireccion,
  deshabilitado,
  ejecutar,
  alIrADistancia,
  hayTienda,
}: {
  fecha: FechaISO;
  orden: OrdenFila;
  nombre: string;
  telefono: string;
  direccion: string;
  setNombre: (v: string) => void;
  setTelefono: (v: string) => void;
  setDireccion: (v: string) => void;
  deshabilitado: boolean;
  ejecutar: Ejecutar;
  alIrADistancia: () => void;
  hayTienda: boolean;
}) {
  const [confirmando, setConfirmando] = useState(false);
  const guardado = orden.cliente;
  const cambio =
    (nombre.trim() || null) !== (guardado?.nombre ?? null) ||
    (telefono.trim() || null) !== (guardado?.telefono ?? null) ||
    (direccion.trim() || null) !== (guardado?.direccion ?? null);
  const tel = digitos(telefono);
  // Un celular de Lima son 9 dígitos; con el 51 delante, 11.
  const paraWhatsApp = tel.length === 9 ? `51${tel}` : tel.length === 11 && tel.startsWith("51") ? tel : null;

  return (
    <>
      <Campo etiqueta="Nombre del cliente" opcional>
        <input
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          disabled={deshabilitado}
          autoComplete="off"
          className="min-h-11 w-full rounded-btn border border-linea-fuerte bg-sup px-3 text-base"
        />
      </Campo>
      <Campo etiqueta="Teléfono" opcional>
        <input
          value={telefono}
          onChange={(e) => setTelefono(e.target.value)}
          disabled={deshabilitado}
          inputMode="tel"
          autoComplete="off"
          placeholder="9xx xxx xxx"
          className="min-h-11 w-full rounded-btn border border-linea-fuerte bg-sup px-3 font-mono text-base"
        />
      </Campo>
      <Campo etiqueta="Dirección" opcional>
        <input
          value={direccion}
          onChange={(e) => setDireccion(e.target.value)}
          disabled={deshabilitado}
          autoComplete="off"
          placeholder="Calle y número, distrito"
          className="min-h-11 w-full rounded-btn border border-linea-fuerte bg-sup px-3 text-base"
        />
        <span className="text-xs text-tinta-3">Con la dirección se calcula la distancia y el tramo.</span>
      </Campo>

      <button
        type="button"
        className="boton-principal !min-h-12 !text-lg"
        disabled={deshabilitado || !cambio}
        onClick={() =>
          ejecutar(
            () => guardarClienteDePedido(fecha, orden.id, { nombre, telefono, direccion }),
            // Con dirección nueva y una tienda ubicada, lo siguiente es medir.
            () => {
              if (direccion.trim() && direccion.trim() !== (guardado?.direccion ?? "") && hayTienda) alIrADistancia();
            },
          )
        }
      >
        Guardar datos del cliente
      </button>

      {guardado?.telefono && (
        <div className="grid grid-cols-2 gap-2">
          <a className="boton-sec" href={`tel:+51${digitos(guardado.telefono).slice(-9)}`}>
            <Telefono className="size-4" />
            Llamar
          </a>
          {paraWhatsApp ? (
            <a className="boton-sec" href={`https://wa.me/${paraWhatsApp}`} target="_blank" rel="noreferrer">
              WhatsApp
            </a>
          ) : (
            <span />
          )}
        </div>
      )}

      {guardado &&
        (confirmando ? (
          <div className="flex flex-col gap-3 rounded-btn bg-mal-suave p-3">
            <p className="text-sm text-mal">
              ¿Quitar todo lo del cliente de este pedido? También se borran su ubicación y la distancia. El tramo y el
              monto no cambian.
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={deshabilitado}
                onClick={() =>
                  ejecutar(
                    () => quitarClienteDePedido(fecha, orden.id),
                    () => {
                      setNombre("");
                      setTelefono("");
                      setDireccion("");
                      setConfirmando(false);
                    },
                  )
                }
                className="min-h-11 flex-1 rounded-btn bg-mal px-4 text-sm font-semibold text-white"
              >
                Sí, quitarlo
              </button>
              <button type="button" onClick={() => setConfirmando(false)} className="boton-sec flex-1">
                No
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setConfirmando(true)}
            disabled={deshabilitado}
            className="min-h-11 w-full rounded-btn px-4 text-sm font-semibold text-mal disabled:opacity-50"
          >
            Quitar los datos del cliente
          </button>
        ))}

      <p className="text-xs text-tinta-3">
        Son datos de tu cliente: se guardan solo en este teléfono, protegidos por tu PIN. Ninguno es obligatorio.
      </p>
    </>
  );
}

function Campo({
  etiqueta,
  opcional = false,
  children,
}: {
  etiqueta: string;
  opcional?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-sm font-semibold">
        {etiqueta}
        {opcional && <span className="ml-2 text-xs font-medium text-tinta-3">opcional</span>}
      </span>
      {children}
    </label>
  );
}

/* ---------------------------------------------------------------------------
 * Pestaña «Distancia»
 * ------------------------------------------------------------------------- */

function TabDistancia({
  fecha,
  orden,
  regla,
  tienda,
  ajustes,
  deshabilitado,
  ejecutar,
  direccion,
}: {
  fecha: FechaISO;
  orden: OrdenFila;
  regla: ReglaPago;
  tienda: Tienda | null;
  ajustes: AjustesDeComandas;
  deshabilitado: boolean;
  ejecutar: Ejecutar;
  direccion: string;
}) {
  const [trabajando, setTrabajando] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [candidatos, setCandidatos] = useState<Candidato[]>([]);
  const [kmAMano, setKmAMano] = useState("");
  const [enlace, setEnlace] = useState("");
  const [montoManual, setMontoManual] = useState("");

  const origen: Punto | null = tienda?.lat != null && tienda?.lng != null ? { lat: tienda.lat, lng: tienda.lng } : null;
  const cliente: Punto | null =
    orden.cliente?.lat != null && orden.cliente?.lng != null ? { lat: orden.cliente.lat, lng: orden.cliente.lng } : null;
  const km = orden.km;
  const enLinea = origen && cliente ? aDecimas(kmEnLinea(origen, cliente)) : null;
  const sugerido = km !== null ? tramoPorDistancia(regla, km) : null;
  const decididoAMano = !orden.tramoAuto && orden.tramo !== 1;
  const difiere = sugerido !== null && sugerido.tramo !== orden.tramo && sugerido.montoCentimos !== null;

  /** Guarda una distancia con su ubicación y, si toca, el tramo. */
  function guardar(distancia: Distancia, punto: Punto | null, aplicarTramo: boolean, montoManualCentimos: number | null = null) {
    ejecutar(
      () =>
        fijarDistanciaDePedido(fecha, orden.id, {
          km: distancia.km,
          kmFuente: distancia.fuente,
          lat: punto?.lat ?? null,
          lng: punto?.lng ?? null,
          aplicarTramo,
          montoManualCentimos,
        }),
      () => setCandidatos([]),
    );
  }

  /** Mide desde la tienda hasta un punto, según cómo mida esta tienda. */
  async function medir(punto: Punto): Promise<Distancia | null> {
    if (!tienda || !origen) return null;
    return distanciaAlCliente({ punto: origen, metodo: tienda.metodoDistancia, factorCalles: tienda.factorCalles }, punto, rutaPorCalles);
  }

  async function usarPunto(punto: Punto) {
    setTrabajando("Midiendo…");
    try {
      const d = await medir(punto);
      if (!d) return;
      // Si la persona ya eligió un tramo a mano, la distancia se guarda pero no lo pisa.
      guardar(d, punto, ajustes.tramoAutomatico && !decididoAMano);
    } finally {
      setTrabajando(null);
    }
  }

  async function ubicarLaDireccion() {
    setError(null);
    setCandidatos([]);
    const { calle, distrito } = partirDireccion(direccion);
    const consulta = consultaParaMapa(calle, distrito) ?? `${direccion}, Lima, Perú`;
    setTrabajando("Buscando la dirección…");
    try {
      const encontrados = await buscarDireccion(consulta, origen ?? undefined);
      if (encontrados.length === 0) {
        setError("No se encontró esa dirección. Prueba a corregirla en «Cliente», a pegar un enlace de Maps, o a escribir los km a mano.");
      } else if (encontrados.length === 1) {
        await usarPunto(encontrados[0]);
      } else {
        setCandidatos(encontrados);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo buscar la dirección.");
    } finally {
      setTrabajando(null);
    }
  }

  async function usarEnlace() {
    setError(null);
    setTrabajando("Abriendo el enlace…");
    try {
      const punto = await resolverEnlace(enlace);
      if (!punto || !esPuntoValido(punto)) {
        setError("No encontré unas coordenadas ahí. Pega el enlace del lugar de Google Maps, o las coordenadas (−12.09, −76.97).");
        return;
      }
      setEnlace("");
      await usarPunto(punto);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo leer el enlace.");
    } finally {
      setTrabajando(null);
    }
  }

  function guardarKmAMano() {
    const valor = Number(kmAMano.replace(",", "."));
    if (!Number.isFinite(valor) || valor < 0 || valor > 999) {
      setError("Escribe los kilómetros, por ejemplo 4.3.");
      return;
    }
    setError(null);
    const monto = montoManual === "" ? null : Math.round(Number(montoManual) * 100);
    guardar({ km: aDecimas(valor), fuente: "manual", enLinea: enLinea ?? aDecimas(valor) }, null, true, monto);
    setKmAMano("");
  }

  const ocupado = deshabilitado || trabajando !== null;
  const metodo = tienda?.metodoDistancia === "calles" ? "por calles (como Waze o Maps)" : "en línea recta";

  return (
    <>
      {!origen && (
        <Aviso tono="atento" titulo="La tienda todavía no tiene ubicación">
          <p>
            Sin el punto de partida no se puede medir la distancia sola. Elígelo en{" "}
            <Link href="/ajustes" className="font-semibold underline">
              Ajustes › Tienda, ubicación y tarifa › Ubicación
            </Link>
            ; mientras tanto puedes escribir los kilómetros a mano.
          </p>
        </Aviso>
      )}

      <RadarDeTramos regla={regla} km={km} tienda={origen} cliente={cliente} />

      {km !== null ? (
        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="flex flex-col rounded-btn bg-sup-2 px-1 py-2">
            <b className="font-display text-lg leading-tight [zoom:var(--zoom-titulo,1)]">{enLinea !== null ? `${enLinea} km` : "—"}</b>
            <span className="text-[11.5px] font-semibold text-tinta-2">En línea recta</span>
          </div>
          <div className="flex flex-col rounded-btn bg-sup-2 px-1 py-2">
            <b className="font-display text-lg leading-tight [zoom:var(--zoom-titulo,1)]">{km.toFixed(1)} km</b>
            <span className="text-[11.5px] font-semibold text-tinta-2">
              {orden.kmFuente === "ruta" ? "Por calles" : orden.kmFuente === "estimado" ? "Por calles (est.)" : orden.kmFuente === "manual" ? "A mano" : "Usada"}
            </span>
          </div>
          <div className="flex flex-col rounded-btn bg-acento px-1 py-2 text-acento-texto">
            <b className="font-display text-lg leading-tight [zoom:var(--zoom-titulo,1)]">
              {orden.tramo === TRAMO_MAS_DE_12_KM ? "+12 km" : `T${orden.tramo}`}
            </b>
            <span className="text-[11.5px] font-semibold opacity-90">{formatearSoles(orden.montoCentimos ?? 0)}</span>
          </div>
        </div>
      ) : (
        <p className="text-sm text-tinta-2">Este pedido todavía no tiene distancia.</p>
      )}

      {difiere && sugerido && (
        <div className="flex flex-col gap-2 rounded-btn bg-aviso-suave p-3 text-aviso">
          <div className="flex gap-2 text-sm">
            <Alerta className="mt-0.5 size-[18px] shrink-0" />
            <span>
              <b className="block">{orden.tramoAuto ? "La distancia cambió" : "Tu tramo es a mano"}</b>
              Este pedido está en T{orden.tramo} y la distancia sugiere T{sugerido.tramo} (
              {formatearSoles(sugerido.montoCentimos ?? 0)}).
            </span>
          </div>
          <button
            type="button"
            className="boton-sec self-start !border-current !text-current"
            disabled={ocupado}
            onClick={() => guardar({ km: km!, fuente: orden.kmFuente ?? "manual", enLinea: enLinea ?? km! }, null, true)}
          >
            Aplicar T{sugerido.tramo}
          </button>
        </div>
      )}

      {sugerido && sugerido.montoCentimos === null && orden.tramo !== TRAMO_MAS_DE_12_KM && (
        <Aviso tono="atento" titulo="Más de 12 km">
          <p>Está fuera de la tabla: pon cuánto se cobra por este pedido en «Escribir los kilómetros», abajo.</p>
        </Aviso>
      )}

      {error && <p className="rounded-btn bg-mal-suave px-3 py-2 text-sm text-mal">{error}</p>}
      {trabajando && <p className="text-sm text-tinta-2">{trabajando}</p>}

      <div className="flex flex-col gap-2 border-t border-linea pt-4">
        <span className="rotulo">Ubicar al cliente</span>
        <button
          type="button"
          className="boton-sec justify-start"
          disabled={ocupado || !direccion.trim() || !origen}
          onClick={() => void ubicarLaDireccion()}
        >
          <Pin className="size-[18px]" />
          {direccion.trim() ? "Ubicar la dirección" : "Ubicar la dirección (falta escribirla en «Cliente»)"}
        </button>

        {candidatos.length > 0 && (
          <div className="flex flex-col gap-2 rounded-btn bg-sup-2 p-3">
            <p className="text-sm font-semibold">Hay varias ubicaciones posibles. Elige la correcta:</p>
            {candidatos.map((c, i) => (
              <button
                key={`${c.lat}-${c.lng}-${i}`}
                type="button"
                disabled={ocupado}
                onClick={() => void usarPunto(c)}
                className="flex min-h-11 items-center gap-2 rounded-btn border border-linea-fuerte bg-sup px-3 py-2 text-left text-sm"
              >
                <Pin className="size-4 shrink-0" />
                {c.etiqueta}
              </button>
            ))}
          </div>
        )}

        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-semibold">Pegar un enlace de Google Maps o las coordenadas</span>
          <div className="flex gap-2">
            <input
              value={enlace}
              onChange={(e) => setEnlace(e.target.value)}
              placeholder="https://maps.app.goo.gl/… o −12.09, −76.97"
              autoCapitalize="off"
              autoCorrect="off"
              spellCheck={false}
              disabled={ocupado}
              className="min-h-11 min-w-0 flex-1 rounded-btn border border-linea-fuerte bg-sup px-3 text-base"
            />
            <button type="button" className="boton-sec" disabled={ocupado || !enlace.trim() || !origen} onClick={() => void usarEnlace()}>
              Usar
            </button>
          </div>
        </label>

        {(cliente || direccion.trim()) && (
          <a
            className="inline-flex min-h-11 items-center gap-2 self-start text-sm font-semibold text-acento-tinta"
            href={cliente ? enlaceDeMapa(cliente) : enlaceDeBusqueda(`${direccion}, Lima, Perú`)}
            target="_blank"
            rel="noreferrer"
          >
            <Pin className="size-4" />
            Ver {cliente ? "el punto" : "la dirección"} en Maps
          </a>
        )}
      </div>

      <div className="flex flex-col gap-2 border-t border-linea pt-4">
        <span className="rotulo">Escribir los kilómetros</span>
        <p className="text-xs text-tinta-2">
          Si Waze o Maps te dicen otra distancia, escríbela: es la que manda.
        </p>
        <div className="flex gap-2">
          <input
            value={kmAMano}
            onChange={(e) => setKmAMano(e.target.value)}
            inputMode="decimal"
            placeholder="4.3"
            aria-label="Kilómetros"
            disabled={ocupado}
            className="min-h-11 w-24 rounded-btn border border-linea-fuerte bg-sup px-3 text-base"
          />
          <input
            value={montoManual}
            onChange={(e) => setMontoManual(e.target.value)}
            inputMode="decimal"
            placeholder="Monto, solo si pasa de 12 km"
            aria-label="Monto si pasa de 12 km"
            disabled={ocupado}
            className="min-h-11 min-w-0 flex-1 rounded-btn border border-linea-fuerte bg-sup px-3 text-base"
          />
          <button type="button" className="boton-sec" disabled={ocupado || !kmAMano.trim()} onClick={guardarKmAMano}>
            Guardar
          </button>
        </div>
      </div>

      <p className="text-xs text-tinta-3">
        {tienda ? `${tienda.nombre} mide ${metodo}.` : "Falta elegir la tienda."} Se cambia en Ajustes.
        {tienda?.lat != null && " Buscar una dirección necesita internet y consulta el servicio de direcciones de Android."}
      </p>
    </>
  );
}

/* ---------------------------------------------------------------------------
 * Pestaña «Evidencia»
 * ------------------------------------------------------------------------- */

function TabEvidencia({
  fecha,
  orden,
  deshabilitado,
  alCambiar,
  alLeer,
}: {
  fecha: FechaISO;
  orden: OrdenFila;
  deshabilitado: boolean;
  alCambiar: () => void;
  alLeer: (datos: { nombre: string | null; telefono: string | null; direccion: string | null }) => void;
}) {
  const [prueba, setPrueba] = useState<Prueba | null | undefined>(undefined);
  const [vista, setVista] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ampliada, setAmpliada] = useState(false);

  useEffect(() => {
    let vigente = true;
    pruebaDeOrden(orden.id)
      .then((p) => {
        if (vigente) setPrueba(p);
      })
      .catch(() => {
        if (vigente) setPrueba(null);
      });
    return () => {
      vigente = false;
    };
  }, [orden.id]);

  const archivo = prueba?.archivo ?? null;
  useEffect(() => {
    if (!archivo) return;
    let vigente = true;
    contenidoDePrueba(archivo).then((v) => {
      if (vigente) setVista(v);
    });
    return () => {
      vigente = false;
    };
  }, [archivo]);

  async function subir(foto: File) {
    setOcupado("Guardando la foto…");
    setError(null);
    try {
      // La anterior ya lo respalda: no se guardan dos a la vez.
      if (prueba) await borrarPrueba(prueba.id);
      await guardarPrueba(fecha, await comprimir(foto), orden.id);
      setPrueba(await pruebaDeOrden(orden.id));
      alCambiar();
    } catch (fallo) {
      setError(fallo instanceof Error ? fallo.message : "No se pudo guardar la foto.");
    } finally {
      setOcupado(null);
    }
  }

  async function quitar() {
    if (!prueba) return;
    setOcupado("Quitando…");
    setError(null);
    try {
      await borrarPrueba(prueba.id);
      setPrueba(null);
      setVista(null);
      alCambiar();
    } catch (fallo) {
      setError(fallo instanceof Error ? fallo.message : "No se pudo quitar la foto.");
    } finally {
      setOcupado(null);
    }
  }

  /** Lee la foto ya guardada y pasa lo que trae a la pestaña «Cliente». */
  async function leerDeLaFoto() {
    if (!vista) return;
    setOcupado("Leyendo la comanda…");
    setError(null);
    try {
      const blob = await (await fetch(vista)).blob();
      const { hojas } = await leerFotoDeComandas(blob);
      // Si en la foto hay varias hojas, la de este pedido es la que lleva su número.
      const numero = /^v(\d{8})wofp-/.exec(orden.codigo)?.[1];
      const hoja = hojas.find((h) => h.comanda.numero.valor === numero) ?? hojas[0];
      const c = hoja.comanda;
      if (!c.nombre.valor && !c.direccion.valor && !c.telefono.valor) {
        setError("No se pudo leer nada de esta foto. Prueba con otra más de cerca y con buena luz.");
        return;
      }
      alLeer({ nombre: c.nombre.valor, telefono: c.telefono.valor, direccion: c.direccion.valor });
    } catch (fallo) {
      setError(fallo instanceof Error ? fallo.message : "No se pudo leer la foto.");
    } finally {
      setOcupado(null);
    }
  }

  if (prueba === undefined) return null;

  return (
    <>
      <div className="flex flex-col gap-2">
        <span className="text-sm font-semibold">
          Foto de la comanda <span className="ml-1 text-xs font-medium text-tinta-3">opcional</span>
        </span>

        {prueba && vista ? (
          <div className="flex items-start gap-3">
            <button type="button" onClick={() => setAmpliada(true)} aria-label="Ver la foto grande" className="shrink-0">
              {/* eslint-disable-next-line @next/next/no-img-element -- viene en base64, no de una URL que Next pueda optimizar */}
              <img
                src={vista}
                alt="Foto de respaldo del pedido"
                className="h-28 w-[88px] rounded-btn border border-linea-fuerte object-cover"
              />
            </button>
            <div className="flex min-w-0 flex-1 flex-col gap-2">
              <button type="button" className="boton-sec" onClick={() => setAmpliada(true)}>
                <Ojo className="size-4" />
                Ver la foto
              </button>
              <BotonDeFoto etiqueta="Reemplazar" deshabilitado={deshabilitado || !!ocupado} alElegir={(f) => void subir(f)} />
              <button
                type="button"
                className="min-h-10 rounded-btn text-sm font-semibold text-mal disabled:opacity-50"
                disabled={deshabilitado || !!ocupado}
                onClick={() => void quitar()}
              >
                Quitar foto
              </button>
            </div>
          </div>
        ) : (
          <BotonDeFoto etiqueta="Tomar o elegir la foto" deshabilitado={deshabilitado || !!ocupado} alElegir={(f) => void subir(f)} />
        )}
      </div>

      {prueba && vista && (
        <button type="button" className="boton-sec" disabled={deshabilitado || !!ocupado} onClick={() => void leerDeLaFoto()}>
          <Ticket className="size-[18px]" />
          Leer los datos de esta foto
        </button>
      )}

      {ocupado && <p className="text-sm text-tinta-2">{ocupado}</p>}
      {error && <p className="rounded-btn bg-mal-suave px-3 py-2 text-sm text-mal">{error}</p>}

      <Aviso tono="atento" titulo="Un pedido tiene como mucho una foto">
        <p>
          Sirve de respaldo si la tienda discute ese pedido. Se guarda en el almacenamiento privado de Rutas-A:
          no sale en la galería, y ninguna otra app la ve.
        </p>
      </Aviso>

      {ampliada && vista && (
        <div
          className="fixed inset-0 z-[60] flex flex-col items-center justify-center gap-3 bg-black/90 p-4"
          onClick={() => setAmpliada(false)}
        >
          {/* eslint-disable-next-line @next/next/no-img-element -- base64 */}
          <img src={vista} alt="Foto de la comanda" className="max-h-[80dvh] max-w-full rounded-btn object-contain" />
          <button type="button" className="boton-sec" onClick={() => setAmpliada(false)}>
            <Equis className="size-4" />
            Cerrar
          </button>
        </div>
      )}
    </>
  );
}

/**
 * El botón de foto. **Sin `capture`**: con él el navegador abre la cámara directo
 * y no deja elegir una foto ya tomada. Sin ese atributo, Android enseña las dos
 * puertas —cámara y galería— y decide la persona.
 */
function BotonDeFoto({
  etiqueta,
  deshabilitado,
  alElegir,
}: {
  etiqueta: string;
  deshabilitado: boolean;
  alElegir: (f: File) => void;
}) {
  return (
    <label className={`boton-sec cursor-pointer ${deshabilitado ? "opacity-50" : ""}`}>
      <Camara className="size-[18px]" />
      {etiqueta}
      <input
        type="file"
        accept="image/*"
        disabled={deshabilitado}
        className="sr-only"
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = "";
          if (f) alElegir(f);
        }}
      />
    </label>
  );
}
