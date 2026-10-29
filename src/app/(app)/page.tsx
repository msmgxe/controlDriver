"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";

import { BotonDeAccion } from "@/components/Acciones";
import { BloquesDelDia } from "@/components/BloquesDelDia";
import { CargarCapturas } from "@/components/CargarCapturas";
import { FilaDeLista } from "@/components/ListaDelDia";
import { HojaDeDia } from "@/components/HojaDeDia";
import { HojaSubirMas } from "@/components/HojaSubirMas";
import { DetalleDelDia } from "@/components/DetalleDelDia";
import { HojaDeBloqueExtra } from "@/components/HojaDeBloqueExtra";
import { HojaDeComandas } from "@/components/HojaDeComandas";
import { DialogoConfirmar } from "@/components/DialogoConfirmar";
import {
  Calendario,
  Equis,
  Historial,
  Luna,
  Mas,
  Suma,
  Ticket,
} from "@/components/iconos";
import { usePuedeEscribir } from "@/components/Licencia";
import {
  RecorridoGuiado,
  type PasoDeRecorrido,
} from "@/components/RecorridoGuiado";
import { SubirMas } from "@/components/SubirMas";
import { TiraDeSemanas, type DatosDelDia } from "@/components/TiraDeSemanas";
import { IlustracionDelDia } from "@/components/IlustracionesDeInicio";
import { TourDePantalla } from "@/components/TourDePantalla";
import { TarjetaViva } from "@/components/TarjetaViva";
import { useDatos } from "@/hooks/useDatos";
import { useTiraDeSemanas } from "@/hooks/useTiraDeSemanas";
import { useVehiculo } from "@/hooks/useVehiculo";
import { avisarDeCambios } from "@/lib/cambios";
import { publicarDiaElegido } from "@/lib/diaElegido";
import { sonar } from "@/lib/sonidos";
import { marcarRecorridoVisto, recorridoYaVisto } from "@/lib/recorrido";
import {
  leerAjustesDeComandas,
  type AjustesDeComandas,
} from "@/lib/db/sqlite/ajustes";
import { listarBloquesDelDia } from "@/lib/db/sqlite/bloques-extra";
import {
  descansosPorRango,
  marcarDescanso,
  quitarDescanso,
} from "@/lib/db/sqlite/descansos";
import { jornadaPorFecha, reglaVigente } from "@/lib/db/sqlite/jornadas";
import { estadoDeSemana } from "@/lib/db/sqlite/liquidaciones";
import { listarTiendas, perfilActual } from "@/lib/db/sqlite/perfil";
import { montoDelDia } from "@/lib/pagos/calcular-liquidacion";
import { claveDeAdicional, desglosePorFuente } from "@/lib/pagos/desglose";
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
import type {
  BloqueExtraFila,
  EstadoSemana,
  JornadaCompleta,
  Tienda,
} from "@/lib/db/tipos";
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
  const [dia, setDia] = useState<FechaISO>(
    esFechaISO(pedido) && pedido <= hoy ? pedido : hoy,
  );

  // El botón «Cargar» de la barra de abajo propone el día que se tiene delante.
  useEffect(() => {
    publicarDiaElegido(dia);
    return () => publicarDiaElegido(null);
  }, [dia]);

  const deslizar = useRef<{ x: number; y: number } | null>(null);
  /** El día cuyas opciones se abrieron manteniéndolo presionado. */
  const [menuDia, setMenuDia] = useState<FechaISO | null>(null);
  const semana = semanaDe(dia);

  const { datos: tira, recargar: recargarTira } = useTiraDeSemanas(
    semana.inicio,
    hoy,
  );

  /* Lo del día elegido. Aquí **no** se conserva lo de otro día: al cambiar de
     día, la parte de abajo se vacía un instante en vez de enseñar los pedidos
     de ayer bajo la fecha de hoy. */
  const { datos: detalle, recargar: recargarDia } = useDatos(
    async () => {
      const [jornada, perfil, estado, tiendas, ajustes, descansos, bloques] =
        await Promise.all([
          jornadaPorFecha(dia),
          perfilActual(),
          estadoDeSemana(dia),
          listarTiendas(),
          leerAjustesDeComandas(),
          descansosPorRango(dia, dia),
          listarBloquesDelDia(dia),
        ]);
      const { regla } = await reglaVigente(
        dia,
        perfil?.tiendaId ?? null,
        perfil?.vehiculo,
      );
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

  const cargadosSemana = rangoDeFechas(semana.inicio, semana.fin).filter(
    (f) => tira.get(f)?.cargado,
  ).length;

  return (
    <div className="mx-auto flex max-w-[880px] flex-col gap-4">
      <TourDePantalla pantalla="inicio" />
      <div className="flex flex-col gap-3">
        <div className="ini-cab ini-rise">
          <div className="min-w-0 flex-1">
            {/* Sin el año: el calendario de al lado ya lo dice, y con la letra
                condensada y en mayúsculas del modo oscuro la fecha entera
                ocupaba cuatro líneas. */}
            <h2 className="ini-fecha first-letter:uppercase">
              {formatearFechaLarga(dia).replace(/ de \d{4}$/, "")}
            </h2>
            <p className="text-sm text-tinta-2">
              Sem. {Number(semana.inicio.slice(8, 10))}–
              {Number(semana.fin.slice(8, 10))} · {cargadosSemana} de 7 días
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {dia !== hoy && (
              <button type="button" onClick={() => setDia(hoy)} className="ini-volver">
                <Historial className="size-[18px]" />
                Volver a hoy
              </button>
            )}
            <label id="recorrido-calendario" className="ini-icb relative">
              <span className="sr-only">Elegir otra fecha</span>
              <Calendario className="size-5" />
              <input
                type="date"
                value={dia}
                max={hoy}
                onChange={(e) =>
                  e.target.value && setDia(e.target.value as FechaISO)
                }
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

        <div id="recorrido-tira" className="ini-rise" style={{ animationDelay: "70ms" }}>
          <TiraDeSemanas
            semana={semana.inicio}
            dia={dia}
            hoy={hoy}
            modo="inicio"
            datos={tira}
            alElegirDia={setDia}
            alMantener={(f) => setMenuDia(f)}
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

      <div id="recorrido-pista" className="ini-sub ini-rise -mt-2" style={{ animationDelay: "140ms" }}>
        <small>
          {dia === hoy ? "Hoy" : `${nombreDelDia(dia).slice(0, 3)} ${Number(dia.slice(8, 10))}`} · toca un día para verlo
        </small>
        {dia <= hoy && (
          <button
            type="button"
            className="ini-icb"
            onClick={() => setMenuDia(dia)}
            aria-label="Opciones de este día"
          >
            <Mas className="size-5" />
          </button>
        )}
      </div>

      {menuDia && (
        <HojaDeDia
          fecha={menuDia}
          cargado={tira.get(menuDia)?.cargado ?? false}
          descanso={tira.get(menuDia)?.descanso ?? false}
          alElegir={() => setDia(menuDia)}
          alCambiar={() => {
            recargar();
            avisarDeCambios();
          }}
          alCerrar={() => setMenuDia(null)}
        />
      )}

      {detalle ? (
        <div
          className="flex flex-col gap-4"
          onTouchStart={(e) => {
            // Un gesto dentro de una hoja o de un visor de fotos (que viven en un portal pero
            // propagan sus eventos hasta aquí) es del visor, no un cambio de día.
            const destino = e.target as Element;
            if (
              e.touches.length > 1 ||
              destino.closest?.('[role="dialog"], [role="alertdialog"], [data-sin-deslizar]')
            ) {
              deslizar.current = null;
              return;
            }
            deslizar.current = {
              x: e.touches[0].clientX,
              y: e.touches[0].clientY,
            };
          }}
          onTouchEnd={(e) => {
            // Arrastrar de lado cambia de día, como pasar fotos en la galería.
            const ini = deslizar.current;
            deslizar.current = null;
            if (!ini) return;
            const dx = e.changedTouches[0].clientX - ini.x;
            const dy = e.changedTouches[0].clientY - ini.y;
            if (Math.abs(dx) < 80 || Math.abs(dy) > 45) return;
            const siguiente = sumarDias(dia, dx < 0 ? 1 : -1);
            if (siguiente <= hoy) {
              sonar("toque");
              setDia(siguiente);
            }
          }}
        >
          <DelDia
            dia={dia}
            hoy={hoy}
            detalle={detalle}
            tira={tira}
            alCambiar={recargar}
            alVolverAHoy={() => setDia(hoy)}
          />
        </div>
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
  tira,
  alCambiar,
  alVolverAHoy,
}: {
  dia: FechaISO;
  hoy: FechaISO;
  detalle: Detalle;
  /** «Volver a hoy», para el día que todavía no llega. */
  alVolverAHoy: () => void;
  /** Lo cargado y lo cobrado de las tres semanas cercanas, para la racha y el récord. */
  tira: Map<FechaISO, DatosDelDia>;
  alCambiar: () => void;
}) {
  const vehiculo = useVehiculo();
  const puedeCargar = usePuedeEscribir();
  const [comanda, setComanda] = useState(false);
  /** «Tomar foto de una comanda» abre la hoja directo con la cámara; «Leer una
      comanda» desde «Subir más» la abre en su pantalla de siempre. */
  const [comandaConCamara, setComandaConCamara] = useState(false);
  const [subirMasAbierto, setSubirMasAbierto] = useState(false);
  const [bloqueAbierto, setBloqueAbierto] = useState<"apoyo" | "taxi" | null>(
    null,
  );
  const {
    jornada,
    regla,
    estado,
    tienda,
    tiendas,
    ajustes,
    descanso,
    bloques,
  } = detalle;
  /** Qué fila de «¿Qué hiciste hoy?» está desplegada. */
  const [filaAbierta, setFilaAbierta] = useState<string | null>(null);
  // Al añadir desde la fila de un tipo (Expo Vino…), la hoja se abre con ese tipo ya elegido.
  const [tipoParaNuevo, setTipoParaNuevo] = useState<string | null>(null);
  function abrirFila(cual: string) {
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
      texto:
        "La tira de arriba manda: toca el que quieres cargar. Por defecto es hoy.",
    },
    {
      selector: "#recorrido-cargar-resumen",
      titulo: "Cargar resumen del día",
      texto:
        "La forma normal: sube las capturas de la app de la tienda, con tus rutas y pedidos, al terminar la jornada.",
    },
    {
      selector: "#recorrido-tomar-foto",
      titulo: "Tomar foto de una comanda",
      texto:
        "El camino más corto: abre la cámara de una vez y registra un pedido apenas lo entregas, sin esperar al final del día.",
    },
    {
      selector: "#recorrido-lista",
      titulo: "¿Qué hiciste hoy?",
      texto:
        "Tus pedidos, un apoyo a otra tienda o una carrera de taxi. Toca lo que ya hiciste para ver el detalle, o lo que falta para anotarlo.",
    },
  ];

  // Lo que bloquea es haber cobrado, no haber cerrado la semana: cerrar en
  // Pagos congela el monto para poder anotar el pago, pero no debe impedir
  // corregir un pedido que faltó mientras eso no haya pasado.
  const editable = estado !== "pagada";
  const esFuturo = dia > hoy;

  const pedidosCentimos =
    jornada?.ordenes.reduce((s, o) => s + (o.montoCentimos ?? 0), 0) ?? 0;
  const cobrado = jornada
    ? montoDelDia(
        pedidosCentimos,
        regla,
        jornada.horaEntrada,
        jornada.horaSalida,
      ).pagadoCentimos
    : 0;
  const minutos =
    jornada?.rutas.reduce((s, r) => s + (r.duracionMin ?? 0), 0) ?? 0;
  const conCliente =
    jornada?.ordenes.filter((o) => o.cliente !== null).length ?? 0;
  /* Con apoyo o taxi, la pastilla del día es el total de todo —lo que de verdad
     produjo—, y debajo se reparte por fuente. Sin ellos, queda como siempre. */
  const extrasCentimos = bloques.reduce((s, b) => s + b.montoCentimos, 0);
  /* La racha: días seguidos cargados hasta este (un descanso no la corta). El
     récord: este día supera a todos los demás cargados de las tres semanas. */
  let racha = 0;
  for (let f = dia, n = 0; n < 21; f = sumarDias(f, -1), n++) {
    const d = tira.get(f);
    if (d?.cargado || (f === dia && cobrado + extrasCentimos > 0)) racha += 1;
    else if (!d?.descanso) break;
  }
  const otros = [...tira]
    .filter(([f, d]) => f !== dia && d.cargado && (d.centimos ?? 0) > 0)
    .map(([, d]) => d.centimos ?? 0);
  const record =
    otros.length >= 3 && cobrado + extrasCentimos > Math.max(...otros);
  const apoyos = bloques.filter((b) => b.tipo !== "taxi");
  const taxis = bloques.filter((b) => b.tipo === "taxi");
  // Cada tipo de adicional (Taxi, Expo Vino…) es una fila propia, igual que el apoyo.
  const tiposDeAdicional = [
    ...new Map(
      taxis.map((b) => [
        claveDeAdicional(b),
        b.tipo === "taxi" ? (b.categoriaNombre ?? "Taxi") : "Taxi",
      ]),
    ).entries(),
  ].map(([clave, nombre]) => ({
    clave,
    nombre,
    bloques: taxis.filter((b) => claveDeAdicional(b) === clave),
  }));
  const hayPedidos =
    (jornada?.ordenes.length ?? 0) > 0 || (jornada?.rutas.length ?? 0) > 0;
  const tieneDatos = Boolean(jornada && (hayPedidos || bloques.length > 0));
  /* En un día vacío y pasado, los dos botones grandes de cargar viven dentro de
     la ilustración; en los demás, al final de la pantalla. */
  const enVacio = !tieneDatos && !descanso && !esFuturo;
  const accionesDeCarga = (
    <div className="flex w-full flex-col gap-2.5">
      <div id="recorrido-cargar-resumen">
        <CargarCapturas deshabilitado={!puedeCargar} dia={dia} />
      </div>
      <div id="recorrido-tomar-foto">
        <BotonDeAccion
          k="comanda"
          disabled={!puedeCargar}
          onClick={() => {
            setComandaConCamara(true);
            setComanda(true);
          }}
        >
          <Ticket className="size-[22px]" />
          Tomar foto de una comanda
        </BotonDeAccion>
      </div>
      <p className="text-center text-xs text-tinta-3">
        Una foto por pedido, con cliente y dirección: directo a la cámara.
      </p>
    </div>
  );
  const desglose = desglosePorFuente({
    tiendaNombre: tienda?.nombre ?? null,
    pedidosTienda: jornada?.ordenes.length ?? 0,
    centimosTienda: cobrado,
    bloques,
  });

  return (
    <>
      {tieneDatos && jornada ? (
        <TarjetaViva
          encabezado={
            dia === hoy ? "Hoy cargaste" : `El ${nombreDelDia(dia)} cargaste`
          }
          pedidos={jornada.ordenes.length}
          rutas={jornada.rutas.length}
          filas={desglose}
          totalCentimos={cobrado + extrasCentimos}
          vehiculo={vehiculo}
          racha={racha}
          record={record}
          alElegir={(c) => {
            setFilaAbierta(c);
            document
              .getElementById("recorrido-lista")
              ?.scrollIntoView({ behavior: "smooth", block: "center" });
          }}
        />
      ) : (
        <DiaSinCarga
          fecha={dia}
          hoy={hoy}
          descanso={descanso}
          puedeEscribir={puedeCargar}
          alCambiar={alCambiar}
          alVolverAHoy={alVolverAHoy}
          acciones={enVacio ? accionesDeCarga : null}
        />
      )}

      {/* ¿Qué hiciste hoy? Tres preguntas con su respuesta: lo hecho se
          despliega al tocarlo; lo que falta empieza a anotarse al tocarlo. */}
      <div id="recorrido-lista" className="flex flex-col gap-2.5">
        {tieneDatos && (
          <h3
            className="ini-rise px-1 font-display text-lg"
            style={{ animationDelay: "140ms" }}
          >
            {dia === hoy
              ? "¿Qué hiciste hoy?"
              : `¿Qué hiciste el ${nombreDelDia(dia)}?`}
          </h3>
        )}

        <FilaDeLista
          indice={0}
          k="tienda"
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
          alPulsar={() =>
            hayPedidos ? abrirFila("tienda") : setSubirMasAbierto(true)
          }
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
            <BotonDeAccion k="tienda" className="!min-h-12 !text-base" onClick={() => setSubirMasAbierto(true)}>
              <Suma className="size-5" />
              Agregar más pedidos o rutas
            </BotonDeAccion>
          )}
        </FilaDeLista>

        {apoyos.length > 0 && (
          <FilaDeLista
            indice={1}
            k="apoyo"
            titulo="Apoyé a otra tienda"
            resumen={
              apoyos.length > 0
                ? desglose
                    .filter((f) => f.categoria === "apoyo")
                    .map(
                      (f) =>
                        `${f.etiqueta.replace("Apoyo · ", "")} · ${f.detalle}`,
                    )
                    .join(" · ")
                : "Toca si cubriste otra tienda"
            }
            monto={
              apoyos.length > 0
                ? formatearSoles(
                    apoyos.reduce((s, b) => s + b.montoCentimos, 0),
                  )
                : undefined
            }
            hecha={apoyos.length > 0}
            abierta={filaAbierta === "apoyo"}
            alPulsar={() =>
              apoyos.length > 0 ? abrirFila("apoyo") : setBloqueAbierto("apoyo")
            }
          >
            <BloquesDelDia
              fecha={dia}
              bloques={apoyos}
              editable={editable && puedeCargar}
              alCambiar={alCambiar}
            />
            {!esFuturo && (
              <BotonDeAccion k="apoyo" className="!min-h-12 !text-base" onClick={() => setBloqueAbierto("apoyo")}>
                <Suma className="size-5" />
                Agregar otro apoyo
              </BotonDeAccion>
            )}
          </FilaDeLista>
        )}

        {tiposDeAdicional.map((t, i) => {
          const centimos = t.bloques.reduce((s, b) => s + b.montoCentimos, 0);
          return (
            <FilaDeLista
              key={t.clave}
              indice={2 + i}
              k={t.nombre === "Taxi" ? "taxi" : "adicional"}
              titulo={t.nombre === "Taxi" ? "Hice taxi" : t.nombre}
              resumen={desglose.find((f) => f.clave === t.clave)?.detalle ?? ""}
              monto={formatearSoles(centimos)}
              hecha
              abierta={filaAbierta === t.clave}
              alPulsar={() => abrirFila(t.clave)}
            >
              <BloquesDelDia
                fecha={dia}
                bloques={t.bloques}
                editable={editable && puedeCargar}
                alCambiar={alCambiar}
              />
              {!esFuturo && (
                <BotonDeAccion
                  k={t.nombre === "Taxi" ? "taxi" : "adicional"}
                  className="!min-h-12 !text-base"
                  onClick={() => {
                    setTipoParaNuevo(t.clave.replace(/^adic:/, ""));
                    setBloqueAbierto("taxi");
                  }}
                >
                  <Suma className="size-5" />
                  Agregar otro de {t.nombre}
                </BotonDeAccion>
              )}
            </FilaDeLista>
          );
        })}
      </div>

      {!enVacio && (
        <div className="ini-rise" style={{ animationDelay: "420ms" }}>
          {accionesDeCarga}
        </div>
      )}

      {subirMasAbierto && !esFuturo && (
        <HojaSubirMas
          titulo="Pedidos de mi tienda"
          alCerrar={() => setSubirMasAbierto(false)}
        >
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

      {recorrido && (
        <RecorridoGuiado
          pasos={pasosRecorrido}
          alTerminar={() => setRecorrido(false)}
        />
      )}

      {comanda && (
        <HojaDeComandas
          fecha={dia}
          regla={regla}
          rutas={(jornada?.rutas ?? []).map((r) => ({
            numero: r.numero,
            inicio: r.horaInicio,
          }))}
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

      {bloqueAbierto && (
        <HojaDeBloqueExtra
          tipo={bloqueAbierto}
          categoriaInicial={bloqueAbierto === "taxi" ? (tipoParaNuevo ?? undefined) : undefined}
          fecha={dia}
          tiendas={tiendas.filter((t) => t.id !== tienda?.id)}
          factorCalles={tienda?.factorCalles ?? 1.3}
          alCerrar={() => setBloqueAbierto(null)}
          alGuardar={() => {
            sonar("moneda");
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
 * Cada estado trae su ilustración y sus botones grandes: nada de texto suelto.
 */
function DiaSinCarga({
  fecha,
  hoy,
  descanso,
  puedeEscribir,
  alCambiar,
  alVolverAHoy,
  acciones,
}: {
  fecha: FechaISO;
  hoy: FechaISO;
  descanso: boolean;
  puedeEscribir: boolean;
  alCambiar: () => void;
  alVolverAHoy: () => void;
  /** Los botones grandes de cargar, cuando el día se puede cargar. */
  acciones: React.ReactNode;
}) {
  const [ocupado, setOcupado] = useState(false);
  const [quitando, setQuitando] = useState(false);
  const esFuturo = fecha > hoy;
  const corto = `${nombreDelDia(fecha)} ${Number(fecha.slice(8, 10))}`;

  async function cambiar() {
    setOcupado(true);
    try {
      if (descanso) await quitarDescanso([fecha]);
      else await marcarDescanso([fecha]);
      alCambiar();
    } finally {
      setOcupado(false);
      setQuitando(false);
    }
  }

  if (descanso) {
    return (
      <section className="ini-vacio ini-rise" style={{ animationDelay: "210ms" }} aria-label="Día de descanso">
        <IlustracionDelDia tipo="luna" />
        <h3>Día de descanso</h3>
        <p>Ese día no cuenta. Descansar también es trabajo.</p>
        <button
          type="button"
          className="boton-sec"
          disabled={!puedeEscribir || ocupado}
          onClick={() => setQuitando(true)}
        >
          <Historial className="size-[18px]" />
          Quitar el descanso
        </button>
        {quitando && (
          <DialogoConfirmar
            titulo={`¿Quitar el descanso del ${corto}?`}
            texto="Ese día volverá a contar como un día por subir."
            confirmar="Sí, quitar el descanso"
            ocupado={ocupado}
            alCancelar={() => setQuitando(false)}
            alConfirmar={() => void cambiar()}
          />
        )}
      </section>
    );
  }

  if (esFuturo) {
    return (
      <section className="ini-vacio ini-rise" style={{ animationDelay: "210ms" }} aria-label="Día que todavía no llega">
        <IlustracionDelDia tipo="futuro" />
        <h3>Ese día todavía no llega</h3>
        <p>Cuando llegue, aquí vas a cargar tus pedidos.</p>
        <button type="button" className="boton-principal" onClick={alVolverAHoy}>
          <Historial className="size-[20px]" />
          Volver a hoy
        </button>
      </section>
    );
  }

  return (
    <section className="ini-vacio ini-rise" style={{ animationDelay: "210ms" }} aria-label="Sin cargar">
      <IlustracionDelDia tipo="vacio" />
      <h3>{fecha === hoy ? "Hoy: sin cargar" : "Ese día: sin cargar"}</h3>
      <p>
        {fecha === hoy
          ? "Sube el resumen o toma una foto de la comanda."
          : "Súbelo cuando quieras: manda la fecha de la captura, no la de hoy."}
      </p>
      {acciones}
      <button
        type="button"
        className="boton-sec w-full"
        disabled={!puedeEscribir || ocupado}
        onClick={() => void cambiar()}
      >
        <Luna className="size-[18px]" />
        No trabajé este día
      </button>
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
 * que necesita. Sale solo cuando toca, y el botón hace el respaldo **ahí
 * mismo**: abre el selector de Android para mandarlo a Drive, a WhatsApp o al
 * correo, sin pasar por Ajustes. La «×» lo esconde hasta la próxima vez que se
 * abra la app.
 */
function RecordatorioDeRespaldo() {
  const { datos: ultimo, recargar } = useDatos(async () => {
    const { ultimoRespaldoCreado } = await import("@/lib/db/sqlite/respaldo");
    return ultimoRespaldoCreado();
  }, []);
  const [haciendo, setHaciendo] = useState(false);
  const [oculto, setOculto] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (ultimo === undefined || oculto) return null; // todavía cargando, o escondido

  const mensaje =
    ultimo === null
      ? "Todavía no has hecho ningún respaldo"
      : diasEntre(ultimo.slice(0, 10), hoyEnLima()) >= 14
        ? `Tu último respaldo fue hace ${diasEntre(ultimo.slice(0, 10), hoyEnLima())} días`
        : null;

  if (!mensaje) return null;

  async function respaldar() {
    setHaciendo(true);
    setError(null);
    try {
      const { crearYCompartirRespaldo } =
        await import("@/lib/db/sqlite/compartir-respaldo");
      await crearYCompartirRespaldo();
      recargar();
    } catch (fallo) {
      // Cerrar el selector sin elegir nada no es un fallo que valga la pena gritar.
      const texto = fallo instanceof Error ? fallo.message : "";
      if (!/cancel/i.test(texto))
        setError(texto || "No se pudo crear el respaldo.");
    } finally {
      setHaciendo(false);
    }
  }

  return (
    <div className="ini-resp ini-rise mx-auto w-full max-w-[880px]" style={{ animationDelay: "480ms" }}>
      <IlustracionDelDia tipo="nube" />
      <div className="min-w-0 flex-1">
        <b className="block leading-tight">{mensaje}</b>
        <small className="block text-tinta-2">
          Guarda tus datos en Drive o por WhatsApp. Si cambias de teléfono, los restauras en Ajustes.
        </small>
        <div className="mt-2 flex flex-wrap gap-2">
          <button
            type="button"
            disabled={haciendo}
            onClick={() => void respaldar()}
            className="boton-principal !min-h-11 !px-4 !text-base"
          >
            {haciendo ? "Abriendo…" : "Respaldar ahora"}
          </button>
          <Link href="/ajustes" className="boton-sec">
            Ir a Ajustes
          </Link>
        </div>
        {error && <span className="mt-1 block text-xs text-mal">{error}</span>}
      </div>
      <button
        type="button"
        className="ini-icb self-start"
        onClick={() => setOculto(true)}
        aria-label="Ocultar el aviso de respaldo"
      >
        <Equis className="size-[18px]" />
      </button>
    </div>
  );
}

function Esqueleto() {
  return (
    <div
      className="mx-auto flex max-w-[880px] animate-pulse flex-col gap-4"
      aria-hidden
    >
      <div className="h-8 w-56 rounded bg-sup-2" />
      <div className="h-[66px] rounded-btn bg-sup-2" />
      <div className="h-[150px] rounded-card bg-sup-2" />
      <div className="h-[60px] rounded-card bg-sup-2" />
      <div className="h-[62px] rounded-card bg-sup-2" />
    </div>
  );
}
