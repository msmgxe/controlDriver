"use client";

import { useState } from "react";

import { FilaPedidoSimple } from "@/components/FilaPedidoSimple";
import { HojaDeCotejo } from "@/components/HojaDeCotejo";
import { HojaDePedido } from "@/components/HojaDePedido";
import { Check, Flecha, Hoja } from "@/components/iconos";
import { BotonPag, ChipDeColor } from "@/components/PagUi";
import { TarjetaBloqueExtra } from "@/components/TarjetaBloqueExtra";
import type { AjustesDeComandas } from "@/lib/db/sqlite/ajustes";
import { esCodigoPendiente } from "@/lib/db/sqlite/jornadas";
import { marcarContado } from "@/lib/db/sqlite/pedidos";
import type { BloqueExtraFila, JornadaCompleta, Tienda } from "@/lib/db/tipos";
import { nombreDelDia, type FechaISO } from "@/lib/fechas";
import type { DetalleDia } from "@/lib/pagos/calcular-liquidacion";
import { claveDeAdicional, type FilaDeDesglose } from "@/lib/pagos/desglose";
import {
  esPorZona,
  etiquetaTramo,
  formatearSoles,
  type ReglaPago,
} from "@/lib/pagos/reglas";

/** El color de cada fuente: el mismo botón de color en Inicio, Pagos y Estadísticas. */
const COLOR_FUENTE = {
  tienda: { fondo: "var(--acento)", texto: "var(--acento-texto)" },
  apoyo: { fondo: "var(--c-apoyo)", texto: "#fff" },
  taxi: { fondo: "var(--c-taxi)", texto: "var(--sol-tinta, #0a2260)" },
} as const;

interface DiaDeFuente {
  fecha: FechaISO;
  detalle: string;
  centimos: number;
}

const etiquetaDelDia = (f: FechaISO) =>
  `${nombreDelDia(f).slice(0, 3)} ${Number(f.slice(8))}`;

/**
 * «De dónde viene», con cada fuente **desplegable**: tocas el monto de tu tienda,
 * de un apoyo o del taxi y ves en qué días se produjo; tocas un día y ves sus
 * pedidos (o sus carreras, o su apoyo) y de ahí abres cada uno —con su foto de
 * evidencia, para corregirlo o quitarlo— sin salir de Pagos.
 */
/** Dónde se recuerda qué fuentes se ocultaron: una preferencia de vista, por teléfono. */
const CLAVE_OCULTAS = "pagos.fuentes-ocultas";

function leerOcultas(): string[] {
  try {
    const v = JSON.parse(localStorage.getItem(CLAVE_OCULTAS) ?? "[]");
    return Array.isArray(v)
      ? v.filter((x): x is string => typeof x === "string")
      : [];
  } catch {
    return [];
  }
}

/** Qué grupo de casilla manda sobre una fila: «tienda», «apoyo» o «adic:<tipo>». */
const grupoDe = (f: FilaDeDesglose): string =>
  f.categoria === "taxi" ? f.clave : f.categoria;

export function DesgloseDeFuentes({
  titulo,
  filas: todasLasFilas,
  jornadas,
  porDia,
  bloques,
  regla,
  tienda,
  ajustes,
  editable,
  alCambiar,
}: {
  titulo?: string;
  filas: readonly FilaDeDesglose[];
  jornadas: readonly JornadaCompleta[];
  porDia: readonly DetalleDia[];
  bloques: ReadonlyMap<FechaISO, BloqueExtraFila[]>;
  regla: ReglaPago;
  tienda: Tienda | null;
  ajustes: AjustesDeComandas;
  editable: boolean;
  alCambiar: () => void;
}) {
  const [fuenteAbierta, setFuenteAbierta] = useState<string | null>(null);
  const [diaAbierto, setDiaAbierto] = useState<string | null>(null);
  const [editandoId, setEditandoId] = useState<string | null>(null);

  /* Qué se ve. Es solo una vista: lo que se liquida y se paga no cambia nunca por
     ocultar una fuente. Se guardan las ocultas, no las visibles, para que un tipo
     de adicional nuevo aparezca marcado sin que haya que acordarse. */
  const [ocultas, setOcultas] = useState<string[]>(leerOcultas);
  const filas = todasLasFilas.filter((f) => !ocultas.includes(grupoDe(f)));
  const total = filas.reduce((s, f) => s + f.centimos, 0);
  const totalSemana = todasLasFilas.reduce((s, f) => s + f.centimos, 0);
  const hayQueElegir = todasLasFilas.length > 1;

  function alternar(grupo: string) {
    setOcultas((previas) => {
      const nuevas = previas.includes(grupo)
        ? previas.filter((g) => g !== grupo)
        : [...previas, grupo];
      try {
        localStorage.setItem(CLAVE_OCULTAS, JSON.stringify(nuevas));
      } catch {
        /* Sin almacenamiento, la elección vale solo mientras la pantalla esté abierta. */
      }
      return nuevas;
    });
  }
  const todas = jornadas.flatMap((j) =>
    j.ordenes.map((orden) => ({ orden, jornada: j })),
  );
  const editando = todas.find((x) => x.orden.id === editandoId) ?? null;

  /* El cotejo con el reporte de la empresa: cuántos pedidos de la semana se han
     marcado como contados. Mientras no se marque ninguno no hay nada que cotejar
     y no se enseñan avisos de «sin marcar». */
  const [soloFaltan, setSoloFaltan] = useState(false);
  const [cotejando, setCotejando] = useState(false);
  const contados = todas.filter((x) => x.orden.contado);
  const hayCotejo = contados.length > 0;
  const sinMarcar = todas.filter((x) => !x.orden.contado);
  const centimosSinMarcar = sinMarcar.reduce(
    (s, x) => s + (x.orden.montoCentimos ?? 0),
    0,
  );

  async function contar(id: string, valor: boolean) {
    await marcarContado(id, valor);
    alCambiar();
  }

  /** Los bloques de una fuente, por día. */
  function bloquesDe(
    fila: FilaDeDesglose,
  ): Array<{ fecha: FechaISO; lista: BloqueExtraFila[] }> {
    const salida: Array<{ fecha: FechaISO; lista: BloqueExtraFila[] }> = [];
    for (const [fecha, lista] of [...bloques].sort(([a], [b]) =>
      a < b ? -1 : 1,
    )) {
      const propios = lista.filter((b) =>
        fila.categoria === "taxi"
          ? b.tipo === "taxi" && claveDeAdicional(b) === fila.clave
          : b.tipo !== "taxi" &&
            `apoyo:${(b.tiendaNombre || "otra tienda").trim()}` === fila.clave,
      );
      if (propios.length > 0) salida.push({ fecha, lista: propios });
    }
    return salida;
  }

  function diasDe(fila: FilaDeDesglose): DiaDeFuente[] {
    if (fila.categoria === "tienda") {
      return porDia
        .filter((d) => d.pedidos > 0)
        .map((d) => {
          const ordenes =
            jornadas.find((j) => j.fecha === d.fecha)?.ordenes ?? [];
          const faltan = hayCotejo
            ? ordenes.filter((o) => !o.contado).length
            : 0;
          return { d, faltan };
        })
        .map(({ d, faltan }) => ({
          fecha: d.fecha,
          detalle: `${d.pedidos} pedido${d.pedidos === 1 ? "" : "s"}${d.pagaPor === "permanencia" ? " · cubre la permanencia" : ""}${faltan > 0 ? ` · ${faltan} sin marcar` : ""}`,
          centimos: d.montoCentimos,
        }));
    }
    return bloquesDe(fila).map(({ fecha, lista }) => {
      const horas = lista.reduce(
        (s, b) => s + (b.tipo === "apoyo_hora" ? b.horas : 0),
        0,
      );
      const km = lista.reduce(
        (s, b) => s + (b.tipo === "taxi" ? (b.km ?? 0) : 0),
        0,
      );
      const detalle =
        fila.categoria === "taxi"
          ? `${lista.length} carrera${lista.length === 1 ? "" : "s"}${km > 0 ? ` · ${Math.round(km * 10) / 10} km` : ""}`
          : horas > 0
            ? `${Math.round(horas * 100) / 100} h`
            : `${lista.length} apoyo${lista.length === 1 ? "" : "s"}`;
      return {
        fecha,
        detalle,
        centimos: lista.reduce((s, b) => s + b.montoCentimos, 0),
      };
    });
  }

  if (todasLasFilas.length === 0) return null;

  return (
    <div
      className="entra flex flex-col gap-2.5"
      aria-label={titulo ?? "De dónde viene"}
    >
      {titulo && <span className="rotulo px-1 pb-1">{titulo}</span>}

      {hayQueElegir && (
        <div className="px-1 pb-1">
          <h3 className="text-[17px] leading-tight">Marca lo que quieres sumar</h3>
          <p className="text-xs font-semibold text-tinta-2">Toca cada color para sumarlo o quitarlo.</p>
        </div>
      )}

      {todasLasFilas.map((f, indice) => {
        const grupo = grupoDe(f);
        const visible = !ocultas.includes(grupo);
        const abierta = fuenteAbierta === f.clave;
        const parte = totalSemana > 0 ? f.centimos / totalSemana : 0;
        const dias = abierta ? diasDe(f) : [];
        const color = COLOR_FUENTE[f.categoria];
        const nombre =
          f.categoria === "tienda" ? "Pedidos" : f.etiqueta.replace(/^Apoyo · /, "Apoyo ");
        const cuerpo = (
          <>
            {hayQueElegir && (
              <span className="pag-fu__box" aria-hidden>
                <Check />
              </span>
            )}
            <span className="min-w-0 flex-1">
              <b className="block leading-tight">{hayQueElegir ? nombre : f.etiqueta}</b>
              <small className="block text-[12px] font-bold opacity-90">
                {f.detalle}
                {totalSemana > 0 && ` · ${Math.round(parte * 100)} %`}
              </small>
            </span>
            <span className="pag-fu__monto tabular-nums">{formatearSoles(f.centimos)}</span>
          </>
        );
        return (
          <div
            key={f.clave}
            className="pag-fu"
            data-on={visible}
            style={
              {
                "--fc": color.fondo,
                "--fc-texto": color.texto,
                animationDelay: `${indice * 0.06}s`,
              } as React.CSSProperties
            }
          >
            {hayQueElegir ? (
              <button
                type="button"
                role="checkbox"
                aria-checked={visible}
                aria-label={`Sumar ${f.etiqueta}`}
                onClick={() => alternar(grupo)}
                className="pag-fu__top"
              >
                {cuerpo}
              </button>
            ) : (
              <div className="pag-fu__top">{cuerpo}</div>
            )}
            <div className="pag-fu__barra" aria-hidden>
              <i style={{ width: `${Math.max(parte * 100, f.centimos > 0 ? 3 : 0)}%` }} />
            </div>
            <button
              type="button"
              aria-expanded={abierta}
              onClick={() => {
                setFuenteAbierta(abierta ? null : f.clave);
                setDiaAbierto(null);
              }}
              className="pag-fu__ver"
            >
              {abierta ? "Cerrar" : "Ver días y pedidos"}
              <Flecha
                className={`size-3.5 transition-transform duration-300 ${abierta ? "-rotate-90" : "rotate-90"}`}
              />
            </button>

            <div
              className="grid transition-[grid-template-rows] duration-300 ease-in-out"
              style={{ gridTemplateRows: abierta ? "1fr" : "0fr" }}
            >
              <div className="overflow-hidden" inert={!abierta}>
                <div className="pag-fu__detalle flex flex-col gap-1 px-2 py-2">
                  {f.categoria === "tienda" && todas.length > 0 && (
                    <div
                      className={`flex flex-col gap-1.5 rounded-btn p-2.5 text-xs ${
                        hayCotejo && sinMarcar.length === 0
                          ? "bg-bien-suave text-bien"
                          : "bg-sup text-tinta-2"
                      }`}
                    >
                      {!hayCotejo ? (
                        <span>
                          <b>Cotejar con el reporte de la empresa:</b> abre un
                          día y marca la casilla de cada pedido que aparece en
                          su reporte. Los que queden sin marcar son los que no
                          contó. O sube la imagen del reporte y la app lo coteja
                          sola.
                        </span>
                      ) : (
                        <>
                          <span className="font-semibold">
                            La empresa contó {contados.length} de {todas.length}{" "}
                            pedidos
                            {sinMarcar.length > 0
                              ? ` · faltan ${sinMarcar.length} (${formatearSoles(centimosSinMarcar)})`
                              : " · no falta ninguno"}
                          </span>
                          {sinMarcar.length > 0 && (
                            <ChipDeColor
                              k="cantidad"
                              activo={soloFaltan}
                              onClick={() => setSoloFaltan((v) => !v)}
                            >
                              {soloFaltan ? "Viendo solo los que faltan" : "Ver solo los que faltan"}
                            </ChipDeColor>
                          )}
                        </>
                      )}
                    </div>
                  )}
                  {dias.length === 0 && (
                    <p className="px-2 py-1 text-xs text-tinta-3">
                      Sin días en esta semana.
                    </p>
                  )}
                  {dias.map((d) => {
                    const clave = `${f.clave}|${d.fecha}`;
                    const diaOn = diaAbierto === clave;
                    return (
                      <div
                        key={clave}
                        className="overflow-hidden rounded-btn border border-linea bg-sup"
                      >
                        <button
                          type="button"
                          aria-expanded={diaOn}
                          onClick={() => setDiaAbierto(diaOn ? null : clave)}
                          className="grid min-h-12 w-full grid-cols-[52px_1fr_auto] items-center gap-2 px-3 py-2 text-left"
                        >
                          <b className="text-sm capitalize">
                            {etiquetaDelDia(d.fecha)}
                          </b>
                          <span className="text-xs text-tinta-2">
                            {d.detalle}
                          </span>
                          <span className="flex items-center gap-1.5 font-mono text-[13px] font-bold tabular-nums">
                            {formatearSoles(d.centimos)}
                            <Flecha
                              className={`size-3.5 text-tinta-3 transition-transform duration-300 ${diaOn ? "-rotate-90" : "rotate-90"}`}
                            />
                          </span>
                        </button>
                        <div
                          className="grid transition-[grid-template-rows] duration-300 ease-in-out"
                          style={{ gridTemplateRows: diaOn ? "1fr" : "0fr" }}
                        >
                          <div className="overflow-hidden" inert={!diaOn}>
                            <div className="flex flex-col gap-2 border-t border-linea bg-papel p-2">
                              {f.categoria === "tienda" ? (
                                <PedidosDelDia
                                  regla={regla}
                                  jornada={jornadas.find(
                                    (j) => j.fecha === d.fecha,
                                  )}
                                  alAbrir={setEditandoId}
                                  alContar={(id, v) => void contar(id, v)}
                                  soloFaltan={soloFaltan && hayCotejo}
                                />
                              ) : (
                                bloquesDe(f)
                                  .find((x) => x.fecha === d.fecha)
                                  ?.lista.map((b) => (
                                    <TarjetaBloqueExtra
                                      key={b.id}
                                      bloque={b}
                                      fecha={d.fecha}
                                      editable={editable}
                                      alCambiar={alCambiar}
                                    />
                                  ))
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        );
      })}

      <div className="pag-marcado" aria-live="polite">
        <span className="flex flex-col">
          <small className="text-[12px] font-bold opacity-95">
            {hayQueElegir
              ? ocultas.some((g) => todasLasFilas.some((f) => grupoDe(f) === g))
                ? `Total de lo marcado (de ${formatearSoles(totalSemana)})`
                : "Total de todo"
              : "Total"}
          </small>
          <b className="tabular-nums">{formatearSoles(total)}</b>
        </span>
        <span className="flex flex-wrap justify-end gap-1.5" aria-hidden>
          {filas.map((f) => (
            <i
              key={f.clave}
              className="size-3.5 rounded-[5px] border-2 border-white"
              style={{ background: COLOR_FUENTE[f.categoria].fondo }}
            />
          ))}
        </span>
      </div>
      {ocultas.includes("tienda") && (
        <p className="px-1 text-[12px] font-semibold text-aviso">
          Es solo una vista: lo que la tienda te deposita no cambia.
        </p>
      )}

      {todas.length > 0 && (
        <BotonPag k="comanda" grande ancho className="mt-1" onClick={() => setCotejando(true)}>
          <Hoja className="size-5" />
          Subir el reporte de la empresa
        </BotonPag>
      )}

      {cotejando && (
        <HojaDeCotejo
          alCerrar={() => setCotejando(false)}
          alCambiar={alCambiar}
        />
      )}

      {editando && (
        <HojaDePedido
          key={editando.orden.id}
          fecha={editando.jornada.fecha}
          orden={editando.orden}
          regla={regla}
          rutas={editando.jornada.rutas.map((r) => ({
            numero: r.numero,
            inicio: r.horaInicio,
          }))}
          tienda={tienda}
          ajustes={ajustes}
          editable={editable}
          alCerrar={() => setEditandoId(null)}
          alCambiar={alCambiar}
        />
      )}
    </div>
  );
}

function PedidosDelDia({
  jornada,
  regla,
  alAbrir,
  alContar,
  soloFaltan,
}: {
  regla: ReglaPago;
  jornada: JornadaCompleta | undefined;
  alAbrir: (id: string) => void;
  alContar: (id: string, contado: boolean) => void;
  soloFaltan: boolean;
}) {
  if (!jornada || jornada.ordenes.length === 0)
    return <p className="px-1 text-xs text-tinta-3">Sin pedidos ese día.</p>;
  const ordenes = soloFaltan
    ? jornada.ordenes.filter((o) => !o.contado)
    : jornada.ordenes;
  if (ordenes.length === 0)
    return (
      <p className="px-1 text-xs text-bien">A este día no le falta ninguno.</p>
    );
  return (
    <div className="overflow-hidden rounded-card border border-linea bg-sup">
      {ordenes.map((o) => (
        <FilaPedidoSimple
          key={o.id}
          codigo={o.codigo}
          ruta={o.ruta}
          hora={
            jornada.rutas.find((r) => r.numero === o.ruta)?.horaInicio ?? null
          }
          estado={o.estado}
          tramo={o.tramo}
          monto={formatearSoles(o.montoCentimos ?? 0)}
          manual={o.manual}
          porCompletar={esCodigoPendiente(o.codigo)}
          km={o.km}
          cliente={o.cliente?.nombre ?? null}
          conFoto={o.fotos > 0}
          zona={esPorZona(regla) ? etiquetaTramo(regla, o.tramo) : null}
          contado={o.contado}
          alContar={(v) => alContar(o.id, v)}
          onClick={() => alAbrir(o.id)}
        />
      ))}
    </div>
  );
}
