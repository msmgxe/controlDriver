"use client";

import { useState, useTransition } from "react";

import { cambiarHorarioDeJornada, eliminarJornada } from "@/app/(app)/jornada/acciones";
import { DueloDePago } from "@/components/DueloDePago";
import { FilaPedidoSimple } from "@/components/FilaPedidoSimple";
import { HojaDePedido } from "@/components/HojaDePedido";
import { Camara, Flecha, Reloj, Equis } from "@/components/iconos";
import { Pestanas } from "@/components/Pestanas";
import { PruebasDelDia } from "@/components/PruebasDelDia";
import { Aviso } from "@/components/ui";
import type { AjustesDeComandas } from "@/lib/db/sqlite/ajustes";
import { esCodigoPendiente } from "@/lib/db/sqlite/jornadas";
import { borrarRuta } from "@/lib/db/sqlite/rutas";
import type { JornadaCompleta, Tienda } from "@/lib/db/tipos";
import type { FechaISO } from "@/lib/fechas";
import { horasDePermanencia, formatearSoles, montoPorPermanencia, type ReglaPago } from "@/lib/pagos/reglas";

/**
 * Lo que se subió de un día, en dos pestañas: **Pedidos** y **Rutas**.
 *
 * Es el contenido del acordeón «Detalle de lo subido» de Inicio, y reúne lo que
 * antes estaba repartido entre la pantalla de la jornada y el recorrido de
 * Inicio. Al pie, tres filas para lo que se usa menos —las capturas del día, el
 * horario en tienda y borrar el día— y que no hace falta tener a la vista.
 *
 * Tocar un pedido abre su hoja, con pestañas de Pedido, Cliente, Distancia y
 * Evidencia. En una semana ya pagada la hoja se abre igual, pero solo para ver.
 */

const PEDIDOS_A_LA_VISTA = 5;

export function DetalleDelDia({
  fecha,
  jornada,
  regla,
  tienda,
  ajustes,
  editable,
  alCambiar,
}: {
  fecha: FechaISO;
  jornada: JornadaCompleta;
  regla: ReglaPago;
  tienda: Tienda | null;
  ajustes: AjustesDeComandas;
  /** Falso en una semana ya pagada. */
  editable: boolean;
  /** Vuelve a leer el día. */
  alCambiar: () => void;
}) {
  const [pestana, setPestana] = useState("pedidos");
  const [verTodos, setVerTodos] = useState(false);
  const [abierta, setAbierta] = useState<"capturas" | "horario" | "borrar" | null>(null);
  const [editando, setEditando] = useState<string | null>(null);
  const [pendiente, iniciar] = useTransition();
  const [aviso, setAviso] = useState<{ tono: "bien" | "mal"; texto: string } | null>(null);

  const horaDeRuta = new Map(jornada.rutas.map((r) => [r.numero, r.horaInicio]));
  const ordenEditando = jornada.ordenes.find((o) => o.id === editando) ?? null;
  const visibles = verTodos ? jornada.ordenes : jornada.ordenes.slice(0, PEDIDOS_A_LA_VISTA);
  const capturasYFotos = jornada.ordenes.reduce((s, o) => s + o.fotos, 0);
  const pagaPermanencia = Boolean(regla.garantiaPermanencia?.activa);

  function alternar(cual: "capturas" | "horario" | "borrar") {
    setAbierta((a) => (a === cual ? null : cual));
    setAviso(null);
  }

  return (
    <>
      <Pestanas
        etiqueta="Qué ver de lo subido"
        actual={pestana}
        alCambiar={setPestana}
        items={[
          { id: "pedidos", etiqueta: "Pedidos", cuenta: jornada.ordenes.length },
          { id: "rutas", etiqueta: "Rutas", cuenta: jornada.rutas.length },
        ]}
      />

      {aviso && <Aviso tono={aviso.tono} titulo={aviso.texto} />}

      {pestana === "pedidos" && (
        <>
          {/* Una lista plana, un pedido por fila, en el orden en que se hicieron.
              Un pedido sin ruta va al final, donde se ve y se puede corregir. */}
          <div className="overflow-hidden rounded-card border border-linea bg-sup">
            {jornada.ordenes.length === 0 ? (
              <p className="px-4 py-6 text-sm text-tinta-3">Este día no tiene pedidos.</p>
            ) : (
              visibles.map((o) => (
                <FilaPedidoSimple
                  key={o.id}
                  codigo={o.codigo}
                  ruta={o.ruta}
                  hora={o.ruta !== null ? (horaDeRuta.get(o.ruta) ?? null) : null}
                  estado={o.estado}
                  tramo={o.tramo}
                  monto={formatearSoles(o.montoCentimos ?? 0)}
                  manual={o.manual}
                  porCompletar={esCodigoPendiente(o.codigo)}
                  km={o.km}
                  cliente={o.cliente?.nombre ?? null}
                  conFoto={o.fotos > 0}
                  onClick={() => setEditando(o.id)}
                />
              ))
            )}
          </div>
          {jornada.ordenes.length > PEDIDOS_A_LA_VISTA && (
            <button
              type="button"
              onClick={() => setVerTodos((v) => !v)}
              className="inline-flex min-h-11 items-center gap-2 self-start text-sm font-semibold text-acento"
            >
              {verTodos ? "Ver menos" : `Ver los ${jornada.ordenes.length} pedidos`}
              <Flecha className={`size-4 ${verTodos ? "-rotate-90" : "rotate-90"}`} />
            </button>
          )}
        </>
      )}

      {pestana === "rutas" && (
        <RutasDelDia
          jornada={jornada}
          editable={editable}
          alBorrar={(id) =>
            iniciar(async () => {
              await borrarRuta(id);
              alCambiar();
            })
          }
        />
      )}

      {/* Lo que se usa menos: tres filas que se abren aquí mismo. */}
      <div className="overflow-hidden rounded-card border border-linea bg-sup">
        <FilaDePie
          Icono={Camara}
          titulo="Capturas y fotos del día"
          valor={`${capturasYFotos > 0 ? `${capturasYFotos} de pedidos` : "tu respaldo"}`}
          abierta={abierta === "capturas"}
          alPulsar={() => alternar("capturas")}
        />
        {abierta === "capturas" && (
          <div className="border-t border-linea p-3">
            <PruebasDelDia fecha={fecha} />
          </div>
        )}

        {pagaPermanencia && (
          <>
            <FilaDePie
              Icono={Reloj}
              titulo="Horario en tienda"
              valor={jornada.horaEntrada && jornada.horaSalida ? `${jornada.horaEntrada} – ${jornada.horaSalida}` : "sin horario"}
              abierta={abierta === "horario"}
              alPulsar={() => alternar("horario")}
            />
            {abierta === "horario" && (
              <div className="border-t border-linea p-3">
                <HorarioEnTienda
                  fecha={fecha}
                  jornada={jornada}
                  regla={regla}
                  editable={editable}
                  alCambiar={alCambiar}
                />
              </div>
            )}
          </>
        )}

        {editable && (
          <>
            <FilaDePie
              Icono={Equis}
              titulo="Borrar este día"
              valor=""
              peligro
              abierta={abierta === "borrar"}
              alPulsar={() => alternar("borrar")}
            />
            {abierta === "borrar" && (
              <div className="flex flex-col gap-3 border-t border-linea p-3">
                <p className="text-sm text-tinta-2">
                  Se va el día entero con sus {jornada.rutas.length} rutas y {jornada.ordenes.length} pedidos
                  {capturasYFotos > 0 ? " —y con ellos sus datos de clientes y fotos—" : ""}. No se puede deshacer, y este día
                  ya cuenta para tu semana.
                </p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={pendiente}
                    className="min-h-11 flex-1 rounded-btn bg-mal px-4 text-sm font-semibold text-white"
                    onClick={() =>
                      iniciar(async () => {
                        const r = await eliminarJornada(fecha, jornada.ordenes.length);
                        if (r.ok) {
                          setAbierta(null);
                          alCambiar();
                        } else setAviso({ tono: "mal", texto: r.error });
                      })
                    }
                  >
                    {pendiente ? "Borrando…" : "Sí, borrar el día completo"}
                  </button>
                  <button type="button" className="boton-sec" onClick={() => setAbierta(null)}>
                    Cancelar
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {ordenEditando && (
        <HojaDePedido
          // Al cambiar de pedido, un formulario nuevo: no arrastra lo escrito en el anterior.
          key={ordenEditando.id}
          fecha={fecha}
          orden={ordenEditando}
          regla={regla}
          rutas={jornada.rutas.map((r) => ({ numero: r.numero, inicio: r.horaInicio }))}
          tienda={tienda}
          ajustes={ajustes}
          editable={editable}
          alCerrar={() => setEditando(null)}
          alCambiar={alCambiar}
        />
      )}
    </>
  );
}

function FilaDePie({
  Icono,
  titulo,
  valor,
  abierta,
  peligro = false,
  alPulsar,
}: {
  Icono: typeof Camara;
  titulo: string;
  valor: string;
  abierta: boolean;
  peligro?: boolean;
  alPulsar: () => void;
}) {
  return (
    <button
      type="button"
      onClick={alPulsar}
      aria-expanded={abierta}
      className={`flex min-h-12 w-full items-center gap-3 border-b border-linea px-4 text-left text-sm font-semibold last:border-b-0 ${
        peligro ? "text-mal" : ""
      }`}
    >
      <Icono className="size-[18px] shrink-0" />
      <span className="flex-1">{titulo}</span>
      {valor && <span className="font-mono text-xs font-medium text-tinta-3">{valor}</span>}
      <Flecha className={`size-4 shrink-0 text-tinta-3 transition-transform ${abierta ? "-rotate-90" : "rotate-90"}`} />
    </button>
  );
}

/* ---------------------------------------------------------------------------
 * Rutas
 * ------------------------------------------------------------------------- */

/**
 * El recorrido del día: cada ruta, una parada. Con su horario, cuántos pedidos
 * llevó y, si se puede, un botón para borrarla.
 */
function RutasDelDia({
  jornada,
  editable,
  alBorrar,
}: {
  jornada: JornadaCompleta;
  editable: boolean;
  alBorrar: (id: string) => void;
}) {
  if (jornada.rutas.length === 0) {
    return (
      <p className="text-sm text-tinta-3">
        Todavía no hay ninguna ruta este día. Añádelas en «Subir más», en la pestaña Ruta.
      </p>
    );
  }
  const rutas = [...jornada.rutas].sort((a, b) => a.numero - b.numero);
  const pedidosDe = (numero: number) => jornada.ordenes.filter((o) => o.ruta === numero).length;
  const sinRuta = jornada.ordenes.filter((o) => o.ruta === null).length;

  return (
    <>
      <ol className="flex flex-col">
        {rutas.map((r, i) => (
          <Parada
            key={r.id}
            primera={i === 0}
            ultima={i === rutas.length - 1}
            pin={String(r.numero)}
            titulo={`Ruta ${r.numero}`}
            detalle={r.horaInicio && r.horaFin ? `${r.horaInicio} – ${r.horaFin}` : "Sin horario"}
            etiqueta={`${pedidosDe(r.numero)} pedido${pedidosDe(r.numero) === 1 ? "" : "s"}`}
            alBorrar={editable ? () => alBorrar(r.id) : undefined}
          />
        ))}
      </ol>
      {sinRuta > 0 && (
        <p className="text-xs text-tinta-3">
          {sinRuta} pedido{sinRuta === 1 ? "" : "s"} sin ruta: tócalos en la pestaña Pedidos para asignarla.
        </p>
      )}
    </>
  );
}

/** Una parada del recorrido: un pin numerado sobre una línea discontinua. */
function Parada({
  pin,
  titulo,
  detalle,
  etiqueta,
  primera,
  ultima,
  alBorrar,
}: {
  pin: string;
  titulo: string;
  detalle: string;
  etiqueta: string;
  primera: boolean;
  ultima: boolean;
  alBorrar?: () => void;
}) {
  return (
    <li
      className={`relative grid grid-cols-[24px_1fr_auto] items-center gap-3 py-2 before:absolute before:left-3 before:border-l-2 before:border-dashed before:border-acento/40 before:content-[''] ${
        primera ? "before:top-1/2" : "before:top-0"
      } ${ultima ? "before:bottom-1/2" : "before:bottom-0"}`}
    >
      <span className="relative z-10 grid size-6 -rotate-45 place-items-center rounded-[50%_50%_50%_4px] bg-acento text-acento-texto">
        <b className="rotate-45 font-mono text-[10px] leading-none">{pin}</b>
      </span>
      <span className="flex min-w-0 flex-col">
        <b className="truncate text-sm font-bold">{titulo}</b>
        <span className="font-mono text-xs text-tinta-3">{detalle}</span>
      </span>
      <span className="flex items-center gap-2">
        <span className="rounded-chip bg-sup-2 px-2.5 py-0.5 text-[11px] font-semibold text-tinta-2">{etiqueta}</span>
        {alBorrar && (
          <button
            type="button"
            onClick={alBorrar}
            aria-label={`Borrar ${titulo}`}
            className="grid size-8 place-items-center rounded-full text-mal"
          >
            <Equis className="size-4" />
          </button>
        )}
      </span>
    </li>
  );
}

/* ---------------------------------------------------------------------------
 * Horario en tienda
 * ------------------------------------------------------------------------- */

function HorarioEnTienda({
  fecha,
  jornada,
  regla,
  editable,
  alCambiar,
}: {
  fecha: FechaISO;
  jornada: JornadaCompleta;
  regla: ReglaPago;
  editable: boolean;
  alCambiar: () => void;
}) {
  const [entrada, setEntrada] = useState(jornada.horaEntrada ?? "");
  const [salida, setSalida] = useState(jornada.horaSalida ?? "");
  const [pendiente, iniciar] = useTransition();
  const [aviso, setAviso] = useState<{ tono: "bien" | "mal"; texto: string } | null>(null);

  const totalPedidos = jornada.ordenes.reduce((s, o) => s + (o.montoCentimos ?? 0), 0);
  const horas = horasDePermanencia(entrada || null, salida || null);
  const montoPermanencia = montoPorPermanencia(regla, entrada || null, salida || null) ?? 0;

  return (
    <div className="flex flex-col gap-3">
      {aviso && <Aviso tono={aviso.tono} titulo={aviso.texto} />}
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="det-entrada" className="text-sm font-semibold">
            Entrada
          </label>
          <input
            id="det-entrada"
            type="time"
            value={entrada}
            disabled={!editable || pendiente}
            onChange={(e) => setEntrada(e.target.value)}
            className="min-h-11 rounded-btn border border-linea-fuerte bg-sup px-3 font-mono text-base disabled:opacity-60"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="det-salida" className="text-sm font-semibold">
            Salida
          </label>
          <input
            id="det-salida"
            type="time"
            value={salida}
            disabled={!editable || pendiente}
            onChange={(e) => setSalida(e.target.value)}
            className="min-h-11 rounded-btn border border-linea-fuerte bg-sup px-3 font-mono text-base disabled:opacity-60"
          />
        </div>
        {editable && (
          <button
            type="button"
            className="boton-sec"
            disabled={pendiente}
            onClick={() =>
              iniciar(async () => {
                const r = await cambiarHorarioDeJornada({
                  fecha,
                  horaEntrada: entrada || null,
                  horaSalida: salida || null,
                });
                setAviso(r.ok ? { tono: "bien", texto: r.mensaje } : { tono: "mal", texto: r.error });
                if (r.ok) alCambiar();
              })
            }
          >
            Guardar horario
          </button>
        )}
      </div>

      {/* Pedidos y permanencia como barras que compiten: la más larga es lo
          que se cobra. De la infografía —«compiten, no se suman»—. */}
      {horas > 0 && (
        <DueloDePago pedidosCentimos={totalPedidos} permanenciaCentimos={montoPermanencia} horas={horas} />
      )}
    </div>
  );
}
