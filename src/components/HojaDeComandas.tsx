"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";

import { Alerta, Camara, Check, Equis, Flecha, Pin, Ticket } from "@/components/iconos";
import { Pestanas } from "@/components/Pestanas";
import { RadarDeTramos } from "@/components/RadarDeTramos";
import { Aviso } from "@/components/ui";
import { useCapa } from "@/hooks/useCapa";
import { codigoDeDespacho, type CampoDeComanda } from "@/lib/comanda/interpretar";
import { guardarComanda, type ResultadoDeGuardado } from "@/lib/comanda/guardar";
import { leerFotoDeComandas, type HojaLeida } from "@/lib/comanda/leer";
import type { AjustesDeComandas } from "@/lib/db/sqlite/ajustes";
import { pedidosPorNumero, type PedidoDeUnNumero } from "@/lib/db/sqlite/clientes";
import type { Tienda } from "@/lib/db/tipos";
import { formatearFecha, hoyEnLima, nombreDelDia, sumarDias, type FechaISO } from "@/lib/fechas";
import { esPuntoValido, kmEnLinea, type Punto } from "@/lib/geo/distancia";
import { enlaceDeMapa } from "@/lib/geo/enlaces";
import { buscarDireccion, resolverEnlace, rutaPorCalles, type Candidato } from "@/lib/geo/nativo";
import { aDecimas, distanciaAlCliente, tramoPorDistancia, type Distancia } from "@/lib/geo/tramo";
import { TRAMO_MAS_DE_12_KM, formatearSoles, type ReglaPago } from "@/lib/pagos/reglas";

/**
 * Leer comandas, una por una.
 *
 * Se eligen fotos de las hojas de despacho —de la cámara o de la galería, una
 * o varias— y cada una se lee en el teléfono. De cada comanda sale el número de
 * despacho, el nombre, la dirección y el teléfono, **cada dato con su
 * legibilidad**: Legible, Dudoso o No se leyó. Lo dudoso se revisa; lo que no se
 * leyó se escribe o se deja vacío. Nada se guarda sin pasar por aquí, salvo que
 * Ajustes diga que las que se leyeron con claridad se guarden juntas.
 *
 * Cada comanda hace una de dos cosas: **completa** el pedido que ya estaba
 * cargado —el número de despacho es la parte del medio de su código—, o
 * **crea** uno nuevo si no estaba. En los dos casos la foto queda como su
 * evidencia, y con la dirección ubicada el tramo sale de la distancia.
 *
 * Solo buscar la dirección necesita internet; leer la foto, no.
 */

const LEGIBLE = 0.8;
const DUDOSO = 0.45;
const MAX_FOTOS = 12;

type Calidad = "lista" | "revisar" | "ilegible";
type EstadoUbicacion = "pendiente" | "buscando" | "ok" | "varias" | "no" | "sin-tienda" | "error";

interface Item {
  id: string;
  /** De qué foto salió, para decirlo. */
  origen: string;
  hoja: HojaLeida;
  calidad: Calidad;
  numero: string;
  nombre: string;
  telefono: string;
  direccion: string;
  existentes: PedidoDeUnNumero[];
  /** El pedido que completa; null para crear uno nuevo. */
  elegido: string | null;
  fecha: FechaISO;
  ruta: number | null;
  ubicacion: { estado: EstadoUbicacion; candidatos: Candidato[]; etiqueta: string | null; mensaje: string | null };
  punto: Punto | null;
  distancia: Distancia | null;
  montoManual: string;
  guardada: ResultadoDeGuardado | null;
  error: string | null;
}

/** Lo más importante de una comanda: sin esto no hay pedido al que atarla. */
function calidadDe(h: HojaLeida): Calidad {
  const c = h.comanda;
  if (!c.numero.valor && !c.nombre.valor && !c.direccion.valor) return "ilegible";
  const claros = [c.numero, c.nombre, c.direccion].every((k) => k.valor && k.confianza >= LEGIBLE);
  return claros ? "lista" : "revisar";
}

export function HojaDeComandas({
  fecha,
  regla,
  rutas,
  tienda,
  ajustes,
  alCerrar,
  alTerminar,
}: {
  /** El día que se estaba mirando: a él van los pedidos nuevos. */
  fecha: FechaISO;
  regla: ReglaPago;
  rutas: Array<{ numero: number; inicio: string | null }>;
  tienda: Tienda | null;
  ajustes: AjustesDeComandas;
  alCerrar: () => void;
  /** Vuelve a leer el día: algo se guardó. */
  alTerminar: () => void;
}) {
  const [items, setItems] = useState<Item[]>([]);
  const [leyendo, setLeyendo] = useState<{ hechas: number; total: number } | null>(null);
  const [abierta, setAbierta] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);
  const entrada = useRef<HTMLInputElement>(null);
  // La búsqueda de una dirección termina más tarde y tiene que ver la tienda de
  // ese momento, no la de cuando empezó.
  const tiendaRef = useRef(tienda);
  useEffect(() => {
    tiendaRef.current = tienda;
  }, [tienda]);

  useCapa(abierta ? () => setAbierta(null) : alCerrar);

  const origen: Punto | null = tienda?.lat != null && tienda?.lng != null ? { lat: tienda.lat, lng: tienda.lng } : null;

  const actualizar = useCallback((id: string, cambios: Partial<Item> | ((i: Item) => Partial<Item>)) => {
    setItems((previos) =>
      previos.map((i) => (i.id === id ? { ...i, ...(typeof cambios === "function" ? cambios(i) : cambios) } : i)),
    );
  }, []);

  /** Mide desde la tienda hasta un punto, según cómo mida esta tienda. */
  const medir = useCallback(async (punto: Punto): Promise<Distancia | null> => {
    const t = tiendaRef.current;
    if (t?.lat == null || t?.lng == null) return null;
    return distanciaAlCliente(
      { punto: { lat: t.lat, lng: t.lng }, metodo: t.metodoDistancia, factorCalles: t.factorCalles },
      punto,
      rutaPorCalles,
    );
  }, []);

  const fijarPunto = useCallback(
    async (id: string, punto: Punto, etiqueta: string | null) => {
      const d = await medir(punto);
      actualizar(id, {
        punto,
        distancia: d,
        ubicacion: { estado: "ok", candidatos: [], etiqueta, mensaje: null },
      });
    },
    [actualizar, medir],
  );

  /** Busca la dirección de una comanda en el servicio de direcciones de Android. */
  const ubicar = useCallback(
    async (id: string, consulta: string) => {
      actualizar(id, { ubicacion: { estado: "buscando", candidatos: [], etiqueta: null, mensaje: null } });
      try {
        const t = tiendaRef.current;
        const cerca = t?.lat != null && t?.lng != null ? { lat: t.lat, lng: t.lng } : undefined;
        const encontrados = await buscarDireccion(consulta, cerca);
        if (encontrados.length === 0) {
          actualizar(id, { ubicacion: { estado: "no", candidatos: [], etiqueta: null, mensaje: "No se encontró esa dirección." } });
        } else if (encontrados.length === 1) {
          await fijarPunto(id, encontrados[0], encontrados[0].etiqueta);
        } else {
          actualizar(id, { ubicacion: { estado: "varias", candidatos: encontrados, etiqueta: null, mensaje: null } });
        }
      } catch (e) {
        actualizar(id, {
          ubicacion: {
            estado: "error",
            candidatos: [],
            etiqueta: null,
            mensaje: e instanceof Error ? e.message : "No se pudo buscar la dirección.",
          },
        });
      }
    },
    [actualizar, fijarPunto],
  );

  async function alElegir(e: React.ChangeEvent<HTMLInputElement>) {
    const archivos = Array.from(e.target.files ?? []).slice(0, MAX_FOTOS);
    e.target.value = "";
    if (archivos.length === 0) return;

    setError(null);
    setLeyendo({ hechas: 0, total: archivos.length });

    for (let k = 0; k < archivos.length; k++) {
      const origenFoto = `Foto ${k + 1}`;
      try {
        const { hojas } = await leerFotoDeComandas(archivos[k]);
        const nuevos: Item[] = [];
        for (const hoja of hojas) {
          const c = hoja.comanda;
          const numero = c.numero.valor ?? "";
          const existentes = numero ? await pedidosPorNumero(numero) : [];
          const hoy = hoyEnLima();
          const deLaHoja = c.fecha.valor && c.fecha.valor <= hoy && c.fecha.valor >= sumarDias(hoy, -45) ? c.fecha.valor : null;
          nuevos.push({
            id: crypto.randomUUID(),
            origen: hojas.length > 1 ? `${origenFoto}, hoja ${nuevos.length + 1}` : origenFoto,
            hoja,
            calidad: calidadDe(hoja),
            numero,
            nombre: c.nombre.valor ?? "",
            telefono: c.telefono.valor ?? "",
            direccion: c.direccion.valor ?? "",
            existentes,
            elegido: existentes[0]?.ordenId ?? null,
            // Un pedido nuevo va al día que se miraba, salvo que la hoja diga otro que sea creíble.
            fecha: (deLaHoja as FechaISO | null) ?? fecha,
            ruta: null,
            ubicacion: { estado: "pendiente", candidatos: [], etiqueta: null, mensaje: null },
            punto: null,
            distancia: null,
            montoManual: "",
            guardada: null,
            error: null,
          });
        }
        setItems((previos) => [...previos, ...nuevos]);
        // La dirección se busca sola, en segundo plano, si hay tienda ubicada.
        for (const n of nuevos) {
          const consulta = n.hoja.comanda.consultaDeMapa;
          if (n.calidad === "ilegible" || !consulta) continue;
          if (!origen) {
            actualizar(n.id, { ubicacion: { estado: "sin-tienda", candidatos: [], etiqueta: null, mensaje: null } });
          } else {
            void ubicar(n.id, consulta);
          }
        }
      } catch (fallo) {
        setError(
          `No se pudo leer la ${origenFoto.toLowerCase()}. ${fallo instanceof Error ? fallo.message : ""}`.trim(),
        );
      }
      setLeyendo({ hechas: k + 1, total: archivos.length });
    }
    setLeyendo(null);
  }

  /** Guarda una comanda. Devuelve si salió bien. */
  async function guardar(item: Item): Promise<boolean> {
    actualizar(item.id, { error: null });
    try {
      const elegido = item.existentes.find((x) => x.ordenId === item.elegido) ?? null;
      const resultado = await guardarComanda(
        {
          numero: item.numero,
          ordenExistenteId: elegido?.ordenId ?? null,
          fecha: elegido?.fecha ?? item.fecha,
          ruta: item.ruta,
          nombre: item.nombre,
          telefono: item.telefono,
          direccion: item.direccion,
          punto: item.punto,
          distancia: item.distancia,
          montoManualCentimos: item.montoManual ? Math.round(Number(item.montoManual.replace(",", ".")) * 100) || null : null,
          evidencia: item.hoja.evidencia,
        },
        ajustes,
      );
      actualizar(item.id, { guardada: resultado });
      return true;
    } catch (e) {
      actualizar(item.id, { error: e instanceof Error ? e.message : "No se pudo guardar la comanda." });
      return false;
    }
  }

  const pendientes = items.filter((i) => !i.guardada);
  const listas = pendientes.filter((i) => i.calidad === "lista" && i.numero);

  async function guardarLasListas() {
    setGuardando(true);
    let n = 0;
    for (const i of listas) if (await guardar(i)) n++;
    setGuardando(false);
    if (n > 0) alTerminar();
  }

  const item = items.find((i) => i.id === abierta) ?? null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center sm:p-5"
      onClick={(e) => {
        if (e.target === e.currentTarget && !item) alCerrar();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Leer comandas"
        className="flex h-[94dvh] w-full max-w-md flex-col overflow-hidden rounded-t-hoja bg-sup shadow-alta sm:h-[88dvh] sm:rounded-hoja"
      >
        <div className="flex items-start justify-between gap-3 px-4 pt-4 pb-2">
          <div className="min-w-0">
            <span className="mx-auto mb-2 block h-1 w-9 rounded-full bg-linea-fuerte sm:hidden" />
            <h3 className="text-[21px] leading-tight">{item ? "Revisar la comanda" : "Leer comandas"}</h3>
            <p className="text-sm text-tinta-2">
              <span className="capitalize">{nombreDelDia(fecha)}</span> {Number(fecha.slice(8))} · {formatearFecha(fecha)}
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

        <input
          ref={entrada}
          type="file"
          accept="image/*"
          multiple
          className="sr-only"
          tabIndex={-1}
          onChange={(e) => void alElegir(e)}
        />

        {item ? (
          <Revision
            item={item}
            regla={regla}
            rutas={rutas}
            tienda={tienda}
            origen={origen}
            ajustes={ajustes}
            fecha={fecha}
            actualizar={actualizar}
            ubicar={ubicar}
            fijarPunto={fijarPunto}
            hayMas={pendientes.filter((i) => i.id !== item.id).length > 0}
            alVolver={() => setAbierta(null)}
            alGuardar={async () => {
              if (await guardar(item)) {
                alTerminar();
                const siguiente = pendientes.find((i) => i.id !== item.id && i.calidad !== "ilegible");
                setAbierta(siguiente?.id ?? null);
              }
            }}
          />
        ) : (
          <div className="flex flex-1 flex-col gap-4 overflow-y-auto px-4 pb-4">
            {items.length === 0 && !leyendo && (
              <Inicio alElegir={() => entrada.current?.click()} hayTienda={origen !== null} />
            )}

            {leyendo && (
              <div className="tarjeta flex flex-col gap-2" role="status">
                <b>Leyendo la foto {Math.min(leyendo.hechas + 1, leyendo.total)} de {leyendo.total}…</b>
                <div className="h-2 overflow-hidden rounded-full bg-sup-2">
                  <span
                    className="block h-full rounded-full bg-acento transition-[width] duration-300"
                    style={{ width: `${(leyendo.hechas / leyendo.total) * 100}%` }}
                  />
                </div>
                <p className="text-xs text-tinta-3">Se lee aquí, en tu teléfono. No hace falta internet.</p>
              </div>
            )}

            {error && <Aviso tono="mal" titulo={error} />}

            {items.length > 0 && (
              <>
                <p className="text-sm text-tinta-2">
                  {items.length} comanda{items.length === 1 ? "" : "s"} · {items.filter((i) => i.guardada).length} guardada
                  {items.filter((i) => i.guardada).length === 1 ? "" : "s"}
                </p>
                <div className="flex flex-col gap-2">
                  {items.map((i) => (
                    <FilaDeComanda key={i.id} item={i} alAbrir={() => setAbierta(i.id)} />
                  ))}
                </div>
                {!ajustes.confirmarSiempre && (
                  <p className="text-xs text-tinta-3">
                    En Ajustes elegiste guardar juntas las comandas que se leen con claridad.
                  </p>
                )}
              </>
            )}
          </div>
        )}

        {!item && items.length > 0 && (
          <div className="grid grid-flow-col auto-cols-fr gap-2 border-t border-linea px-4 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom,0px))]">
            <button type="button" className="boton-sec" disabled={!!leyendo} onClick={() => entrada.current?.click()}>
              <Camara className="size-[18px]" />
              Otra foto
            </button>
            {ajustes.confirmarSiempre ? (
              <button
                type="button"
                className="boton-principal !min-h-11 !text-base"
                disabled={!!leyendo || pendientes.length === 0}
                onClick={() => setAbierta(pendientes.find((i) => i.calidad !== "ilegible")?.id ?? pendientes[0]?.id ?? null)}
              >
                Revisar la siguiente
              </button>
            ) : (
              <button
                type="button"
                className="boton-principal !min-h-11 !text-base"
                disabled={!!leyendo || guardando || listas.length === 0}
                onClick={() => void guardarLasListas()}
              >
                {guardando ? "Guardando…" : `Guardar ${listas.length} lista${listas.length === 1 ? "" : "s"}`}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------------------
 * Primer paso
 * ------------------------------------------------------------------------- */

function Inicio({ alElegir, hayTienda }: { alElegir: () => void; hayTienda: boolean }) {
  return (
    <>
      <p className="text-[15px] text-tinta-2">
        Una foto por comanda —o varias de la galería—. La app lee el pedido, el cliente y la dirección; tú confirmas.
      </p>
      <button type="button" className="boton-principal" onClick={alElegir}>
        <Camara className="size-[22px]" />
        Tomar o elegir fotos
      </button>
      <ul className="flex flex-col gap-2.5 text-sm text-tinta-2">
        <li className="flex gap-2.5">
          <Check className="mt-0.5 size-[18px] shrink-0 text-acento-tinta" />
          Con buena luz y sin reflejos sobre el papel.
        </li>
        <li className="flex gap-2.5">
          <Check className="mt-0.5 size-[18px] shrink-0 text-acento-tinta" />
          La hoja plegada plana y de arriba abajo; <b>incluye el lado derecho</b>, donde están el nombre, la dirección y el teléfono.
        </li>
        <li className="flex gap-2.5">
          <Check className="mt-0.5 size-[18px] shrink-0 text-acento-tinta" />
          Si en la foto salen dos hojas, se leen las dos por separado.
        </li>
        <li className="flex gap-2.5">
          <Alerta className="mt-0.5 size-[18px] shrink-0 text-acento-tinta" />
          Lo que no se lea bien queda marcado para que lo revises; nada se guarda sin que lo veas.
        </li>
      </ul>
      {!hayTienda && (
        <Aviso tono="atento" titulo="La tienda todavía no tiene ubicación">
          <p>
            Puedes leer las comandas igual, pero el tramo no se calculará solo.{" "}
            <Link href="/ajustes" className="font-semibold underline">
              Elígela en Ajustes
            </Link>
            .
          </p>
        </Aviso>
      )}
      <p className="flex gap-2 text-xs text-tinta-3">
        <Pin className="mt-0.5 size-4 shrink-0" />
        <span>
          La lectura ocurre en tu teléfono, sin internet. Solo buscar la dirección en el mapa necesita conexión y
          consulta el servicio de direcciones de Android.
        </span>
      </p>
    </>
  );
}

/* ---------------------------------------------------------------------------
 * La lista
 * ------------------------------------------------------------------------- */

function EstadoDeComanda({ item }: { item: Item }) {
  if (item.guardada) {
    return (
      <span className="inline-flex items-center gap-1 rounded-chip bg-bien-suave px-2 py-0.5 text-[10.5px] font-bold tracking-wide text-bien uppercase">
        <Check className="size-3" />
        Guardada
      </span>
    );
  }
  const [clase, Icono, texto] =
    item.calidad === "lista"
      ? (["bg-bien-suave text-bien", Check, "Lista"] as const)
      : item.calidad === "revisar"
        ? (["bg-aviso-suave text-aviso", Alerta, "Revisar"] as const)
        : (["bg-mal-suave text-mal", Equis, "No se leyó"] as const);
  return (
    <span className={`inline-flex items-center gap-1 rounded-chip px-2 py-0.5 text-[10.5px] font-bold tracking-wide uppercase ${clase}`}>
      <Icono className="size-3" />
      {texto}
    </span>
  );
}

function FilaDeComanda({ item, alAbrir }: { item: Item; alAbrir: () => void }) {
  const foto = useFoto(item.hoja);
  const km = item.distancia?.km ?? null;
  const elegido = item.existentes.find((x) => x.ordenId === item.elegido);
  return (
    <button
      type="button"
      onClick={alAbrir}
      className="flex min-h-[84px] w-full items-center gap-3 rounded-card border border-linea-fuerte bg-sup p-2.5 text-left"
    >
      {foto ? (
        // eslint-disable-next-line @next/next/no-img-element -- URL de objeto local, no optimizable
        <img src={foto} alt="" className="h-[68px] w-[54px] shrink-0 rounded-btn border border-linea object-cover" />
      ) : (
        <span className="grid h-[68px] w-[54px] shrink-0 place-items-center rounded-btn bg-sup-2 text-tinta-3">
          <Ticket className="size-6" />
        </span>
      )}
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <b className="truncate text-[15px]">
          {item.calidad === "ilegible" ? "Foto que no se pudo leer" : item.nombre || "Sin nombre"}
        </b>
        <span className="truncate text-xs text-tinta-3">
          {item.calidad === "ilegible"
            ? `${item.origen} · vuelve a tomarla o complétala a mano`
            : `${elegido ? "Ya cargado" : "Pedido nuevo"} · ${
                item.guardada
                  ? `${formatearSoles(item.guardada.montoCentimos)}${item.guardada.km !== null ? ` · ${item.guardada.km.toFixed(1)} km` : ""}`
                  : km !== null
                    ? `${km.toFixed(1)} km`
                    : item.ubicacion.estado === "buscando"
                      ? "buscando la dirección…"
                      : "sin ubicar"
              }`}
        </span>
        <span className="mt-0.5">
          <EstadoDeComanda item={item} />
        </span>
      </span>
      <Flecha className="size-4 shrink-0 text-tinta-3" />
    </button>
  );
}

/** Una vista pequeña de la foto de la hoja, sin guardarla en ningún lado. */
function useFoto(hoja: HojaLeida): string | null {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let vigente = true;
    let creada: string | null = null;
    hoja
      .evidencia()
      .then((b) => {
        if (!vigente) return;
        creada = URL.createObjectURL(b);
        setUrl(creada);
      })
      .catch(() => {});
    return () => {
      vigente = false;
      if (creada) URL.revokeObjectURL(creada);
    };
  }, [hoja]);
  return url;
}

/* ---------------------------------------------------------------------------
 * Revisar una comanda
 * ------------------------------------------------------------------------- */

function Confianza({ campo, valor }: { campo: CampoDeComanda; valor: string }) {
  // Si la persona ya escribió algo distinto de lo leído, ya no es una lectura.
  const cambiado = valor.trim() !== (campo.valor ?? "");
  if (cambiado && valor.trim()) return null;
  const c = campo.confianza;
  const [clase, Icono, texto] =
    !campo.valor
      ? (["bg-mal-suave text-mal", Equis, "No se leyó"] as const)
      : c >= LEGIBLE
        ? (["bg-bien-suave text-bien", Check, "Legible"] as const)
        : c >= DUDOSO
          ? (["bg-aviso-suave text-aviso", Alerta, "Dudoso"] as const)
          : (["bg-mal-suave text-mal", Equis, "Casi ilegible"] as const);
  return (
    <span className={`ml-2 inline-flex items-center gap-1 rounded-chip px-1.5 py-px text-[11px] font-bold ${clase}`}>
      <Icono className="size-[11px]" />
      {texto}
    </span>
  );
}

function bordeSegun(campo: CampoDeComanda, valor: string): string {
  if (valor.trim() && valor.trim() !== (campo.valor ?? "")) return "border-linea-fuerte";
  if (!campo.valor) return "border-mal bg-mal-suave/40";
  if (campo.confianza >= LEGIBLE) return "border-linea-fuerte";
  return campo.confianza >= DUDOSO ? "border-aviso bg-aviso-suave/40" : "border-mal bg-mal-suave/40";
}

function Revision({
  item,
  regla,
  rutas,
  tienda,
  origen,
  ajustes,
  fecha,
  actualizar,
  ubicar,
  fijarPunto,
  hayMas,
  alVolver,
  alGuardar,
}: {
  item: Item;
  regla: ReglaPago;
  rutas: Array<{ numero: number; inicio: string | null }>;
  tienda: Tienda | null;
  origen: Punto | null;
  ajustes: AjustesDeComandas;
  fecha: FechaISO;
  actualizar: (id: string, cambios: Partial<Item>) => void;
  ubicar: (id: string, consulta: string) => Promise<void>;
  fijarPunto: (id: string, punto: Punto, etiqueta: string | null) => Promise<void>;
  hayMas: boolean;
  alVolver: () => void;
  alGuardar: () => Promise<void>;
}) {
  const [pestana, setPestana] = useState("pedido");
  const [guardando, setGuardando] = useState(false);
  const [ampliada, setAmpliada] = useState(false);
  const foto = useFoto(item.hoja);
  const c = item.hoja.comanda;
  const ilegible = item.calidad === "ilegible" && !item.numero && !item.nombre && !item.direccion;

  const elegido = item.existentes.find((x) => x.ordenId === item.elegido) ?? null;
  const km = item.distancia?.km ?? null;
  const calculado = km !== null ? tramoPorDistancia(regla, km) : null;
  const masDe12 = calculado !== null && calculado.montoCentimos === null;
  const numeroValido = /^\d{8}$/.test(item.numero);

  async function renumerar(numero: string) {
    const existentes = /^\d{8}$/.test(numero) ? await pedidosPorNumero(numero) : [];
    actualizar(item.id, { numero, existentes, elegido: existentes[0]?.ordenId ?? null });
  }

  return (
    <>
      <div className="flex flex-col gap-3 px-4 pb-2">
        <div className="flex items-center gap-3">
          {foto ? (
            <button type="button" onClick={() => setAmpliada(true)} aria-label="Ver la foto grande" className="shrink-0">
              {/* eslint-disable-next-line @next/next/no-img-element -- URL de objeto local */}
              <img src={foto} alt="La foto de la comanda" className="h-[76px] w-[60px] rounded-btn border border-linea-fuerte object-cover" />
            </button>
          ) : null}
          <div className="flex min-w-0 flex-col gap-1">
            <span className="rotulo">{item.origen}</span>
            <EstadoDeComanda item={item} />
            <span className="text-xs text-tinta-3">
              {ilegible
                ? "No se pudo leer. Completa lo que puedas a mano."
                : item.calidad === "lista"
                  ? "Todo se leyó con claridad."
                  : "Revisa lo marcado como dudoso."}
            </span>
          </div>
        </div>
        <Pestanas
          etiqueta="Datos de la comanda"
          actual={pestana}
          alCambiar={setPestana}
          items={[
            { id: "pedido", etiqueta: "Pedido" },
            { id: "cliente", etiqueta: "Cliente" },
            { id: "entrega", etiqueta: "Entrega", punto: item.punto !== null },
          ]}
        />
      </div>

      <div className="flex flex-1 flex-col gap-4 overflow-y-auto px-4 pb-4">
        {item.error && <Aviso tono="mal" titulo={item.error} />}

        {pestana === "pedido" && (
          <>
            {elegido ? (
              <Aviso tono="bien" titulo="Este pedido ya está cargado">
                <p>
                  {nombreDelDia(elegido.fecha)} {Number(elegido.fecha.slice(8))}
                  {elegido.ruta ? ` · Ruta ${elegido.ruta}` : ""}
                  {elegido.horaRuta ? ` · ${elegido.horaRuta}` : ""}. Se le añaden el cliente, la distancia y la foto.
                </p>
              </Aviso>
            ) : (
              <Aviso tono="atento" titulo="Pedido nuevo">
                <p>
                  {numeroValido
                    ? `No estaba entre tus capturas. Se añade como ${codigoDeDespacho(item.numero)}.`
                    : "Escribe el número de despacho de la hoja (8 dígitos) para poder guardarla."}
                </p>
              </Aviso>
            )}

            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-semibold">
                Número de despacho
                <Confianza campo={c.numero} valor={item.numero} />
              </span>
              <input
                value={item.numero}
                onChange={(e) => actualizar(item.id, { numero: e.target.value.replace(/\D/g, "").slice(0, 8) })}
                onBlur={() => void renumerar(item.numero)}
                inputMode="numeric"
                autoComplete="off"
                placeholder="12264655"
                className={`min-h-11 rounded-btn border bg-sup px-3 font-mono text-base ${bordeSegun(c.numero, item.numero)}`}
              />
            </label>

            {item.existentes.length > 1 && (
              <label className="flex flex-col gap-1.5">
                <span className="text-sm font-semibold">Hay varios bultos: ¿a cuál es?</span>
                <select
                  value={item.elegido ?? ""}
                  onChange={(e) => actualizar(item.id, { elegido: e.target.value || null })}
                  className="min-h-11 rounded-btn border border-linea-fuerte bg-sup px-2 font-mono text-base"
                >
                  {item.existentes.map((x) => (
                    <option key={x.ordenId} value={x.ordenId}>
                      {x.codigo}
                      {x.tieneCliente ? " · ya tiene cliente" : ""}
                    </option>
                  ))}
                  <option value="">Ninguno: crear uno nuevo</option>
                </select>
              </label>
            )}

            {!elegido && (
              <div className="grid grid-cols-2 gap-3">
                <label className="flex flex-col gap-1.5">
                  <span className="text-sm font-semibold">Día</span>
                  <input
                    type="date"
                    value={item.fecha}
                    max={hoyEnLima()}
                    onChange={(e) => e.target.value && actualizar(item.id, { fecha: e.target.value as FechaISO })}
                    className="min-h-11 rounded-btn border border-linea-fuerte bg-sup px-2 text-base"
                  />
                </label>
                <label className="flex flex-col gap-1.5">
                  <span className="text-sm font-semibold">Ruta</span>
                  <select
                    value={item.ruta ?? ""}
                    disabled={item.fecha !== fecha}
                    onChange={(e) => actualizar(item.id, { ruta: e.target.value === "" ? null : Number(e.target.value) })}
                    className="min-h-11 rounded-btn border border-linea-fuerte bg-sup px-2 text-base disabled:opacity-60"
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
              </div>
            )}

            <p className="text-xs text-tinta-3">
              {ajustes.guardarFoto
                ? "La foto se guarda como evidencia del pedido."
                : "En Ajustes tienes apagado guardar la foto de la comanda."}
            </p>
          </>
        )}

        {pestana === "cliente" && (
          <>
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-semibold">
                Nombre del cliente
                <Confianza campo={c.nombre} valor={item.nombre} />
              </span>
              <input
                value={item.nombre}
                onChange={(e) => actualizar(item.id, { nombre: e.target.value })}
                autoComplete="off"
                className={`min-h-11 rounded-btn border bg-sup px-3 text-base ${bordeSegun(c.nombre, item.nombre)}`}
              />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-semibold">
                Teléfono <span className="text-xs font-medium text-tinta-3">opcional</span>
                <Confianza campo={c.telefono} valor={item.telefono} />
              </span>
              <input
                value={item.telefono}
                onChange={(e) => actualizar(item.id, { telefono: e.target.value })}
                inputMode="tel"
                autoComplete="off"
                placeholder="9xx xxx xxx"
                className={`min-h-11 rounded-btn border bg-sup px-3 font-mono text-base ${item.telefono || c.telefono.valor ? bordeSegun(c.telefono, item.telefono) : "border-linea-fuerte"}`}
              />
              {!c.telefono.valor && !item.telefono && (
                <span className="text-xs text-tinta-3">
                  No se leyó. Si en la foto se cortó el lado derecho, vuelve a tomarla con la hoja completa.
                </span>
              )}
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-semibold">
                Dirección
                <Confianza campo={c.direccion} valor={item.direccion} />
              </span>
              <textarea
                value={item.direccion}
                rows={2}
                onChange={(e) => actualizar(item.id, { direccion: e.target.value })}
                className={`rounded-btn border bg-sup px-3 py-2 text-base ${bordeSegun(c.direccion, item.direccion)}`}
              />
            </label>
            <p className="text-xs text-tinta-3">
              Se guardará:{" "}
              {[
                ajustes.guardarNombre && item.nombre.trim() && "nombre",
                ajustes.guardarDireccion && item.direccion.trim() && "dirección",
                ajustes.guardarTelefono && item.telefono.trim() && "teléfono",
              ]
                .filter(Boolean)
                .join(" · ") || "solo la distancia"}{" "}
              <span className="text-tinta-3">(según Ajustes)</span>
            </p>
          </>
        )}

        {pestana === "entrega" && (
          <Entrega
            item={item}
            regla={regla}
            tienda={tienda}
            origen={origen}
            calculado={calculado}
            masDe12={masDe12}
            actualizar={actualizar}
            ubicar={ubicar}
            fijarPunto={fijarPunto}
          />
        )}
      </div>

      <div className="grid grid-flow-col auto-cols-fr gap-2 border-t border-linea px-4 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom,0px))]">
        <button type="button" className="boton-sec" onClick={alVolver}>
          Volver a la lista
        </button>
        <button
          type="button"
          className="boton-principal !min-h-11 !text-base"
          disabled={guardando || !!item.guardada || (!elegido && !numeroValido)}
          onClick={async () => {
            /* Más de 12 km no tiene tarifa: si el tramo se va a calcular solo,
               hace falta el monto. Se pide aquí, a la vista, y no se guarda en
               silencio un pedido que se quedaría en tramo 1 sin que nadie lo note. */
            const decididoAMano = !!elegido && !elegido.tramoAuto && elegido.tramo !== 1;
            if (masDe12 && ajustes.tramoAutomatico && !decididoAMano && !(Number(item.montoManual.replace(",", ".")) > 0)) {
              actualizar(item.id, { error: "Más de 12 km no tiene tarifa: escribe cuánto se cobra por este pedido en «Entrega»." });
              setPestana("entrega");
              return;
            }
            setGuardando(true);
            await alGuardar();
            setGuardando(false);
          }}
        >
          {guardando ? "Guardando…" : item.guardada ? "Guardada" : hayMas ? "Guardar y siguiente" : "Guardar"}
        </button>
      </div>

      {ampliada && foto && (
        <div
          className="fixed inset-0 z-[60] flex flex-col items-center justify-center gap-3 bg-black/90 p-4"
          onClick={() => setAmpliada(false)}
        >
          {/* eslint-disable-next-line @next/next/no-img-element -- URL de objeto local */}
          <img src={foto} alt="La foto de la comanda" className="max-h-[82dvh] max-w-full rounded-btn object-contain" />
          <button type="button" className="boton-sec" onClick={() => setAmpliada(false)}>
            <Equis className="size-4" />
            Cerrar
          </button>
        </div>
      )}
    </>
  );
}

function Entrega({
  item,
  regla,
  tienda,
  origen,
  calculado,
  masDe12,
  actualizar,
  ubicar,
  fijarPunto,
}: {
  item: Item;
  regla: ReglaPago;
  tienda: Tienda | null;
  origen: Punto | null;
  calculado: ReturnType<typeof tramoPorDistancia> | null;
  masDe12: boolean;
  actualizar: (id: string, cambios: Partial<Item>) => void;
  ubicar: (id: string, consulta: string) => Promise<void>;
  fijarPunto: (id: string, punto: Punto, etiqueta: string | null) => Promise<void>;
}) {
  const [enlace, setEnlace] = useState("");
  const [kmAMano, setKmAMano] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const u = item.ubicacion;
  const d = item.distancia;
  const consulta = item.hoja.comanda.consultaDeMapa ?? (item.direccion.trim() ? `${item.direccion}, Lima, Perú` : null);
  const enLinea = origen && item.punto ? aDecimas(kmEnLinea(origen, item.punto)) : null;

  async function usarEnlace() {
    setMsg(null);
    setOcupado(true);
    try {
      const punto = await resolverEnlace(enlace);
      if (!punto || !esPuntoValido(punto)) {
        setMsg("No encontré unas coordenadas ahí. Pega el enlace del lugar de Google Maps, o las coordenadas.");
        return;
      }
      setEnlace("");
      await fijarPunto(item.id, punto, "Ubicación puesta a mano");
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "No se pudo leer el enlace.");
    } finally {
      setOcupado(false);
    }
  }

  function guardarKm() {
    const valor = Number(kmAMano.replace(",", "."));
    if (!Number.isFinite(valor) || valor < 0 || valor > 999) {
      setMsg("Escribe los kilómetros, por ejemplo 4.3.");
      return;
    }
    setMsg(null);
    actualizar(item.id, {
      distancia: { km: aDecimas(valor), fuente: "manual", enLinea: enLinea ?? aDecimas(valor) },
    });
    setKmAMano("");
  }

  return (
    <>
      {!origen && (
        <Aviso tono="atento" titulo="La tienda todavía no tiene ubicación">
          <p>
            Sin el punto de partida no se puede medir sola.{" "}
            <Link href="/ajustes" className="font-semibold underline">
              Elígelo en Ajustes
            </Link>
            , o escribe los kilómetros a mano abajo.
          </p>
        </Aviso>
      )}

      <RadarDeTramos regla={regla} km={d?.km ?? null} tienda={origen} cliente={item.punto} />

      {u.estado === "buscando" && <p className="text-sm text-tinta-2">Buscando la dirección…</p>}
      {u.estado === "ok" && (
        <Aviso tono="bien" titulo={u.etiqueta ?? "Ubicada"}>
          <p>{d ? `${d.km.toFixed(1)} km ${d.fuente === "ruta" ? "por calles" : d.fuente === "estimado" ? "por calles (estimado)" : d.fuente === "manual" ? "a mano" : "en línea recta"}.` : "Ubicación puesta."}</p>
        </Aviso>
      )}
      {u.estado === "varias" && (
        <div className="flex flex-col gap-2 rounded-btn bg-aviso-suave p-3 text-aviso">
          <p className="flex gap-2 text-sm">
            <Alerta className="mt-0.5 size-[18px] shrink-0" />
            <span>
              <b className="block">Hay {u.candidatos.length} ubicaciones posibles</b>
              La dirección no se leyó completa. Elige la correcta.
            </span>
          </p>
          {u.candidatos.map((c, i) => (
            <button
              key={`${c.lat}-${c.lng}-${i}`}
              type="button"
              onClick={() => void fijarPunto(item.id, c, c.etiqueta)}
              className="flex min-h-11 items-center gap-2 rounded-btn border border-linea-fuerte bg-sup px-3 py-2 text-left text-sm text-tinta"
            >
              <Pin className="size-4 shrink-0" />
              {c.etiqueta}
            </button>
          ))}
        </div>
      )}
      {(u.estado === "no" || u.estado === "error") && (
        <Aviso tono="mal" titulo={u.mensaje ?? "No se encontró la dirección"}>
          <p>Prueba a corregirla en «Cliente», a pegar un enlace de Maps, o a escribir los kilómetros a mano.</p>
        </Aviso>
      )}

      {d && (
        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="flex flex-col rounded-btn bg-sup-2 px-1 py-2">
            <b className="font-display text-lg leading-tight [zoom:var(--zoom-titulo,1)]">{enLinea !== null ? `${enLinea} km` : "—"}</b>
            <span className="text-[11.5px] font-semibold text-tinta-2">En línea recta</span>
          </div>
          <div className="flex flex-col rounded-btn bg-sup-2 px-1 py-2">
            <b className="font-display text-lg leading-tight [zoom:var(--zoom-titulo,1)]">{d.km.toFixed(1)} km</b>
            <span className="text-[11.5px] font-semibold text-tinta-2">Distancia usada</span>
          </div>
          <div className="flex flex-col rounded-btn bg-acento px-1 py-2 text-acento-texto">
            <b className="font-display text-lg leading-tight [zoom:var(--zoom-titulo,1)]">
              {calculado && calculado.tramo === TRAMO_MAS_DE_12_KM ? "+12 km" : `T${calculado?.tramo ?? 1}`}
            </b>
            <span className="text-[11.5px] font-semibold opacity-90">
              {calculado?.montoCentimos != null ? formatearSoles(calculado.montoCentimos) : "a mano"}
            </span>
          </div>
        </div>
      )}

      {masDe12 && (
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-semibold">Más de 12 km: ¿cuánto se cobra por este pedido?</span>
          <input
            value={item.montoManual}
            onChange={(e) => actualizar(item.id, { montoManual: e.target.value })}
            inputMode="decimal"
            placeholder="18.00"
            className="min-h-11 rounded-btn border border-linea-fuerte bg-sup px-3 text-base"
          />
        </label>
      )}

      {msg && <p className="rounded-btn bg-mal-suave px-3 py-2 text-sm text-mal">{msg}</p>}

      <div className="flex flex-col gap-2 border-t border-linea pt-4">
        <button
          type="button"
          className="boton-sec justify-start"
          disabled={!origen || !consulta || u.estado === "buscando"}
          onClick={() => consulta && void ubicar(item.id, consulta)}
        >
          <Pin className="size-[18px]" />
          {u.estado === "pendiente" || u.estado === "sin-tienda" ? "Buscar la dirección" : "Buscar de nuevo"}
        </button>

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
              className="min-h-11 min-w-0 flex-1 rounded-btn border border-linea-fuerte bg-sup px-3 text-base"
            />
            <button type="button" className="boton-sec" disabled={ocupado || !enlace.trim() || !origen} onClick={() => void usarEnlace()}>
              Usar
            </button>
          </div>
        </label>

        <div className="flex flex-col gap-1.5">
          <span className="text-sm font-semibold">Escribir los kilómetros</span>
          <p className="text-xs text-tinta-2">Si Waze o Maps te dicen otra distancia, escríbela: es la que manda.</p>
          <div className="flex gap-2">
            <input
              value={kmAMano}
              onChange={(e) => setKmAMano(e.target.value)}
              inputMode="decimal"
              placeholder="4.3"
              aria-label="Kilómetros"
              className="min-h-11 w-28 rounded-btn border border-linea-fuerte bg-sup px-3 text-base"
            />
            <button type="button" className="boton-sec" disabled={!kmAMano.trim()} onClick={guardarKm}>
              Usar
            </button>
          </div>
        </div>

        {item.punto && (
          <a
            className="inline-flex min-h-11 items-center gap-2 self-start text-sm font-semibold text-acento-tinta"
            href={enlaceDeMapa(item.punto)}
            target="_blank"
            rel="noreferrer"
          >
            <Pin className="size-4" />
            Ver el punto en Maps
          </a>
        )}
      </div>

      <p className="text-xs text-tinta-3">
        {tienda ? `${tienda.nombre} mide ${tienda.metodoDistancia === "calles" ? "por calles (como Waze o Maps)" : "en línea recta"}.` : ""}{" "}
        {tienda?.lat != null ? "El tramo sale de la distancia; puedes cambiarlo después en el pedido." : ""}
      </p>
    </>
  );
}
