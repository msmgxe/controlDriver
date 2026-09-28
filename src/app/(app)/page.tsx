"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";

import { Acordeon } from "@/components/Acordeon";
import { CargarCapturas } from "@/components/CargarCapturas";
import { DetalleDelDia } from "@/components/DetalleDelDia";
import { HojaDeComandas } from "@/components/HojaDeComandas";
import { Calendario, Luna, Ticket } from "@/components/iconos";
import { usePuedeEscribir } from "@/components/Licencia";
import { RecorridoGuiado, type PasoDeRecorrido } from "@/components/RecorridoGuiado";
import { SubirMas } from "@/components/SubirMas";
import { TiraDeSemanas } from "@/components/TiraDeSemanas";
import { Auto } from "@/components/Auto";
import { TarjetaDelDia } from "@/components/ui";
import { useDatos } from "@/hooks/useDatos";
import { useTiraDeSemanas } from "@/hooks/useTiraDeSemanas";
import { useVehiculo } from "@/hooks/useVehiculo";
import { publicarDiaElegido } from "@/lib/diaElegido";
import { marcarRecorridoVisto, recorridoYaVisto } from "@/lib/recorrido";
import { leerAjustesDeComandas, type AjustesDeComandas } from "@/lib/db/sqlite/ajustes";
import { descansosPorRango, marcarDescanso, quitarDescanso } from "@/lib/db/sqlite/descansos";
import { jornadaPorFecha, reglaVigente } from "@/lib/db/sqlite/jornadas";
import { estadoDeSemana } from "@/lib/db/sqlite/liquidaciones";
import { listarTiendas, perfilActual } from "@/lib/db/sqlite/perfil";
import { montoDelDia } from "@/lib/pagos/calcular-liquidacion";
import { diasEntre } from "@/lib/licencia/estado";
import {
  esFechaISO,
  formatearDuracion,
  formatearFechaLarga,
  hoyEnLima,
  nombreDelDia,
  rangoDeFechas,
  semanaDe,
  sumarDias,
  type FechaISO,
} from "@/lib/fechas";
import type { EstadoSemana, JornadaCompleta, Tienda } from "@/lib/db/tipos";
import { formatearSoles, type ReglaPago } from "@/lib/pagos/reglas";

/**
 * Inicio (§9): solo lo que se usa cada día.
 *
 * De arriba abajo, en el orden en que se pregunta:
 *
 *   1. **¿Qué día miro?** La barra de semanas: se arrastra y las fechas corren
 *      con el dedo (ver `TiraDeSemanas`). El calendario salta a cualquier fecha.
 *      La fecha se elige aquí y no manda sobre la carga: las capturas traen su
 *      propia fecha, y atarlas al día elegido sería una trampa silenciosa.
 *   2. **¿Cuánto llevo?** La cifra del día, con el auto.
 *   3. **Cargar el día.** Dos botones, no uno: «Cargar resumen del día» —la
 *      captura de la app de la tienda, lo normal— y «Tomar foto de una
 *      comanda» —directo a la cámara, sin pasar por «Subir más»—, cada uno en
 *      el color de la marca que le toca. Menos pasos para lo que más se hace.
 *   4. **El detalle** de lo subido (pedidos y rutas) y **subir más**: los dos
 *      acordeones nacen cerrados, y cada uno dice lo esencial sin abrirse.
 *
 * Lo acumulado de la semana ya no está aquí: vive en Pagos, con su misma barra.
 */
export default function PaginaInicio() {
  return (
    <Suspense fallback={<Esqueleto />}>
      <Contenido />
    </Suspense>
  );
}

function Contenido() {
  // `?dia=` lo usan Historial y Buscar para abrir Inicio en un día concreto.
  const params = useSearchParams();
  const hoy = hoyEnLima();
  const pedido = params.get("dia");
  const [dia, setDia] = useState<FechaISO>(esFechaISO(pedido) && pedido <= hoy ? pedido : hoy);

  // El botón «Cargar» de la barra de abajo propone el día que se tiene delante.
  useEffect(() => {
    publicarDiaElegido(dia);
    return () => publicarDiaElegido(null);
  }, [dia]);

  const semana = semanaDe(dia);
  const esSemanaActual = semana.inicio === semanaDe(hoy).inicio;

  const { datos: tira, recargar: recargarTira } = useTiraDeSemanas(semana.inicio, hoy);

  /* Lo del día elegido. Aquí **no** se conserva lo de otro día: al cambiar de
     día, la parte de abajo se vacía un instante en vez de enseñar los pedidos
     de ayer bajo la fecha de hoy. */
  const { datos: detalle, recargar: recargarDia } = useDatos(
    async () => {
      const [jornada, perfil, estado, tiendas, ajustes, descansos] = await Promise.all([
        jornadaPorFecha(dia),
        perfilActual(),
        estadoDeSemana(dia),
        listarTiendas(),
        leerAjustesDeComandas(),
        descansosPorRango(dia, dia),
      ]);
      const { regla } = await reglaVigente(dia, perfil?.tiendaId ?? null, perfil?.vehiculo);
      return {
        jornada,
        regla,
        estado,
        ajustes,
        tienda: tiendas.find((t) => t.id === perfil?.tiendaId) ?? null,
        descanso: descansos.length > 0,
      };
    },
    [dia],
    { conservar: true },
  );

  function recargar() {
    recargarTira();
    recargarDia();
  }

  if (!tira) return <Esqueleto />;

  const cargadosSemana = rangoDeFechas(semana.inicio, semana.fin).filter((f) => tira.get(f)?.cargado).length;

  return (
    <div className="mx-auto flex max-w-[880px] flex-col gap-4">
      <div className="flex flex-col gap-3">
        <div className="flex items-end justify-between gap-3">
          <div className="min-w-0">
            {/* Sin el año: el calendario de al lado ya lo dice, y con la letra
                condensada y en mayúsculas del modo oscuro la fecha entera
                ocupaba cuatro líneas. */}
            <h2 className="text-[24px] leading-tight first-letter:uppercase">
              {formatearFechaLarga(dia).replace(/ de \d{4}$/, "")}
            </h2>
            <p className="text-xs text-tinta-3">
              Sem. {Number(semana.inicio.slice(8, 10))}–{Number(semana.fin.slice(8, 10))} · {cargadosSemana} de 7 días
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            {!esSemanaActual && (
              <button
                type="button"
                onClick={() => setDia(hoy)}
                className="min-h-11 px-2 text-xs font-bold text-acento-tinta underline underline-offset-2"
              >
                Volver a hoy
              </button>
            )}
            <label className="relative grid size-11 place-items-center rounded-btn border border-linea-fuerte bg-sup">
              <span className="sr-only">Elegir otra fecha</span>
              <Calendario className="size-5" />
              <input
                type="date"
                value={dia}
                max={hoy}
                onChange={(e) => e.target.value && setDia(e.target.value as FechaISO)}
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
        </div>

        <div id="recorrido-tira">
          <TiraDeSemanas
            semana={semana.inicio}
            dia={dia}
            hoy={hoy}
            modo="inicio"
            datos={tira}
            alElegirDia={setDia}
            alMoverSemana={(delta) =>
              setDia((d) => {
                // Mismo día de la semana en la semana nueva, sin pasar de hoy.
                const siguiente = sumarDias(d, delta * 7);
                return siguiente > hoy ? hoy : siguiente;
              })
            }
          />
        </div>
      </div>

      {detalle ? (
        <DelDia dia={dia} hoy={hoy} detalle={detalle} alCambiar={recargar} />
      ) : (
        <div className="flex animate-pulse flex-col gap-4" aria-hidden>
          <div className="h-[150px] rounded-card bg-sup-2" />
          <div className="h-[60px] rounded-card bg-sup-2" />
          <div className="h-[62px] rounded-card bg-sup-2" />
        </div>
      )}

      <RecordatorioDeRespaldo />
    </div>
  );
}

/** Todo lo que necesita la parte de abajo de Inicio para el día elegido. */
interface Detalle {
  jornada: JornadaCompleta | null;
  regla: ReglaPago;
  estado: EstadoSemana;
  ajustes: AjustesDeComandas;
  tienda: Tienda | null;
  descanso: boolean;
}

function DelDia({
  dia,
  hoy,
  detalle,
  alCambiar,
}: {
  dia: FechaISO;
  hoy: FechaISO;
  detalle: Detalle;
  alCambiar: () => void;
}) {
  const vehiculo = useVehiculo();
  const puedeCargar = usePuedeEscribir();
  const [comanda, setComanda] = useState(false);
  /** «Tomar foto de una comanda» abre la hoja directo con la cámara; «Leer una
      comanda» desde «Subir más» la abre en su pantalla de siempre. */
  const [comandaConCamara, setComandaConCamara] = useState(false);
  const [subirMasAbierto, setSubirMasAbierto] = useState(false);
  const { jornada, regla, estado, tienda, ajustes, descanso } = detalle;

  // El recorrido guiado: se dispara solo la primera vez que se abre la app,
  // y también cuando Tutoriales navega a `/?tour=registrar` para repetirlo
  // —eso siempre gana, sin importar si ya se había visto—. El parámetro se
  // limpia al leerlo, para que no se repita solo al volver a esta ruta.
  const params = useSearchParams();
  const router = useRouter();
  const [recorrido, setRecorrido] = useState(false);
  /* eslint-disable react-hooks/set-state-in-effect -- se lee un dato externo (la URL, el almacenamiento) tras montar. */
  useEffect(() => {
    if (params.get("tour") === "registrar") {
      setRecorrido(true);
      router.replace("/", { scroll: false });
    } else if (!recorridoYaVisto()) {
      setRecorrido(true);
      marcarRecorridoVisto();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- se comprueba solo al montar.
  }, []);
  /* eslint-enable react-hooks/set-state-in-effect */

  const pasosRecorrido: PasoDeRecorrido[] = [
    {
      selector: "#recorrido-tira",
      titulo: "Elige el día",
      texto: "La tira de arriba manda: toca el que quieres cargar. Por defecto es hoy.",
    },
    {
      selector: "#recorrido-cargar-resumen",
      titulo: "Cargar resumen del día",
      texto: "La forma normal: sube las capturas de la app de la tienda, con tus rutas y pedidos, al terminar la jornada.",
    },
    {
      selector: "#recorrido-tomar-foto",
      titulo: "Tomar foto de una comanda",
      texto: "El camino más corto: abre la cámara de una vez y registra un pedido apenas lo entregas, sin esperar al final del día.",
    },
    {
      selector: "#recorrido-subir-mas",
      titulo: "¿Falta algo más?",
      texto: "Aquí están las otras formas: anotar cuántos pedidos fueron, añadir uno a mano, o leer varias comandas de la galería de una vez.",
      antes: () => setSubirMasAbierto(true),
    },
  ];

  // Lo que bloquea es haber cobrado, no haber cerrado la semana: cerrar en
  // Pagos congela el monto para poder anotar el pago, pero no debe impedir
  // corregir un pedido que faltó mientras eso no haya pasado.
  const editable = estado !== "pagada";
  const esFuturo = dia > hoy;

  const pedidosCentimos = jornada?.ordenes.reduce((s, o) => s + (o.montoCentimos ?? 0), 0) ?? 0;
  const cobrado = jornada ? montoDelDia(pedidosCentimos, regla, jornada.horaEntrada, jornada.horaSalida).pagadoCentimos : 0;
  const minutos = jornada?.rutas.reduce((s, r) => s + (r.duracionMin ?? 0), 0) ?? 0;
  const conCliente = jornada?.ordenes.filter((o) => o.cliente !== null).length ?? 0;

  return (
    <>
      {jornada ? (
        <TarjetaDelDia
          encabezado={dia === hoy ? "Hoy cargaste" : `El ${nombreDelDia(dia)} cargaste`}
          cifra={String(jornada.ordenes.length)}
          pie={`pedidos · ${jornada.rutas.length} ruta${jornada.rutas.length === 1 ? "" : "s"}`}
          monto={formatearSoles(cobrado)}
          vehiculo={vehiculo}
        />
      ) : (
        <DiaSinCarga fecha={dia} hoy={hoy} descanso={descanso} puedeEscribir={puedeCargar} alCambiar={alCambiar} />
      )}

      <div className="flex flex-col gap-2">
        <div id="recorrido-cargar-resumen">
          <CargarCapturas deshabilitado={!puedeCargar} dia={dia} />
        </div>
        <button
          id="recorrido-tomar-foto"
          type="button"
          className="boton-segundo"
          disabled={!puedeCargar}
          onClick={() => {
            setComandaConCamara(true);
            setComanda(true);
          }}
        >
          <Ticket className="size-[22px]" />
          Tomar foto de una comanda
        </button>
        <p className="text-xs text-tinta-3">
          Una foto por pedido, con cliente y dirección: directo a la cámara, sin pasar por «Subir más».
        </p>
      </div>

      {jornada && (
        <Acordeon
          titulo="Detalle de lo subido"
          resumen={`${jornada.ordenes.length} pedidos · ${jornada.rutas.length} rutas${
            minutos > 0 ? ` · ${formatearDuracion(minutos)} en ruta` : ""
          }${conCliente > 0 ? ` · ${conCliente} con cliente` : ""}`}
        >
          <DetalleDelDia
            fecha={dia}
            jornada={jornada}
            regla={regla}
            tienda={tienda}
            ajustes={ajustes}
            editable={editable}
            alCambiar={alCambiar}
          />
        </Acordeon>
      )}

      {!esFuturo && (
        <div id="recorrido-subir-mas">
          <Acordeon
            titulo="Subir más"
            resumen="A mano, por cantidad, foto o comanda"
            destacado
            abierto={subirMasAbierto}
            alCambiar={setSubirMasAbierto}
          >
            <SubirMas
              fecha={dia}
              jornada={jornada}
              regla={regla}
              editable={editable}
              alCambiar={alCambiar}
              alLeerComanda={() => setComanda(true)}
            />
          </Acordeon>
        </div>
      )}

      {recorrido && <RecorridoGuiado pasos={pasosRecorrido} alTerminar={() => setRecorrido(false)} />}

      {comanda && (
        <HojaDeComandas
          fecha={dia}
          regla={regla}
          rutas={(jornada?.rutas ?? []).map((r) => ({ numero: r.numero, inicio: r.horaInicio }))}
          tienda={tienda}
          ajustes={ajustes}
          iniciarConCamara={comandaConCamara}
          alCerrar={() => {
            setComanda(false);
            setComandaConCamara(false);
          }}
          alTerminar={alCambiar}
        />
      )}
    </>
  );
}

/**
 * Un día que no está cargado: se puede subir, o decir que no se trabajó.
 *
 * Es lo que en Pagos se contesta con «No trabajé esos días», pero para un solo
 * día y desde donde se está mirando: si el jueves fue libre, se dice aquí mismo.
 * Subir el día se hace con los dos botones de arriba, o con «Subir más», debajo.
 */
function DiaSinCarga({
  fecha,
  hoy,
  descanso,
  puedeEscribir,
  alCambiar,
}: {
  fecha: FechaISO;
  hoy: FechaISO;
  descanso: boolean;
  puedeEscribir: boolean;
  alCambiar: () => void;
}) {
  const vehiculo = useVehiculo();
  const [ocupado, setOcupado] = useState(false);
  const esFuturo = fecha > hoy;

  async function cambiar() {
    setOcupado(true);
    try {
      if (descanso) await quitarDescanso([fecha]);
      else await marcarDescanso([fecha]);
      alCambiar();
    } finally {
      setOcupado(false);
    }
  }

  if (descanso) {
    return (
      <section className="tarjeta flex items-center gap-3" aria-label="Día de descanso">
        <span className="grid size-11 shrink-0 place-items-center rounded-full bg-descanso text-descanso-tinta">
          <Luna className="size-6" />
        </span>
        <div className="flex min-w-0 flex-1 flex-col">
          <b className="text-base font-bold">Día de descanso</b>
          <span className="text-sm text-tinta-2">Dijiste que no trabajaste este día.</span>
        </div>
        <button type="button" className="boton-sec shrink-0" disabled={!puedeEscribir || ocupado} onClick={() => void cambiar()}>
          Quitar
        </button>
      </section>
    );
  }

  return (
    <section className="tarjeta grid grid-cols-[auto_1fr] items-center gap-x-4 gap-y-2" aria-label="Sin cargar">
      <Auto vehiculo={vehiculo} mono className="w-[74px] text-tinta-3 [--auto-fondo:var(--sup)]" />
      <div>
        <b className="text-base font-bold">
          {fecha === hoy ? "Hoy" : esFuturo ? "Ese día todavía no llega" : "Ese día"}
          {esFuturo ? "" : ": sin cargar"}
        </b>
        <p className="text-sm text-tinta-2">
          {fecha === hoy
            ? "Todavía no has subido las capturas de hoy."
            : esFuturo
              ? "Cuando llegue, sube aquí sus capturas."
              : "Súbelo cuando quieras: manda la fecha de la captura, no la de hoy."}
        </p>
      </div>
      {!esFuturo && (
        <button
          type="button"
          className="boton-sec col-span-2"
          disabled={!puedeEscribir || ocupado}
          onClick={() => void cambiar()}
        >
          <Luna className="size-[18px]" />
          No trabajé este día
        </button>
      )}
    </section>
  );
}

/**
 * Recuerda hacer un respaldo si nunca se hizo uno, o si el último ya tiene
 * más de dos semanas.
 *
 * La base vive solo en este teléfono, y hasta que exista la copia en la nube
 * un respaldo manual es la única red de seguridad real. Se avisa aquí, en
 * Inicio, y no solo en Ajustes: nadie va a Ajustes a buscar algo que no sabe
 * que necesita. Es una franja fina y solo sale cuando toca.
 */
function RecordatorioDeRespaldo() {
  const { datos: ultimo } = useDatos(async () => {
    const { ultimoRespaldoCreado } = await import("@/lib/db/sqlite/respaldo");
    return ultimoRespaldoCreado();
  }, []);

  if (ultimo === undefined) return null; // todavía cargando

  const mensaje =
    ultimo === null
      ? "Todavía no has hecho ningún respaldo de tus datos."
      : diasEntre(ultimo.slice(0, 10), hoyEnLima()) >= 14
        ? `Tu último respaldo fue hace ${diasEntre(ultimo.slice(0, 10), hoyEnLima())} días.`
        : null;

  if (!mensaje) return null;

  return (
    <Link
      href="/ajustes"
      className="mx-auto flex w-full max-w-[880px] items-center justify-between gap-3 rounded-btn bg-sup-2 px-4 py-2.5 text-sm text-tinta-2"
    >
      <span>{mensaje}</span>
      <b className="shrink-0 text-tinta">Respaldar</b>
    </Link>
  );
}

function Esqueleto() {
  return (
    <div className="mx-auto flex max-w-[880px] animate-pulse flex-col gap-4" aria-hidden>
      <div className="h-8 w-56 rounded bg-sup-2" />
      <div className="h-[66px] rounded-btn bg-sup-2" />
      <div className="h-[150px] rounded-card bg-sup-2" />
      <div className="h-[60px] rounded-card bg-sup-2" />
      <div className="h-[62px] rounded-card bg-sup-2" />
    </div>
  );
}
