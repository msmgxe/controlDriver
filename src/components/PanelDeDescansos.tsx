"use client";

import { useState } from "react";

import { BotonDeAccion } from "@/components/Acciones";
import { DialogoConfirmar } from "@/components/DialogoConfirmar";
import { usePuedeEscribir } from "@/components/Licencia";
import { Alerta, Equis, Luna } from "@/components/iconos";
import { marcarDescanso, quitarDescanso } from "@/lib/db/sqlite/descansos";
import { nombreDelDia, type FechaISO } from "@/lib/fechas";

/**
 * Los días sin cargar de la semana: qué hacer con ellos.
 *
 * Antes la pantalla preguntaba «¿No trabajaste o falta la carga?» y no dejaba
 * contestar. Ahora sí, en los dos sentidos:
 *
 *   · **Faltan por subir** → los días sin jornada y sin marca. Se pueden marcar
 *     con «No trabajé esos días»; los que sí se trabajaron se suben con sus
 *     capturas (el botón del auto).
 *   · **De descanso** → los ya marcados, cada uno con su «quitar», para
 *     corregir un error sin tener que pedir nada.
 *
 * Es un componente que **siempre se pinta**, aunque no haya nada que mostrar:
 * el aviso de «marcaste 2 días» tiene que sobrevivir a que la lista de faltantes
 * se vacíe justo por haberlos marcado.
 */

const corto = (f: FechaISO) => `${nombreDelDia(f).slice(0, 3)} ${Number(f.slice(8, 10))}`;

export function PanelDeDescansos({
  faltan,
  descansos,
  alCambiar,
}: {
  /** Días sin jornada y sin marca, hasta hoy. */
  faltan: FechaISO[];
  /** Días de esta semana ya marcados como descanso. */
  descansos: FechaISO[];
  /** Se llama tras marcar o quitar, para que la pantalla vuelva a consultar. */
  alCambiar: () => void;
}) {
  const puedeEscribir = usePuedeEscribir();
  // Por defecto van todos marcados: lo normal es que no se trabajaran todos.
  // Se guardan los que se **desmarcan**, y no los marcados, para que la
  // selección siga siendo válida cuando cambia la lista sin tocar ningún efecto.
  const [desmarcados, setDesmarcados] = useState<ReadonlySet<FechaISO>>(new Set());
  const [ocupado, setOcupado] = useState(false);
  const [ultimo, setUltimo] = useState<FechaISO[] | null>(null);
  const [fallo, setFallo] = useState<string | null>(null);
  /** El descanso que se está por quitar: pide confirmación con su nombre. */
  const [quitando, setQuitando] = useState<FechaISO | null>(null);

  const elegidos = faltan.filter((f) => !desmarcados.has(f));

  function alternar(fecha: FechaISO) {
    setDesmarcados((previos) => {
      const nuevos = new Set(previos);
      if (nuevos.has(fecha)) nuevos.delete(fecha);
      else nuevos.add(fecha);
      return nuevos;
    });
  }

  async function ejecutar(trabajo: () => Promise<void>) {
    setOcupado(true);
    setFallo(null);
    try {
      await trabajo();
      alCambiar();
    } catch (e) {
      setFallo(e instanceof Error ? e.message : String(e));
    } finally {
      setOcupado(false);
    }
  }

  const marcar = () =>
    ejecutar(async () => {
      const hechas = await marcarDescanso(elegidos);
      setUltimo(hechas.length > 0 ? hechas : null);
      setDesmarcados(new Set());
    });

  const deshacer = () =>
    ejecutar(async () => {
      if (ultimo) await quitarDescanso(ultimo);
      setUltimo(null);
    });

  const quitar = (fecha: FechaISO) => ejecutar(() => quitarDescanso([fecha]));

  const etiquetaBoton =
    elegidos.length === faltan.length
      ? faltan.length === 1
        ? "No trabajé ese día"
        : "No trabajé esos días"
      : `No trabajé ${elegidos.length} de ${faltan.length}`;

  return (
    <div className="flex flex-col gap-3">
      {faltan.length > 0 && (
        <div className="flex flex-col gap-3 rounded-btn bg-aviso-suave px-4 py-3 text-sm text-aviso">
          <div className="flex gap-3">
            <Alerta className="mt-0.5 size-[18px] shrink-0" />
            <div>
              <strong className="block font-bold">
                Falta{faltan.length === 1 ? "" : "n"} {faltan.length} día
                {faltan.length === 1 ? "" : "s"} por subir
              </strong>
              <p>
                ¿Los trabajaste? Sube sus capturas con el botón del auto. ¿No trabajaste? Márcalos
                como descanso.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2" role="group" aria-label="Días sin cargar">
            {faltan.map((f) => {
              const marcado = !desmarcados.has(f);
              return (
                <button
                  key={f}
                  type="button"
                  aria-pressed={marcado}
                  onClick={() => alternar(f)}
                  className={`inline-flex min-h-11 items-center gap-1.5 rounded-chip border-2 px-4 text-sm font-bold capitalize active:scale-95 ${
                    marcado
                      ? "border-aviso bg-aviso text-aviso-suave"
                      : "border-aviso/50 bg-transparent text-aviso"
                  }`}
                >
                  {corto(f)}
                </button>
              );
            })}
          </div>

          <BotonDeAccion k="historial" disabled={!puedeEscribir || ocupado || elegidos.length === 0} onClick={() => void marcar()}>
            <Luna className="size-[18px]" />
            {etiquetaBoton}
          </BotonDeAccion>
        </div>
      )}

      {ultimo && (
        <p
          role="status"
          className="flex items-center justify-between gap-3 rounded-btn bg-acento-suave px-4 py-2.5 text-sm text-acento-tinta"
        >
          <span>
            {ultimo.length === 1
              ? "Marcaste 1 día como descanso."
              : `Marcaste ${ultimo.length} días como descanso.`}
          </span>
          <button
            type="button"
            disabled={ocupado}
            onClick={() => void deshacer()}
            className="boton-sec shrink-0"
          >
            Deshacer
          </button>
        </p>
      )}

      {descansos.length > 0 && (
        <div className="flex flex-col gap-2">
          <span className="rotulo">Días de descanso</span>
          <div className="flex flex-wrap gap-2">
            {descansos.map((f) => (
              <span
                key={f}
                className="inline-flex min-h-11 items-center gap-1.5 rounded-chip bg-sup-2 pr-1 pl-3 text-sm font-semibold capitalize"
              >
                <Luna className="size-3.5 text-tinta-2" />
                {corto(f)}
                <button
                  type="button"
                  disabled={!puedeEscribir || ocupado}
                  onClick={() => setQuitando(f)}
                  aria-label={`Quitar el descanso del ${nombreDelDia(f)} ${Number(f.slice(8, 10))}`}
                  className="grid size-9 place-items-center rounded-full bg-mal-suave text-mal disabled:opacity-50"
                >
                  <Equis className="size-4" />
                </button>
              </span>
            ))}
          </div>
        </div>
      )}

      {quitando && (
        <DialogoConfirmar
          titulo={`¿Quitar el descanso del ${nombreDelDia(quitando)} ${Number(quitando.slice(8, 10))}?`}
          texto="Ese día volverá a contar como un día por subir."
          confirmar="Sí, quitar el descanso"
          ocupado={ocupado}
          alCancelar={() => setQuitando(null)}
          alConfirmar={async () => {
            const f = quitando;
            await quitar(f);
            setQuitando(null);
          }}
        />
      )}

      {fallo && (
        <p role="alert" className="rounded-btn bg-mal-suave px-4 py-2.5 text-sm text-mal">
          No se pudo guardar: {fallo}
        </p>
      )}
    </div>
  );
}
