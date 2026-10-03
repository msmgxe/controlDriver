"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";

import { BloquesDelDia } from "@/components/BloquesDelDia";
import { CargarCapturas } from "@/components/CargarCapturas";
import { BarraDeFuentes } from "@/components/BarraDeFuentes";
import { FilaDeLista } from "@/components/ListaDelDia";
import { HojaSubirMas } from "@/components/HojaSubirMas";
import { DetalleDelDia } from "@/components/DetalleDelDia";
import { HojaDeBloqueExtra } from "@/components/HojaDeBloqueExtra";
import { HojaDeComandas } from "@/components/HojaDeComandas";
import { Calendario, Luna, Reloj, Taxi, Ticket, Tienda as IconoTienda } from "@/components/iconos";
import { usePuedeEscribir } from "@/components/Licencia";
import { MenuAgregarBloque } from "@/components/MenuAgregarBloque";
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
import { listarBloquesDelDia } from "@/lib/db/sqlite/bloques-extra";
import { descansosPorRango, marcarDescanso, quitarDescanso } from "@/lib/db/sqlite/descansos";
import { jornadaPorFecha, reglaVigente } from "@/lib/db/sqlite/jornadas";
import { estadoDeSemana } from "@/lib/db/sqlite/liquidaciones";
import { listarTiendas, perfilActual } from "@/lib/db/sqlite/perfil";
import { montoDelDia } from "@/lib/pagos/calcular-liquidacion";
import { desglosePorFuente } from "@/lib/pagos/desglose";
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
import type { BloqueExtraFila, EstadoSemana, JornadaCompleta, Tienda } from "@/lib/db/tipos";
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
      const [jornada, perfil, estado, tiendas, ajustes, descansos, bloques] = await Promise.all([
        jornadaPorFecha(dia),
        perfilActual(),
        estadoDeSemana(dia),
        listarTiendas(),
        leerAjustesDeComandas(),
        descansosPorRango(dia, dia),
        listarBloquesDelDia(dia),
      ]);
      const { regla } = await reglaVigente(dia, perfil?.tiendaId ?? null, perfil?.vehiculo);
      return {
        jornada,
        regla,
        estado,
        ajustes,
        tienda: tiendas.find((t) => t.id === perfil?.tiendaId) ?? null,
        // Todas las tiendas, no solo la activa: hace falta el picker completo
        // para elegir a cuál se apoyó (§ plan de apoyo/taxi).
        tiendas,
        descanso: descansos.length > 0,
        bloques,
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
  tiendas: Tienda[];
  descanso: boolean;
  bloques: BloqueExtraFila[];
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
  const [bloqueAbierto, setBloqueAbierto] = useState<"apoyo" | "taxi" | null>(null);
  const { jornada, regla, estado, tienda, tiendas, ajustes, descanso, bloques } = detalle;
  /** Qué fila de «¿Qué hiciste hoy?» está desplegada. */
  const [filaAbierta, setFilaAbierta] = useState<"tienda" | "apoyo" | "taxi" | null>(null);
  function abrirFila(cual: "tienda" | "apoyo" | "taxi") {
    setFilaAbierta((a) => (a === cual ? null : cual));
  }

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
      selector: "#recorrido-lista",
      titulo: "¿Qué hiciste hoy?",
      texto: "Tus pedidos, un apoyo a otra tienda o una carrera de taxi. Toca lo que ya hiciste para ver el detalle, o lo que falta para anotarlo.",
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
  /* Con apoyo o taxi, la pastilla del día es el total de todo —lo que de verdad
     produjo—, y debajo se reparte por fuente. Sin ellos, queda como siempre. */
  const extrasCentimos = bloques.reduce((s, b) => s + b.montoCentimos, 0);
  const apoyos = bloques.filter((b) => b.tipo !== "taxi");
  const taxis = bloques.filter((b) => b.tipo === "taxi");
  const hayPedidos = (jornada?.ordenes.length ?? 0) > 0 || (jornada?.rutas.length ?? 0) > 0;
  const desglose = desglosePorFuente({
    tiendaNombre: tienda?.nombre ?? null,
    pedidosTienda: jornada?.ordenes.length ?? 0,
    centimosTienda: cobrado,
    bloques,
  });

  return (
    <>
      {jornada ? (
        <TarjetaDelDia
          encabezado={dia === hoy ? "Hoy cargaste" : `El ${nombreDelDia(dia)} cargaste`}
          cifra={String(jornada.ordenes.length)}
          pie={`pedidos · ${jornada.rutas.length} ruta${jornada.rutas.length === 1 ? "" : "s"}`}
          monto={formatearSoles(cobrado + extrasCentimos)}
          vehiculo={vehiculo}
        />
      ) : (
        <DiaSinCarga fecha={dia} hoy={hoy} descanso={descanso} puedeEscribir={puedeCargar} alCambiar={alCambiar} />
      )}

      <BarraDeFuentes filas={desglose} alElegir={(c) => abrirFila(c === "tienda" ? "tienda" : c)} />

      {/* ¿Qué hiciste hoy? Tres preguntas con su respuesta: lo hecho se
          despliega al tocarlo; lo que falta empieza a anotarse al tocarlo. */}
      <div id="recorrido-lista" className="flex flex-col gap-2.5">
        <h3 className="entra px-1 text-[17px]" style={{ "--i": 1 } as React.CSSProperties}>
          {dia === hoy ? "¿Qué hiciste hoy?" : `¿Qué hiciste el ${nombreDelDia(dia)}?`}
        </h3>

        <FilaDeLista
          indice={0}
          Icono={IconoTienda}
          fondo="bg-acento-suave text-acento-tinta"
          titulo="Pedidos de mi tienda"
          resumen={
            hayPedidos
              ? `${jornada!.ordenes.length} pedido${jornada!.ordenes.length === 1 ? "" : "s"} · ${jornada!.rutas.length} ruta${
                  jornada!.rutas.length === 1 ? "" : "s"
                }${minutos > 0 ? ` · ${formatearDuracion(minutos)} en ruta` : ""}${conCliente > 0 ? ` · ${conCliente} con cliente` : ""}`
              : "Toca para anotarlos"
          }
          monto={hayPedidos ? formatearSoles(cobrado) : undefined}
          hecha={hayPedidos}
          abierta={filaAbierta === "tienda"}
          alPulsar={() => (hayPedidos ? abrirFila("tienda") : setSubirMasAbierto(true))}
        >
          {jornada && (
            <DetalleDelDia
              fecha={dia}
              jornada={jornada}
              regla={regla}
              tienda={tienda}
              ajustes={ajustes}
              editable={editable}
              alCambiar={alCambiar}
            />
          )}
          {!esFuturo && (
            <button type="button" className="boton-fila" onClick={() => setSubirMasAbierto(true)}>
              Agregar más pedidos o rutas
            </button>
          )}
        </FilaDeLista>

        <FilaDeLista
          indice={1}
          Icono={Reloj}
          fondo="bg-[#fff4d6] text-[#8a6200]"
          titulo="Apoyé a otra tienda"
          resumen={
            apoyos.length > 0
              ? desglose
                  .filter((f) => f.categoria === "apoyo")
                  .map((f) => `${f.etiqueta.replace("Apoyo · ", "")} · ${f.detalle}`)
                  .join(" · ")
              : "Toca si cubriste otra tienda"
          }
          monto={apoyos.length > 0 ? formatearSoles(apoyos.reduce((s, b) => s + b.montoCentimos, 0)) : undefined}
          hecha={apoyos.length > 0}
          abierta={filaAbierta === "apoyo"}
          alPulsar={() => (apoyos.length > 0 ? abrirFila("apoyo") : setBloqueAbierto("apoyo"))}
        >
          <BloquesDelDia fecha={dia} bloques={apoyos} editable={editable && puedeCargar} alCambiar={alCambiar} />
          {!esFuturo && (
            <button type="button" className="boton-fila" onClick={() => setBloqueAbierto("apoyo")}>
              Agregar otro apoyo
            </button>
          )}
        </FilaDeLista>

        <FilaDeLista
          indice={2}
          Icono={Taxi}
          fondo="bg-[#ece7ff] text-[#5b2bd6]"
          titulo="Hice taxi"
          resumen={
            taxis.length > 0
              ? desglose.find((f) => f.categoria === "taxi")?.detalle ?? ""
              : "Toca para anotar una carrera"
          }
          monto={taxis.length > 0 ? formatearSoles(taxis.reduce((s, b) => s + b.montoCentimos, 0)) : undefined}
          hecha={taxis.length > 0}
          abierta={filaAbierta === "taxi"}
          alPulsar={() => (taxis.length > 0 ? abrirFila("taxi") : setBloqueAbierto("taxi"))}
        >
          <BloquesDelDia fecha={dia} bloques={taxis} editable={editable && puedeCargar} alCambiar={alCambiar} />
          {!esFuturo && (
            <button type="button" className="boton-fila" onClick={() => setBloqueAbierto("taxi")}>
              Agregar otra carrera
            </button>
          )}
        </FilaDeLista>
      </div>

      <div className="entra flex flex-col gap-2" style={{ "--i": 6 } as React.CSSProperties}>
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
        <p className="text-xs text-tinta-3">Una foto por pedido, con cliente y dirección: directo a la cámara.</p>
      </div>

      {subirMasAbierto && !esFuturo && (
        <HojaSubirMas titulo="Pedidos de mi tienda" alCerrar={() => setSubirMasAbierto(false)}>
          <SubirMas
            fecha={dia}
            jornada={jornada}
            regla={regla}
            editable={editable}
            alCambiar={alCambiar}
            alLeerComanda={() => {
              setSubirMasAbierto(false);
              setComanda(true);
            }}
            alAgregarBloque={(t) => {
              setSubirMasAbierto(false);
              setBloqueAbierto(t);
            }}
          />
        </HojaSubirMas>
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

      {!esFuturo && (
        <MenuAgregarBloque
          disabled={!puedeCargar}
          onElegirTienda={() => setSubirMasAbierto(true)}
          onElegirApoyo={() => setBloqueAbierto("apoyo")}
          onElegirTaxi={() => setBloqueAbierto("taxi")}
        />
      )}

      {bloqueAbierto && (
        <HojaDeBloqueExtra
          tipo={bloqueAbierto}
          fecha={dia}
          tiendas={tiendas.filter((t) => t.id !== tienda?.id)}
          factorCalles={tienda?.factorCalles ?? 1.3}
          alCerrar={() => setBloqueAbierto(null)}
          alGuardar={() => {
            setBloqueAbierto(null);
            alCambiar();
          }}
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
 * que necesita. Es una franja fina y solo sale cuando toca, y el botón hace el
 * respaldo **ahí mismo**: abre el selector de Android para mandarlo a Drive,
 * a WhatsApp o al correo, sin pasar por Ajustes.
 */
function RecordatorioDeRespaldo() {
  const { datos: ultimo, recargar } = useDatos(async () => {
    const { ultimoRespaldoCreado } = await import("@/lib/db/sqlite/respaldo");
    return ultimoRespaldoCreado();
  }, []);
  const [haciendo, setHaciendo] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (ultimo === undefined) return null; // todavía cargando

  const mensaje =
    ultimo === null
      ? "Todavía no has hecho ningún respaldo de tus datos."
      : diasEntre(ultimo.slice(0, 10), hoyEnLima()) >= 14
        ? `Tu último respaldo fue hace ${diasEntre(ultimo.slice(0, 10), hoyEnLima())} días.`
        : null;

  if (!mensaje) return null;

  async function respaldar() {
    setHaciendo(true);
    setError(null);
    try {
      const { crearYCompartirRespaldo } = await import("@/lib/db/sqlite/compartir-respaldo");
      await crearYCompartirRespaldo();
      recargar();
    } catch (fallo) {
      // Cerrar el selector sin elegir nada no es un fallo que valga la pena gritar.
      const texto = fallo instanceof Error ? fallo.message : "";
      if (!/cancel/i.test(texto)) setError(texto || "No se pudo crear el respaldo.");
    } finally {
      setHaciendo(false);
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-[880px] flex-col gap-1.5 rounded-btn bg-sup-2 px-4 py-2.5 text-sm text-tinta-2">
      <div className="flex items-center justify-between gap-3">
        <span>{mensaje}</span>
        <button
          type="button"
          disabled={haciendo}
          onClick={() => void respaldar()}
          className="min-h-11 shrink-0 px-1 font-bold text-acento-tinta underline underline-offset-2 disabled:opacity-60"
        >
          {haciendo ? "Abriendo…" : "Respaldar ahora"}
        </button>
      </div>
      <span className="text-xs text-tinta-3">
        Es un archivo con tus datos: guárdalo en Drive o mándatelo por WhatsApp. Si cambias de teléfono, lo restauras en{" "}
        <Link href="/ajustes" className="underline underline-offset-2">Ajustes</Link>.
      </span>
      {error && <span className="text-xs text-mal">{error}</span>}
    </div>
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
