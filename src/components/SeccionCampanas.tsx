"use client";

import { useState } from "react";

import { Acordeon } from "@/components/Acordeon";
import { DialogoConfirmar } from "@/components/DialogoConfirmar";
import { Check, Estrella } from "@/components/iconos";
import { Aviso } from "@/components/ui";
import { useDatos } from "@/hooks/useDatos";
import {
  borrarCampana,
  diaDeLaSemana,
  guardarCampana,
  listarCampanas,
  marcarBonoFijo,
  progresoDeHorario,
  resumenDeCampana,
  type Campana,
  type ProgresoDeHorario,
} from "@/lib/db/sqlite/campanas";
import { listarTiendas, perfilActual } from "@/lib/db/sqlite/perfil";
import { formatearFecha, hoyEnLima, lunesDeLaSemana, sumarDias, type FechaISO } from "@/lib/fechas";
import { formatearSoles } from "@/lib/pagos/reglas";

/**
 * «Campañas»: cuando la tienda sube la tarifa una semana (CyberNow…) o ofrece un
 * bono por cumplir el horario. Se crea una vez —nombre, fechas, cuánto suma por
 * pedido, y si lo hay, el bono fijo— y la app pone el bono por pedido a todos los
 * pedidos de esas fechas, los ya cargados y los nuevos. Lo que se quita a mano a
 * un pedido no vuelve.
 *
 * El bono fijo se cobra aparte y solo si se cumple el horario: se cuentan los días
 * del período menos los que se descansa (martes y sábado, por ejemplo). Al tocar
 * «Lo cumplí» entra en Pagos como un adicional «Bono de campaña».
 */

const DIAS = [
  [1, "L", "Lunes"],
  [2, "M", "Martes"],
  [3, "X", "Miércoles"],
  [4, "J", "Jueves"],
  [5, "V", "Viernes"],
  [6, "S", "Sábado"],
  [7, "D", "Domingo"],
] as const;
const MONTOS_PEDIDO = [100, 200, 300, 500] as const;
const MONTOS_FIJO = [5000, 10000, 15000] as const;
const CLAVE_DESCANSO = "campanas.dias-descanso";

const aSoles = (c: number) => formatearSoles(c);
const aCentimos = (t: string): number | null => {
  const n = Number(t.replace(",", "."));
  return Number.isFinite(n) && n >= 0 && n <= 1000 ? Math.round(n * 100) : null;
};

/** Los días que se descansa la última vez, para no volver a marcarlos en cada campaña. */
function descansoGuardado(): number[] {
  try {
    const v = JSON.parse(localStorage.getItem(CLAVE_DESCANSO) ?? "[]");
    return Array.isArray(v) ? v.filter((n) => Number.isInteger(n) && n >= 1 && n <= 7) : [];
  } catch {
    return [];
  }
}

interface Borrador {
  id?: string;
  nombre: string;
  tiendaId: string | null;
  desde: string;
  hasta: string;
  pedido: string;
  fijo: string;
  condicion: string;
  descanso: number[];
}

export function SeccionCampanas() {
  const { datos, recargar } = useDatos(async () => {
    const [campanas, tiendas, perfil] = await Promise.all([listarCampanas(), listarTiendas(), perfilActual()]);
    const hoy = hoyEnLima();
    const extra = await Promise.all(
      campanas.map(async (c) => ({
        id: c.id,
        resumen: await resumenDeCampana(c.id),
        horario: c.bonoFijoCentimos > 0 ? await progresoDeHorario(c, hoy) : null,
      })),
    );
    return { campanas, tiendas, tiendaActual: perfil?.tiendaId ?? null, extra: new Map(extra.map((e) => [e.id, e])) };
  }, [], { conservar: true });

  const [editando, setEditando] = useState<Borrador | null>(null);
  const [aviso, setAviso] = useState<{ tono: "bien" | "mal"; texto: string } | null>(null);
  const [preguntando, setPreguntando] = useState<
    { tipo: "borrar"; c: Campana } | { tipo: "cumplido"; c: Campana } | { tipo: "desmarcar"; c: Campana } | null
  >(null);

  const hoy = hoyEnLima();
  const campanas = datos?.campanas ?? [];
  const activas = campanas.filter((c) => c.activa && c.desde <= hoy && hoy <= c.hasta);

  function nueva(preset = false) {
    const lunes = lunesDeLaSemana(hoy);
    setAviso(null);
    setEditando({
      nombre: preset ? "CyberNow" : "",
      tiendaId: datos?.tiendaActual ?? null,
      desde: preset ? "2026-11-02" : lunes,
      hasta: preset ? "2026-11-08" : sumarDias(lunes, 6),
      pedido: preset ? "2" : "2",
      fijo: preset ? "100" : "",
      condicion: preset ? "Cumplir mi horario durante los días del período" : "",
      descanso: preset ? [2, 6] : descansoGuardado(),
    });
  }

  async function guardar() {
    if (!editando) return;
    const pedido = aCentimos(editando.pedido || "0");
    const fijo = aCentimos(editando.fijo || "0");
    if (pedido === null || fijo === null) return setAviso({ tono: "mal", texto: "Revisa los montos de los bonos." });
    try {
      const { resultado } = await guardarCampana(
        {
          nombre: editando.nombre,
          tiendaId: editando.tiendaId,
          desde: editando.desde as FechaISO,
          hasta: editando.hasta as FechaISO,
          bonoPedidoCentimos: pedido,
          bonoFijoCentimos: fijo,
          condicion: editando.condicion,
          diasDescanso: editando.descanso,
        },
        editando.id,
      );
      try {
        localStorage.setItem(CLAVE_DESCANSO, JSON.stringify(editando.descanso));
      } catch {
        /* Es una comodidad: sin almacenamiento, se vuelve a marcar. */
      }
      const partes = [`Campaña guardada.`];
      if (resultado.aplicados > 0) partes.push(`Bono puesto a ${resultado.aplicados} pedido${resultado.aplicados === 1 ? "" : "s"} que ya tenías.`);
      if (resultado.quitados > 0) partes.push(`Quitado de ${resultado.quitados}.`);
      if (resultado.omitidosPagada > 0) partes.push(`${resultado.omitidosPagada} no se tocaron porque su semana ya está pagada.`);
      setAviso({ tono: "bien", texto: partes.join(" ") });
      setEditando(null);
      recargar();
    } catch (fallo) {
      setAviso({ tono: "mal", texto: fallo instanceof Error ? fallo.message : "No se pudo guardar la campaña." });
    }
  }

  async function confirmar() {
    if (!preguntando) return;
    const { tipo, c } = preguntando;
    setPreguntando(null);
    try {
      if (tipo === "borrar") {
        const r = await borrarCampana(c.id);
        setAviso({ tono: "bien", texto: `Campaña «${c.nombre}» borrada.${r.quitados > 0 ? ` Se quitó el bono de ${r.quitados} pedidos.` : ""}` });
      } else {
        await marcarBonoFijo(c.id, tipo === "cumplido");
        setAviso({
          tono: "bien",
          texto: tipo === "cumplido" ? `¡Listo! ${aSoles(c.bonoFijoCentimos)} entran en Pagos, en la semana del ${formatearFecha(c.hasta)}.` : "Bono fijo quitado de Pagos.",
        });
      }
      recargar();
    } catch (fallo) {
      setAviso({ tono: "mal", texto: fallo instanceof Error ? fallo.message : "No se pudo hacer el cambio." });
    }
  }

  return (
    <Acordeon
      titulo="Campañas"
      icono="campana"
      resumen={
        campanas.length === 0
          ? "CyberNow y bonos por semana"
          : activas.length > 0
            ? `En curso: ${activas.map((c) => `${c.nombre} +${aSoles(c.bonoPedidoCentimos)}`).join(" · ")}`
            : `${campanas.length} campaña${campanas.length === 1 ? "" : "s"}`
      }
    >
      <div className="flex flex-col gap-3">
        {aviso && <Aviso tono={aviso.tono} titulo={aviso.texto} />}

        {!editando && campanas.length === 0 && (
          <div className="flex flex-col items-center gap-3 rounded-card bg-sup-2 px-4 py-6 text-center">
            <span className="grid size-16 place-items-center rounded-[20px] text-white" style={{ background: "var(--c-campana)" }}>
              <Estrella className="size-9" />
            </span>
            <p className="text-sm font-semibold">¿La tienda sube la tarifa una semana?</p>
            <p className="text-xs text-tinta-2">
              Crea la campaña una vez, con sus fechas, y el bono se suma solo a todos los pedidos de esos días.
            </p>
          </div>
        )}

        {!editando &&
          campanas.map((c) => {
            const e = datos?.extra.get(c.id);
            const estado = c.desde > hoy ? ["Próxima", "bg-acento-suave text-acento-tinta"] : c.hasta < hoy ? ["Terminada", "bg-sup-2 text-tinta-2"] : ["En curso", "bg-bien-suave text-bien"];
            const h: ProgresoDeHorario | null = e?.horario ?? null;
            const todoCumplido = h !== null && h.faltan.length === 0;
            return (
              <article key={c.id} className="flex flex-col gap-3 rounded-card border border-linea-fuerte bg-sup p-3">
                <div className="flex items-start gap-3">
                  <span className="grid size-12 shrink-0 place-items-center rounded-[14px] text-white" style={{ background: "var(--c-campana)" }}>
                    <Estrella className="size-6" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <b className="block text-[17px] leading-tight">{c.nombre}</b>
                    <small className="block text-tinta-2">
                      Del {formatearFecha(c.desde)} al {formatearFecha(c.hasta)}
                      {c.tiendaId ? ` · ${datos?.tiendas.find((t) => t.id === c.tiendaId)?.nombre ?? "una tienda"}` : " · todas las tiendas"}
                    </small>
                  </div>
                  <span className={`shrink-0 rounded-chip px-2.5 py-1 text-xs font-bold ${estado[1]}`}>{estado[0]}</span>
                </div>

                {c.bonoPedidoCentimos > 0 && (
                  <div className="flex items-center justify-between gap-3 rounded-btn bg-sup-2 px-3 py-2 text-sm">
                    <span>
                      <b>+{aSoles(c.bonoPedidoCentimos)}</b> por pedido
                    </span>
                    <span className="text-tinta-2">
                      {e ? `${e.resumen.pedidos} pedido${e.resumen.pedidos === 1 ? "" : "s"} · ${aSoles(e.resumen.centimos)}` : "…"}
                    </span>
                  </div>
                )}

                {c.bonoFijoCentimos > 0 && h && (
                  <div className="flex flex-col gap-2 rounded-btn bg-sup-2 px-3 py-2 text-sm">
                    <div className="flex items-center justify-between gap-3">
                      <span>
                        Bono fijo <b>{aSoles(c.bonoFijoCentimos)}</b>
                      </span>
                      {c.cumplido && (
                        <span className="inline-flex items-center gap-1 font-bold text-bien">
                          <Check className="size-4" />
                          Cobrado
                        </span>
                      )}
                    </div>
                    {c.condicion && <small className="text-tinta-2">{c.condicion}</small>}
                    <div className="h-2.5 overflow-hidden rounded-full bg-sup">
                      <span
                        className="block h-full rounded-full bg-bien transition-[width] duration-500"
                        style={{ width: `${h.requeridos.length === 0 ? 0 : (h.cumplidos.length / h.requeridos.length) * 100}%` }}
                      />
                    </div>
                    <small className="font-semibold">
                      {h.cumplidos.length} de {h.requeridos.length} días de tu horario
                      {c.diasDescanso.length > 0 && ` · descansas ${c.diasDescanso.map((d) => DIAS[d - 1][2].toLowerCase()).join(" y ")}`}
                    </small>
                    {h.faltan.length > 0 && !c.cumplido && (
                      <small className="text-aviso">
                        Falta cargar: {h.faltan.map((f) => `${DIAS[diaDeLaSemana(f) - 1][2].slice(0, 3)} ${Number(f.slice(8))}`).join(", ")}
                      </small>
                    )}
                    {c.cumplido ? (
                      <button type="button" className="boton-sec" onClick={() => setPreguntando({ tipo: "desmarcar", c })}>
                        Desmarcar (no lo cobré)
                      </button>
                    ) : (
                      <button
                        type="button"
                        className="boton-accion"
                        style={{ "--c": "var(--c-cantidad)" } as React.CSSProperties}
                        disabled={!(h.terminada || todoCumplido)}
                        onClick={() => setPreguntando({ tipo: "cumplido", c })}
                      >
                        <Check className="size-5" />
                        Lo cumplí
                      </button>
                    )}
                    {!c.cumplido && !(h.terminada || todoCumplido) && (
                      <small className="text-tinta-3">Se activa al terminar el período o cuando completes todos los días.</small>
                    )}
                  </div>
                )}

                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    className="boton-sec"
                    onClick={() => {
                      setAviso(null);
                      setEditando({
                        id: c.id,
                        nombre: c.nombre,
                        tiendaId: c.tiendaId,
                        desde: c.desde,
                        hasta: c.hasta,
                        pedido: String(c.bonoPedidoCentimos / 100),
                        fijo: c.bonoFijoCentimos ? String(c.bonoFijoCentimos / 100) : "",
                        condicion: c.condicion ?? "",
                        descanso: c.diasDescanso,
                      });
                    }}
                  >
                    Cambiar
                  </button>
                  <button type="button" className="boton-sec !text-mal" onClick={() => setPreguntando({ tipo: "borrar", c })}>
                    Borrar
                  </button>
                </div>
              </article>
            );
          })}

        {!editando && (
          <>
            <button type="button" className="boton-accion" style={{ "--c": "var(--c-campana)" } as React.CSSProperties} onClick={() => nueva()}>
              <Estrella className="size-5" />
              Nueva campaña
            </button>
            {campanas.length === 0 && (
              <button type="button" className="boton-sec" onClick={() => nueva(true)}>
                Usar la del afiche: CyberNow, 2 al 8 de noviembre
              </button>
            )}
          </>
        )}

        {editando && (
          <Formulario
            b={editando}
            cambiar={(parcial) => setEditando({ ...editando, ...parcial })}
            tiendas={datos?.tiendas.map((t) => ({ id: t.id, nombre: t.nombre })) ?? []}
            alGuardar={() => void guardar()}
            alCancelar={() => setEditando(null)}
            hoy={hoy}
          />
        )}
      </div>

      {preguntando?.tipo === "borrar" && (
        <DialogoConfirmar
          titulo={`¿Borrar la campaña «${preguntando.c.nombre}»?`}
          texto="Se quita el bono que puso a los pedidos y, si ya lo marcaste como cobrado, el bono fijo de Pagos. Lo que pusiste a mano se queda. No se puede deshacer."
          confirmar="Sí, borrar la campaña"
          alCancelar={() => setPreguntando(null)}
          alConfirmar={() => void confirmar()}
        />
      )}
      {preguntando?.tipo === "cumplido" && (
        <DialogoConfirmar
          titulo={`¿Cumpliste el horario de «${preguntando.c.nombre}»?`}
          texto={`Se suman ${aSoles(preguntando.c.bonoFijoCentimos)} a Pagos, en la semana del ${formatearFecha(preguntando.c.hasta)}, como «Bono de campaña». Puedes desmarcarlo después.`}
          confirmar="Sí, lo cumplí"
          alCancelar={() => setPreguntando(null)}
          alConfirmar={() => void confirmar()}
        />
      )}
      {preguntando?.tipo === "desmarcar" && (
        <DialogoConfirmar
          titulo="¿Quitar el bono fijo de Pagos?"
          texto={`Se restan ${aSoles(preguntando.c.bonoFijoCentimos)} de la semana en que se sumaron.`}
          confirmar="Sí, quitarlo"
          alCancelar={() => setPreguntando(null)}
          alConfirmar={() => void confirmar()}
        />
      )}
    </Acordeon>
  );
}

function Formulario({
  b,
  cambiar,
  tiendas,
  alGuardar,
  alCancelar,
  hoy,
}: {
  b: Borrador;
  cambiar: (p: Partial<Borrador>) => void;
  tiendas: Array<{ id: string; nombre: string }>;
  alGuardar: () => void;
  alCancelar: () => void;
  hoy: FechaISO;
}) {
  const lunes = lunesDeLaSemana(hoy);
  const pedidoC = aCentimos(b.pedido || "0");
  const fijoC = aCentimos(b.fijo || "0");
  const chip = (activo: boolean) =>
    `min-h-11 rounded-chip border-2 px-4 text-sm font-bold ${activo ? "border-tinta bg-sup-2" : "border-linea-fuerte"}`;

  return (
    <div className="flex flex-col gap-4 rounded-card border-2 p-3" style={{ borderColor: "var(--c-campana)" }}>
      <b className="text-[17px]">{b.id ? "Cambiar la campaña" : "Nueva campaña"}</b>

      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-semibold">Nombre</span>
        <input
          value={b.nombre}
          onChange={(e) => cambiar({ nombre: e.target.value })}
          placeholder="CyberNow"
          maxLength={40}
          className="min-h-11 rounded-btn border border-linea-fuerte bg-sup px-3 text-base"
        />
      </label>

      {tiendas.length > 0 && (
        <div className="flex flex-col gap-2">
          <span className="text-sm font-semibold">¿En qué tienda?</span>
          <div className="flex flex-wrap gap-2">
            {tiendas.map((t) => (
              <button key={t.id} type="button" aria-pressed={b.tiendaId === t.id} className={chip(b.tiendaId === t.id)} onClick={() => cambiar({ tiendaId: t.id })}>
                {t.nombre}
              </button>
            ))}
            <button type="button" aria-pressed={b.tiendaId === null} className={chip(b.tiendaId === null)} onClick={() => cambiar({ tiendaId: null })}>
              Todas
            </button>
          </div>
        </div>
      )}

      <div className="flex flex-col gap-2">
        <span className="text-sm font-semibold">¿Desde cuándo hasta cuándo?</span>
        <div className="grid grid-cols-2 gap-2">
          <input type="date" value={b.desde} aria-label="Desde" onChange={(e) => e.target.value && cambiar({ desde: e.target.value })} className="min-h-11 rounded-btn border border-linea-fuerte bg-sup px-2 text-base" />
          <input type="date" value={b.hasta} min={b.desde} aria-label="Hasta" onChange={(e) => e.target.value && cambiar({ hasta: e.target.value })} className="min-h-11 rounded-btn border border-linea-fuerte bg-sup px-2 text-base" />
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" className="boton-sec" onClick={() => cambiar({ desde: lunes, hasta: sumarDias(lunes, 6) })}>
            Esta semana
          </button>
          <button type="button" className="boton-sec" onClick={() => cambiar({ desde: sumarDias(lunes, 7), hasta: sumarDias(lunes, 13) })}>
            La próxima semana
          </button>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <span className="text-sm font-semibold">¿Cuánto suma por pedido?</span>
        <div className="flex flex-wrap gap-2">
          {MONTOS_PEDIDO.map((m) => (
            <button key={m} type="button" aria-pressed={pedidoC === m} className={chip(pedidoC === m)} onClick={() => cambiar({ pedido: String(m / 100) })}>
              +{aSoles(m)}
            </button>
          ))}
          <div className="flex min-h-11 items-center gap-1 rounded-chip border-2 border-linea-fuerte px-3">
            <span className="text-sm text-tinta-3">S/</span>
            <input value={b.pedido} inputMode="decimal" aria-label="Bono por pedido" onChange={(e) => cambiar({ pedido: e.target.value })} className="w-14 bg-transparent text-right font-mono text-sm outline-none" />
          </div>
        </div>
        <small className="text-tinta-3">Lo que la tienda sube por cada pedido. Si no hay, pon 0.</small>
      </div>

      <div className="flex flex-col gap-2">
        <span className="text-sm font-semibold">Bono fijo por cumplir el horario (opcional)</span>
        <div className="flex flex-wrap gap-2">
          <button type="button" aria-pressed={fijoC === 0} className={chip(fijoC === 0)} onClick={() => cambiar({ fijo: "" })}>
            Sin bono fijo
          </button>
          {MONTOS_FIJO.map((m) => (
            <button key={m} type="button" aria-pressed={fijoC === m} className={chip(fijoC === m)} onClick={() => cambiar({ fijo: String(m / 100) })}>
              {aSoles(m)}
            </button>
          ))}
          <div className="flex min-h-11 items-center gap-1 rounded-chip border-2 border-linea-fuerte px-3">
            <span className="text-sm text-tinta-3">S/</span>
            <input value={b.fijo} inputMode="decimal" placeholder="otro" aria-label="Bono fijo" onChange={(e) => cambiar({ fijo: e.target.value })} className="w-14 bg-transparent text-right font-mono text-sm outline-none" />
          </div>
        </div>
      </div>

      {fijoC !== null && fijoC > 0 && (
        <>
          <div className="flex flex-col gap-2">
            <span className="text-sm font-semibold">¿Qué días descansas?</span>
            <div className="grid grid-cols-7 gap-1.5" role="group" aria-label="Días de descanso">
              {DIAS.map(([n, letra, nombre]) => {
                const on = b.descanso.includes(n);
                return (
                  <button
                    key={n}
                    type="button"
                    aria-pressed={on}
                    aria-label={nombre}
                    onClick={() => cambiar({ descanso: on ? b.descanso.filter((x) => x !== n) : [...b.descanso, n].sort() })}
                    className={`min-h-12 rounded-[14px] border-2 font-bold ${on ? "border-tinta bg-sup-2" : "border-linea-fuerte"}`}
                  >
                    {letra}
                  </button>
                );
              })}
            </div>
            <small className="text-tinta-3">Esos días no se exigen: el bono se gana cumpliendo todos los demás.</small>
          </div>
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-semibold">Condición (como la dice el afiche)</span>
            <input
              value={b.condicion}
              onChange={(e) => cambiar({ condicion: e.target.value })}
              placeholder="Asistencia perfecta"
              maxLength={120}
              className="min-h-11 rounded-btn border border-linea-fuerte bg-sup px-3 text-base"
            />
          </label>
        </>
      )}

      <div className="grid grid-cols-2 gap-2">
        <button type="button" className="boton-sec" onClick={alCancelar}>
          Cancelar
        </button>
        <button type="button" className="boton-accion" style={{ "--c": "var(--c-campana)" } as React.CSSProperties} onClick={alGuardar}>
          Guardar
        </button>
      </div>
    </div>
  );
}
