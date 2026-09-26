"use client";

import { useState } from "react";

import { HojaDeComandas } from "@/components/HojaDeComandas";
import { Calendario, Equis, Subir, Ticket } from "@/components/iconos";
import { Aviso } from "@/components/ui";
import { useCapa } from "@/hooks/useCapa";
import { useDatos } from "@/hooks/useDatos";
import { avisarDeCambios } from "@/lib/cambios";
import { leerAjustesDeComandas } from "@/lib/db/sqlite/ajustes";
import { jornadaPorFecha, reglaVigente } from "@/lib/db/sqlite/jornadas";
import { listarTiendas, perfilActual } from "@/lib/db/sqlite/perfil";
import { formatearFechaLarga, hoyEnLima, nombreDelDia, type FechaISO } from "@/lib/fechas";

/**
 * «Cargar»: qué se va a cargar y a qué día, antes de abrir nada.
 *
 * El botón de la barra de abajo abría el selector de fotos sin más, y no
 * decía dos cosas que importan:
 *
 *   · **qué** se carga: las **capturas de la app de la tienda** (rutas y
 *     pedidos) o las **comandas** (las hojas de despacho, con el cliente);
 *   · **a qué día** van.
 *
 * Sobre el día, la regla es distinta para cada cosa y la hoja la dice:
 *
 *   · las capturas traen su fecha en la cabecera («Resumen del 25/09/2026») y
 *     esa manda; el día de aquí solo vale para las que no la traigan;
 *   · una comanda completa el pedido que ya esté cargado, en su día, y crea
 *     uno nuevo en el día de aquí si no estaba.
 */
export function HojaDeCarga({
  diaInicial,
  deshabilitado,
  alElegirCapturas,
  alCerrar,
}: {
  /** El día que se tiene delante; por defecto, hoy. */
  diaInicial: FechaISO;
  /** Sin licencia no se cargan jornadas nuevas. */
  deshabilitado: boolean;
  alElegirCapturas: (dia: FechaISO) => void;
  alCerrar: () => void;
}) {
  const [dia, setDia] = useState<FechaISO>(diaInicial);
  const [comandas, setComandas] = useState(false);

  if (comandas) return <ComandasDelDia dia={dia} alCerrar={alCerrar} />;

  return (
    <Eleccion
      dia={dia}
      alCambiarDia={setDia}
      deshabilitado={deshabilitado}
      alElegirCapturas={alElegirCapturas}
      alElegirComandas={() => setComandas(true)}
      alCerrar={alCerrar}
    />
  );
}

/** La elección en sí. Va aparte para que solo ella se marque como «capa» (ver `useCapa`) mientras se ve. */
function Eleccion({
  dia,
  alCambiarDia,
  deshabilitado,
  alElegirCapturas,
  alElegirComandas,
  alCerrar,
}: {
  dia: FechaISO;
  alCambiarDia: (dia: FechaISO) => void;
  deshabilitado: boolean;
  alElegirCapturas: (dia: FechaISO) => void;
  alElegirComandas: () => void;
  alCerrar: () => void;
}) {
  const hoy = hoyEnLima();
  useCapa(alCerrar);

  const corto = `${nombreDelDia(dia)} ${Number(dia.slice(8))}`;

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
        aria-label="Cargar"
        className="flex max-h-[92dvh] w-full max-w-md flex-col gap-4 overflow-y-auto rounded-t-hoja bg-sup px-4 pt-3 pb-[calc(1rem+env(safe-area-inset-bottom,0px))] shadow-alta sm:rounded-hoja"
      >
        <span className="mx-auto h-1 w-9 shrink-0 rounded-full bg-linea-fuerte sm:hidden" />

        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="text-xl leading-tight">Cargar</h3>
            <p className="text-sm text-tinta-2">Elige qué vas a cargar y para qué día.</p>
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

        {/* El día. Es lo que la hoja tiene que dejar claro, así que va arriba y
            se puede cambiar sin salir. */}
        <div className="flex flex-col gap-1.5">
          <span className="rotulo">Día</span>
          <label className="relative flex min-h-12 items-center gap-3 rounded-btn border border-linea-fuerte bg-sup px-3">
            <Calendario className="size-5 shrink-0 text-tinta-2" />
            <span className="min-w-0 flex-1 text-[15px] font-semibold first-letter:uppercase">
              {formatearFechaLarga(dia).replace(/ de \d{4}$/, "")}
              {dia === hoy && <span className="ml-2 text-xs font-medium text-acento-tinta">hoy</span>}
            </span>
            <span className="text-sm font-semibold text-acento-tinta">Cambiar</span>
            <input
              type="date"
              value={dia}
              max={hoy}
              aria-label="Elegir el día"
              onChange={(e) => e.target.value && alCambiarDia(e.target.value as FechaISO)}
              onClick={(e) => {
                try {
                  e.currentTarget.showPicker();
                } catch {
                  /* Algunos navegadores solo lo abren con un toque directo en el campo. */
                }
              }}
              className="absolute inset-0 cursor-pointer opacity-0"
            />
          </label>
        </div>

        {deshabilitado && (
          <Aviso tono="atento" titulo="Tu licencia no permite cargar días nuevos">
            <p>Puedes consultar todo lo que ya tienes. Activa la licencia en Ajustes para volver a cargar.</p>
          </Aviso>
        )}

        <div className="flex flex-col gap-2.5">
          <span className="rotulo">Qué vas a cargar</span>

          <Opcion
            Icono={Subir}
            titulo="Capturas de la tienda"
            detalle="Las pantallas de la app de reparto con tus rutas y pedidos: las pestañas Rutas y Órdenes."
            destino={`Cada captura se guarda en el día que dice («Resumen del 25/09»). Las que no lo digan, el ${corto}.`}
            deshabilitado={deshabilitado}
            alElegir={() => alElegirCapturas(dia)}
          />

          <Opcion
            Icono={Ticket}
            titulo="Comandas"
            detalle="Las hojas de despacho, con el nombre, la dirección y el teléfono del cliente."
            destino={`Completa el pedido si ya está cargado, en su día. Si no está, lo crea el ${corto}.`}
            deshabilitado={deshabilitado}
            alElegir={alElegirComandas}
          />
        </div>
      </div>
    </div>
  );
}

function Opcion({
  Icono,
  titulo,
  detalle,
  destino,
  deshabilitado,
  alElegir,
}: {
  Icono: typeof Subir;
  titulo: string;
  detalle: string;
  destino: string;
  deshabilitado: boolean;
  alElegir: () => void;
}) {
  return (
    <button
      type="button"
      onClick={alElegir}
      disabled={deshabilitado}
      className="flex w-full items-start gap-3 rounded-card border-2 border-linea bg-sup p-3.5 text-left enabled:hover:bg-sup-2 enabled:active:bg-sup-2 disabled:opacity-50"
    >
      <span className="grid size-11 shrink-0 place-items-center rounded-btn bg-acento-suave text-acento-tinta">
        <Icono className="size-6" />
      </span>
      <span className="flex min-w-0 flex-col gap-1">
        <b className="text-base font-bold">{titulo}</b>
        <span className="text-sm text-tinta-2">{detalle}</span>
        <span className="text-xs font-semibold text-acento-tinta">{destino}</span>
      </span>
    </button>
  );
}

/**
 * La hoja de comandas de un día, con lo que necesita cargado: la tarifa, las
 * rutas del día, la tienda y los ajustes. Al guardar algo avisa al resto de la
 * app, porque Inicio puede estar debajo mirando el mismo día.
 */
function ComandasDelDia({ dia, alCerrar }: { dia: FechaISO; alCerrar: () => void }) {
  const { datos } = useDatos(async () => {
    const [jornada, perfil, tiendas, ajustes] = await Promise.all([
      jornadaPorFecha(dia),
      perfilActual(),
      listarTiendas(),
      leerAjustesDeComandas(),
    ]);
    const { regla } = await reglaVigente(dia, perfil?.tiendaId ?? null, perfil?.vehiculo);
    return {
      regla,
      rutas: (jornada?.rutas ?? []).map((r) => ({ numero: r.numero, inicio: r.horaInicio })),
      tienda: tiendas.find((t) => t.id === perfil?.tiendaId) ?? null,
      ajustes,
    };
  }, [dia]);

  if (!datos) return null;

  return (
    <HojaDeComandas
      fecha={dia}
      regla={datos.regla}
      rutas={datos.rutas}
      tienda={datos.tienda}
      ajustes={datos.ajustes}
      alCerrar={alCerrar}
      alTerminar={avisarDeCambios}
    />
  );
}
