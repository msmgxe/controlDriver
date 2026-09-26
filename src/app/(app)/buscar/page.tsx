"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";

import { Acordeon } from "@/components/Acordeon";
import { Buscar as IconoBuscar, Flecha, Pin, Telefono, Usuario } from "@/components/iconos";
import { Pestanas } from "@/components/Pestanas";
import { EstadoPedido, Vacio } from "@/components/ui";
import { useDatos } from "@/hooks/useDatos";
import { buscarPedidos, resumenPorRango } from "@/lib/db/sqlite/jornadas";
import {
  diaDeLaSemana,
  formatearFecha,
  hoyEnLima,
  nombreDelDia,
  rangoDeFechas,
  sumarDias,
  type FechaISO,
} from "@/lib/fechas";
import { formatearSoles } from "@/lib/pagos/reglas";
import type { CampoDeBusqueda, PedidoEncontrado } from "@/lib/db/tipos";

/**
 * Buscar un pedido, en un rango de días.
 *
 * La pregunta de siempre es «la tienda me pregunta por este pedido», pero casi
 * nunca se sabe el día exacto, ni se tiene el código entero. Aquí se da lo que
 * se sepa: **parte del código**, **un rango de días**, o las dos cosas. Con solo
 * el rango salen todos los pedidos de esos días; con solo el código, los de los
 * últimos treinta.
 *
 * El rango se elige de tres maneras, según lo preciso que haga falta:
 *   · un atajo —Hoy, 7 días…—, un toque;
 *   · la **línea de días**: tocar el primero y el último, como las paradas de un
 *     recorrido, y lo de en medio se ilumina;
 *   · las dos fechas escritas, para irse más atrás de treinta días.
 *
 * **Además del código, se busca por lo que se guardó del cliente**: su nombre,
 * su teléfono o su calle. Sirve para «¿qué pedido era el de la señora Rosa?».
 * Solo encuentra en los pedidos donde se guardó ese dato.
 *
 * El rango va en un acordeón cerrado: casi siempre basta con el de siempre, y
 * el acordeón dice cuál es sin abrirlo. Cada resultado lleva al detalle de su
 * día.
 */

const CAMPOS: Array<{ id: CampoDeBusqueda; etiqueta: string; marcador: string }> = [
  { id: "codigo", etiqueta: "Código", marcador: "Código o parte de él" },
  { id: "cliente", etiqueta: "Cliente", marcador: "Nombre del cliente" },
  { id: "telefono", etiqueta: "Teléfono", marcador: "Teléfono o sus últimos dígitos" },
  { id: "direccion", etiqueta: "Dirección", marcador: "Calle o urbanización" },
];

const INICIALES = ["D", "L", "M", "X", "J", "V", "S"];
const DIAS_EN_LA_LINEA = 30;
const POR_PAGINA = 40;

const ATAJOS: Array<{ id: string; nombre: string; dias: number }> = [
  { id: "hoy", nombre: "Hoy", dias: 1 },
  { id: "7", nombre: "7 días", dias: 7 },
  { id: "14", nombre: "14 días", dias: 14 },
  { id: "30", nombre: "30 días", dias: 30 },
];

export default function PaginaBuscar() {
  const hoy = hoyEnLima();
  const [campo, setCampo] = useState<CampoDeBusqueda>("codigo");
  const [texto, setTexto] = useState("");
  const [desde, setDesde] = useState<FechaISO>(sumarDias(hoy, -6));
  const [hasta, setHasta] = useState<FechaISO>(hoy);
  // El primer toque de la línea de días, a la espera del segundo.
  const [punta, setPunta] = useState<FechaISO | null>(null);
  const [visibles, setVisibles] = useState(POR_PAGINA);

  const dias = rangoDeFechas(sumarDias(hoy, -(DIAS_EN_LA_LINEA - 1)), hoy);

  // Qué días tienen algo cargado, para el punto de la línea.
  const { datos: cargados } = useDatos(
    async () =>
      new Set((await resumenPorRango(dias[0], hoy)).map((f) => f.fecha as FechaISO)),
    [hoy],
  );

  // Un código no lleva espacios; un nombre o una calle, sí.
  const limpio = campo === "codigo" ? texto.replace(/\s/g, "") : texto.trim();
  const clave = `${campo}|${limpio}|${desde}|${hasta}`;
  const [resultado, setResultado] = useState<{ clave: string; filas: PedidoEncontrado[] } | null>(
    null,
  );

  /* La búsqueda espera un instante tras la última tecla, y **conserva los
     resultados de antes** mientras llegan los nuevos: sin eso, cada letra
     vaciaba la lista y enseñaba un «Ningún pedido» fugaz. */
  useEffect(() => {
    let vigente = true;
    const espera = setTimeout(() => {
      buscarPedidos(limpio, { desde, hasta, campo })
        .then((filas) => vigente && setResultado({ clave, filas }))
        .catch(() => vigente && setResultado({ clave, filas: [] }));
    }, 150);
    return () => {
      vigente = false;
      clearTimeout(espera);
    };
  }, [clave, limpio, desde, hasta, campo]);

  function elegirDia(fecha: FechaISO) {
    setVisibles(POR_PAGINA);
    if (punta === null) {
      setDesde(fecha);
      setHasta(fecha);
      setPunta(fecha);
    } else {
      setDesde(fecha < punta ? fecha : punta);
      setHasta(fecha < punta ? punta : fecha);
      setPunta(null);
    }
  }

  function elegirAtajo(n: number) {
    setPunta(null);
    setVisibles(POR_PAGINA);
    setHasta(hoy);
    setDesde(sumarDias(hoy, -(n - 1)));
  }

  const filas = resultado?.filas ?? [];
  const actualizando = resultado?.clave !== clave;
  const grupos = agruparPorDia(filas.slice(0, visibles));

  return (
    <div className="mx-auto flex max-w-[880px] flex-col gap-4">
      <div className="flex items-center gap-2 rounded-btn border border-linea-fuerte bg-sup px-3 focus-within:border-acento focus-within:ring-2 focus-within:ring-acento/30">
        <IconoBuscar className="size-5 shrink-0 text-tinta-3" />
        <label htmlFor="codigo-a-buscar" className="sr-only">
          Qué buscar
        </label>
        <input
          id="codigo-a-buscar"
          value={texto}
          onChange={(e) => {
            setTexto(e.target.value);
            setVisibles(POR_PAGINA);
          }}
          inputMode={campo === "telefono" ? "tel" : "text"}
          autoComplete="off"
          autoCapitalize="off"
          spellCheck={false}
          placeholder={CAMPOS.find((c) => c.id === campo)?.marcador}
          className={`min-h-12 min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-tinta-3 ${
            campo === "codigo" || campo === "telefono" ? "font-mono" : ""
          }`}
        />
        {texto && (
          <button
            type="button"
            aria-label="Borrar lo escrito"
            onClick={() => setTexto("")}
            className="grid size-8 place-items-center rounded-full text-tinta-2 hover:bg-sup-2"
          >
            ✕
          </button>
        )}
      </div>

      <Pestanas
        etiqueta="Buscar por"
        actual={campo}
        alCambiar={(id) => {
          setCampo(id as CampoDeBusqueda);
          setTexto("");
          setVisibles(POR_PAGINA);
        }}
        items={CAMPOS.map((c) => ({ id: c.id, etiqueta: c.etiqueta }))}
      />
      {campo !== "codigo" && (
        <p className="-mt-2 text-xs text-tinta-3">
          Busca solo en los pedidos donde guardaste {campo === "cliente" ? "el nombre" : campo === "telefono" ? "el teléfono" : "la dirección"}.
        </p>
      )}

      <Acordeon
        titulo="Rango de días"
        resumen={
          desde === hasta
            ? formatearFecha(desde)
            : `${formatearFecha(desde).slice(0, 5)} – ${formatearFecha(hasta).slice(0, 5)}`
        }
      >
        <div className="flex flex-wrap gap-2" role="group" aria-label="Atajos de rango">
          {ATAJOS.map((a) => {
            const activo = hasta === hoy && desde === sumarDias(hoy, -(a.dias - 1));
            return (
              <button
                key={a.id}
                type="button"
                aria-pressed={activo}
                onClick={() => elegirAtajo(a.dias)}
                className={`min-h-9 rounded-chip border px-3 text-xs font-bold ${
                  activo
                    ? "border-tinta bg-tinta text-papel"
                    : "border-linea bg-sup-2 text-tinta-2 hover:bg-linea"
                }`}
              >
                {a.nombre}
              </button>
            );
          })}
        </div>

        <LineaDeDias
          dias={dias}
          desde={desde}
          hasta={hasta}
          cargados={cargados}
          alElegir={elegirDia}
        />
        <p className="text-xs text-tinta-3">
          {punta
            ? "Ahora toca el último día del rango."
            : "Toca el primer día y el último, o usa un atajo."}
        </p>

        <div className="grid grid-cols-2 gap-3">
          <CampoFecha
            id="fecha-desde"
            etiqueta="Desde"
            valor={desde}
            max={hasta}
            alCambiar={(f) => {
              setDesde(f);
              setPunta(null);
              setVisibles(POR_PAGINA);
            }}
          />
          <CampoFecha
            id="fecha-hasta"
            etiqueta="Hasta"
            valor={hasta}
            min={desde}
            max={hoy}
            alCambiar={(f) => {
              setHasta(f);
              setPunta(null);
              setVisibles(POR_PAGINA);
            }}
          />
        </div>
      </Acordeon>

      <div className="flex items-baseline justify-between gap-3" aria-live="polite">
        <h2 className="text-base">
          {resultado === null
            ? "Buscando…"
            : filas.length === 1
              ? "1 pedido"
              : `${filas.length} pedidos`}
        </h2>
        <span className="font-mono text-xs text-tinta-3">
          {desde === hasta
            ? formatearFecha(desde)
            : `${formatearFecha(desde).slice(0, 5)} – ${formatearFecha(hasta).slice(0, 5)}`}
        </span>
      </div>

      <div className={`flex flex-col gap-3 transition-opacity ${actualizando ? "opacity-60" : ""}`}>
        {resultado !== null && filas.length === 0 && (
          <Vacio>
            <b className="block text-tinta">Ningún pedido</b>
            {limpio ? `con «${limpio}» ` : ""}entre el {formatearFecha(desde)} y el{" "}
            {formatearFecha(hasta)}. Amplía el rango o revisa {campo === "codigo" ? "el código" : "lo que escribiste"}.
          </Vacio>
        )}

        {grupos.map(([fecha, pedidos]) => (
          <section key={fecha} className="tarjeta flex flex-col p-0" aria-label={formatearFecha(fecha)}>
            <Link
              href={`/?dia=${fecha}`}
              className="flex min-h-11 items-center justify-between gap-2 rounded-t-card bg-sup-2 px-4 text-sm font-bold"
            >
              <span className="capitalize">
                {nombreDelDia(fecha)} {formatearFecha(fecha).slice(0, 5)}
              </span>
              <span className="inline-flex items-center gap-1 text-xs font-semibold text-acento">
                {pedidos.length} pedido{pedidos.length === 1 ? "" : "s"}
                <Flecha className="size-3.5" />
              </span>
            </Link>
            <ul>
              {pedidos.map((p) => (
                <li key={`${p.fecha}-${p.codigo}`}>
                  <Link
                    href={`/?dia=${p.fecha}`}
                    className="grid grid-cols-[1fr_auto] items-center gap-x-3 gap-y-1 border-t border-linea px-4 py-3"
                  >
                    <span className="codigo min-w-0 truncate">{resaltar(p.codigo, limpio)}</span>
                    <EstadoPedido estado={p.estado} />
                    <span className="flex flex-wrap items-center gap-2 text-xs text-tinta-3">
                      <span className="rounded-chip bg-sup-2 px-2 py-0.5 font-semibold text-tinta-2">
                        {p.ruta === null ? "Sin ruta" : `Ruta ${p.ruta}`}
                      </span>
                      {p.horaInicio && p.horaFin && (
                        <span className="font-mono">
                          {p.horaInicio}–{p.horaFin}
                        </span>
                      )}
                      {p.tramo > 1 && (
                        <span className="rounded-chip border border-linea-fuerte px-2 py-0.5 font-mono text-tinta-2">
                          {p.tramo === 6 ? "+12 km" : `T${p.tramo}`}
                        </span>
                      )}
                      {p.km !== null && <span className="font-mono">{p.km.toFixed(1)} km</span>}
                    </span>
                    <span className="monto justify-self-end text-xs text-tinta-2">
                      {formatearSoles(p.montoCentimos ?? 0)}
                    </span>
                    {/* Lo que se guardó del cliente: es lo que se buscó, y lo que dice de quién es. */}
                    {p.cliente && (p.cliente.nombre || p.cliente.telefono || p.cliente.direccion) && (
                      <span className="col-span-2 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-tinta-2">
                        {p.cliente.nombre && (
                          <span className="inline-flex items-center gap-1">
                            <Usuario className="size-3.5" />
                            {resaltarTexto(p.cliente.nombre, campo === "cliente" ? limpio : "")}
                          </span>
                        )}
                        {p.cliente.telefono && (
                          <span className="inline-flex items-center gap-1 font-mono">
                            <Telefono className="size-3.5" />
                            {p.cliente.telefono}
                          </span>
                        )}
                        {p.cliente.direccion && (
                          <span className="inline-flex min-w-0 items-center gap-1">
                            <Pin className="size-3.5 shrink-0" />
                            <span className="truncate">{resaltarTexto(p.cliente.direccion, campo === "direccion" ? limpio : "")}</span>
                          </span>
                        )}
                      </span>
                    )}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ))}

        {filas.length > visibles && (
          <button
            type="button"
            className="boton-sec self-center"
            onClick={() => setVisibles((v) => v + POR_PAGINA)}
          >
            Ver {Math.min(POR_PAGINA, filas.length - visibles)} más
          </button>
        )}
      </div>
    </div>
  );
}

/** Los pedidos agrupados por día, respetando el orden en que llegan. */
function agruparPorDia(filas: PedidoEncontrado[]): Array<[FechaISO, PedidoEncontrado[]]> {
  const grupos = new Map<FechaISO, PedidoEncontrado[]>();
  for (const f of filas) {
    const grupo = grupos.get(f.fecha);
    if (grupo) grupo.push(f);
    else grupos.set(f.fecha, [f]);
  }
  return [...grupos.entries()];
}

/** El código con lo buscado resaltado. */
function resaltar(codigo: string, buscado: string): React.ReactNode {
  if (!buscado) return codigo;
  const i = codigo.toLowerCase().indexOf(buscado.toLowerCase());
  if (i === -1) return codigo;
  return (
    <>
      {codigo.slice(0, i)}
      <mark className="rounded-sm bg-acento/25 px-0.5 text-inherit">
        {codigo.slice(i, i + buscado.length)}
      </mark>
      {codigo.slice(i + buscado.length)}
    </>
  );
}

/** Lo buscado resaltado dentro de un texto, sin distinguir tildes ni mayúsculas. */
function resaltarTexto(texto: string, buscado: string): React.ReactNode {
  if (!buscado) return texto;
  const sinTildes = (t: string) => t.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  // Quitar las tildes no cambia el largo de un texto ya compuesto (NFC → NFD → sin marcas).
  const i = sinTildes(texto).indexOf(sinTildes(buscado));
  if (i === -1 || sinTildes(texto).length !== texto.length) return texto;
  return (
    <>
      {texto.slice(0, i)}
      <mark className="rounded-sm bg-acento/25 px-0.5 text-inherit">{texto.slice(i, i + buscado.length)}</mark>
      {texto.slice(i + buscado.length)}
    </>
  );
}

function CampoFecha({
  id,
  etiqueta,
  valor,
  min,
  max,
  alCambiar,
}: {
  id: string;
  etiqueta: string;
  valor: FechaISO;
  min?: FechaISO;
  max?: FechaISO;
  alCambiar: (f: FechaISO) => void;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <label htmlFor={id} className="text-[11px] font-semibold text-tinta-3 uppercase">
        {etiqueta}
      </label>
      <input
        id={id}
        type="date"
        value={valor}
        min={min}
        max={max}
        onChange={(e) => e.target.value && alCambiar(e.target.value as FechaISO)}
        className="min-h-11 min-w-0 rounded-btn border border-linea-fuerte bg-sup px-3 text-sm"
      />
    </div>
  );
}

/**
 * Los últimos treinta días sobre una línea: el rango son las paradas entre dos
 * toques, y lo de en medio se ilumina como un tramo de carretera.
 */
function LineaDeDias({
  dias,
  desde,
  hasta,
  cargados,
  alElegir,
}: {
  dias: FechaISO[];
  desde: FechaISO;
  hasta: FechaISO;
  cargados: ReadonlySet<FechaISO> | null;
  alElegir: (f: FechaISO) => void;
}) {
  const contenedor = useRef<HTMLDivElement>(null);

  // Al abrir, la línea se lee desde hoy hacia atrás: se empieza por el final.
  useEffect(() => {
    const el = contenedor.current;
    if (el) el.scrollLeft = el.scrollWidth;
  }, []);

  return (
    <div ref={contenedor} className="-mx-1 overflow-x-auto px-1 pb-1">
      <div className="relative flex w-max gap-1">
        {dias.map((f, i) => {
          const extremo = f === desde || f === hasta;
          const dentro = f > desde && f < hasta;
          const numero = Number(f.slice(8));
          const nuevoMes = numero === 1 || i === 0;
          return (
            <button
              key={f}
              type="button"
              aria-pressed={extremo}
              aria-label={`${nombreDelDia(f)} ${numero}${cargados?.has(f) ? ", con pedidos" : ""}`}
              onClick={() => alElegir(f)}
              className={`flex min-h-[58px] w-9 shrink-0 flex-col items-center justify-center gap-0.5 text-[10px] ${
                extremo
                  ? "rounded-btn bg-acento text-acento-texto"
                  : dentro
                    ? "bg-acento-suave text-acento-tinta"
                    : "rounded-btn text-tinta-3"
              }`}
            >
              <span>{nuevoMes ? MES_CORTO[Number(f.slice(5, 7)) - 1] : INICIALES[diaDeLaSemana(f)]}</span>
              <b className="font-mono text-xs font-semibold">{numero}</b>
              <span
                aria-hidden
                className={`size-1.5 rounded-full ${
                  cargados?.has(f) ? (extremo ? "bg-acento-texto" : "bg-acento") : "bg-transparent"
                }`}
              />
            </button>
          );
        })}
      </div>
    </div>
  );
}

const MES_CORTO = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
