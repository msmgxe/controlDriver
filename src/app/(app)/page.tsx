"use client";

import { useRef, useState } from "react";
import Link from "next/link";

import { Acordeon } from "@/components/Acordeon";
import { CargarCapturas } from "@/components/CargarCapturas";
import { usePuedeEscribir } from "@/components/Licencia";
import { PanelDeDescansos } from "@/components/PanelDeDescansos";
import { Flecha, Luna, Reloj, Subir } from "@/components/iconos";
import { MontoHero, TarjetaDelDia, TiraSemana } from "@/components/ui";
import { useDatos } from "@/hooks/useDatos";
import { useVehiculo } from "@/hooks/useVehiculo";
import { useVersion } from "@/hooks/useVersion";
import { diasEntre } from "@/lib/licencia/estado";
import { descansosPorRango, marcarDescanso, quitarDescanso } from "@/lib/db/sqlite/descansos";
import { jornadaPorFecha, resumenPorRango } from "@/lib/db/sqlite/jornadas";
import {
  formatearDuracion,
  formatearFecha,
  formatearFechaLarga,
  hoyEnLima,
  nombreDelDia,
  rangoDeFechas,
  semanaDe,
  sumarDias,
  type FechaISO,
} from "@/lib/fechas";
import { formatearSoles } from "@/lib/pagos/reglas";

/**
 * Inicio (§9), con la cara «Mapa»/«Asfalto».
 *
 * El principio de §1 sigue siendo "una sola acción diaria": cargar manda y está
 * siempre a mano —aquí, y en el auto de la barra de abajo—. Lo demás va en este
 * orden porque es el orden en que se pregunta:
 *
 *   1. **¿Qué día miro?** La semana en curso como fichas, de lunes a domingo,
 *      con flechas para moverse a la semana anterior o a la siguiente. La
 *      fecha se elige arriba y no manda sobre la carga: las capturas traen su
 *      propia fecha, y atarlas al día elegido sería una trampa silenciosa
 *      —subir el lunes las del domingo lo guardaría mal—.
 *   2. **¿Cuánto llevo?** La cifra grande del día, con el auto.
 *   3. **¿Por dónde anduve?** El recorrido: cada ruta como una parada.
 *   4. **¿Y la semana?** Lo que suma, qué días faltan y cuáles fueron descanso.
 */
export default function PaginaInicio() {
  const hoy = hoyEnLima();
  const [dia, setDia] = useState<FechaISO>(hoy);
  const puedeCargar = usePuedeEscribir();
  const vehiculo = useVehiculo();

  const semana = semanaDe(dia);
  const esSemanaActual = semana.inicio === semanaDe(hoy).inicio;
  // 60 días antes del lunes que se está mirando, no de hoy: si no, navegar
  // varias semanas atrás mostraría un día "cargado" en la tira sin sus datos.
  const desde = sumarDias(semana.inicio, -60);

  const { datos, cargando, recargar } = useDatos(
    async () => {
      const [filas, descansos] = await Promise.all([
        resumenPorRango(desde, semana.fin),
        descansosPorRango(desde, semana.fin),
      ]);
      return { filas, descansos };
    },
    [desde, semana.fin],
    { conservar: true },
  );

  if (cargando || !datos) return <Esqueleto />;

  const porFecha = new Map(datos.filas.map((f) => [f.fecha, f]));
  const descansos = new Set<FechaISO>(datos.descansos);
  const delDia = porFecha.get(dia);

  const deLaSemana = rangoDeFechas(semana.inicio, semana.fin).map((fecha) => {
    const f = porFecha.get(fecha);
    return {
      fecha,
      cargado: Boolean(f),
      pedidos: f?.pedidos ?? 0,
      descanso: !f && descansos.has(fecha),
    };
  });

  const cargadas = deLaSemana.filter((d) => d.cargado);
  const deDescanso = deLaSemana.filter((d) => d.descanso).map((d) => d.fecha);
  const totalSemana = cargadas.reduce(
    (acc, d) => {
      const f = porFecha.get(d.fecha)!;
      return {
        pedidos: acc.pedidos + f.pedidos,
        rutas: acc.rutas + f.rutas,
        centimos: acc.centimos + f.montoCentimos,
      };
    },
    { pedidos: 0, rutas: 0, centimos: 0 },
  );

  // Faltan los días pasados que ni se cargaron ni se dijeron de descanso.
  const faltan = deLaSemana.filter((d) => !d.cargado && !d.descanso && d.fecha < hoy);

  return (
    <div className="mx-auto flex max-w-[880px] flex-col gap-4">
      <SelectorDeDia
        dia={dia}
        hoy={hoy}
        dias={deLaSemana}
        esSemanaActual={esSemanaActual}
        alElegir={setDia}
        alMoverSemana={(delta) => setDia((d) => sumarDias(d, delta * 7))}
      />

      {delDia ? (
        <TarjetaDelDia
          encabezado={dia === hoy ? "Hoy cargaste" : `El ${nombreDelDia(dia)} cargaste`}
          cifra={String(delDia.pedidos)}
          pie={`pedidos · ${delDia.rutas} ruta${delDia.rutas === 1 ? "" : "s"}`}
          monto={formatearSoles(delDia.montoCentimos)}
          vehiculo={vehiculo}
        />
      ) : (
        <DiaSinCarga
          fecha={dia}
          hoy={hoy}
          descanso={descansos.has(dia)}
          puedeEscribir={puedeCargar}
          alCambiar={recargar}
        />
      )}

      <CargarCapturas deshabilitado={!puedeCargar} />

      {delDia && (
        <Recorrido
          fecha={dia}
          hoy={hoy}
          minutosEnRuta={delDia.minutosEnRuta}
          horaEntrada={delDia.horaEntrada}
          horaSalida={delDia.horaSalida}
        />
      )}

      <section className="tarjeta flex flex-col gap-4" aria-label="La semana">
        <div className="flex items-baseline justify-between gap-2">
          <h3 className="text-base">
            Sem. {Number(semana.inicio.slice(8, 10))}–{Number(semana.fin.slice(8, 10))}
          </h3>
          <span className="font-mono text-xs text-tinta-3">
            {cargadas.length} de 7 días
            {deDescanso.length > 0 && ` · ${deDescanso.length} descanso`}
          </span>
        </div>
        <MontoHero
          centimos={totalSemana.centimos}
          pie={`${totalSemana.pedidos} pedidos · ${totalSemana.rutas} rutas`}
        />
        <TiraSemana dias={deLaSemana} hoy={hoy} />
        <div className="flex items-center gap-2 text-sm text-tinta-2">
          <Reloj className="size-4" />
          <span>Se paga el viernes {formatearFecha(semana.pago)}</span>
        </div>
        <PanelDeDescansos
          faltan={faltan.map((d) => d.fecha)}
          descansos={deDescanso}
          alCambiar={recargar}
        />
      </section>

      <RecordatorioDeRespaldo />
      <PieDeVersion />
    </div>
  );
}

/**
 * Un día que no está cargado: se puede subir, o decir que no se trabajó.
 *
 * Es lo que en Pagos se contesta con «No trabajé esos días», pero para un solo
 * día y desde donde se está mirando: si el jueves fue libre, se dice aquí mismo.
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
        <button
          type="button"
          className="boton-sec shrink-0"
          disabled={!puedeEscribir || ocupado}
          onClick={() => void cambiar()}
        >
          Quitar
        </button>
      </section>
    );
  }

  return (
    <section className="tarjeta flex flex-col gap-3" aria-label="Sin cargar">
      <div>
        <b className="text-base font-bold">{fecha === hoy ? "Hoy" : "Ese día"}: sin cargar</b>
        <p className="text-sm text-tinta-2">
          {fecha === hoy
            ? "Todavía no has subido las capturas de hoy."
            : esFuturo
              ? "Ese día todavía no llega."
              : "Puedes subirlo cuando quieras: manda la fecha de la captura, no la de hoy."}
        </p>
      </div>
      {!esFuturo && (
        <div className="flex flex-wrap gap-2">
          {/* La otra salida de un día sin capturas: anotar los pedidos a mano
              en vez de decir que no se trabajó. Antes no había cómo llegar
              aquí sin subir una captura primero. */}
          <Link href={`/jornada?fecha=${fecha}`} className="boton-sec">
            <Subir className="size-[18px]" />
            Añadir pedidos a mano
          </Link>
          <button
            type="button"
            className="boton-sec"
            disabled={!puedeEscribir || ocupado}
            onClick={() => void cambiar()}
          >
            <Luna className="size-[18px]" />
            No trabajé este día
          </button>
        </div>
      )}
    </section>
  );
}

/**
 * El recorrido del día: cada ruta, una parada.
 *
 * Es la lista de rutas que ya se leyó de las capturas, puesta como se recorrió:
 * de arriba abajo, con su horario y cuántos pedidos tuvo. Se enseñan las tres
 * primeras y el resto se resume en una parada final, para que la pantalla no se
 * alargue en un día de once rutas; el detalle completo está un toque más allá.
 */
function Recorrido({
  fecha,
  hoy,
  minutosEnRuta,
  horaEntrada,
  horaSalida,
}: {
  fecha: FechaISO;
  hoy: FechaISO;
  minutosEnRuta: number;
  horaEntrada: string | null;
  horaSalida: string | null;
}) {
  const { datos: jornada } = useDatos(() => jornadaPorFecha(fecha), [fecha], { conservar: true });
  if (!jornada || jornada.rutas.length === 0) return null;

  const rutas = [...jornada.rutas].sort((a, b) => a.numero - b.numero);
  const pedidosDe = (numero: number) => jornada.ordenes.filter((o) => o.ruta === numero).length;

  const visibles = rutas.slice(0, 3);
  const resto = rutas.slice(3);
  const pedidosResto = resto.reduce((s, r) => s + pedidosDe(r.numero), 0);
  const ultimoFin = resto.map((r) => r.horaFin).filter(Boolean).sort().at(-1);

  return (
    <Acordeon
      titulo={fecha === hoy ? "Tu recorrido de hoy" : "El recorrido de ese día"}
      resumen={`${rutas.length} ruta${rutas.length === 1 ? "" : "s"} · ${formatearDuracion(minutosEnRuta)} en ruta`}
    >
      <div className="flex flex-col gap-3">
        <ol className="flex flex-col">
          {visibles.map((r, i) => {
            const n = pedidosDe(r.numero);
            return (
              <Parada
                key={r.id}
                primera={i === 0}
                ultima={resto.length === 0 && i === visibles.length - 1}
                pin={String(r.numero)}
                titulo={`Ruta ${r.numero}`}
                detalle={
                  r.horaInicio && r.horaFin ? `${r.horaInicio} – ${r.horaFin}` : "Sin horario"
                }
                etiqueta={`${n} pedido${n === 1 ? "" : "s"}`}
              />
            );
          })}
          {resto.length > 0 && (
            <Parada
              fin
              ultima
              pin={`+${resto.length}`}
              titulo={`Otras ${resto.length} ruta${resto.length === 1 ? "" : "s"}`}
              detalle={ultimoFin ? `hasta las ${ultimoFin}` : "…"}
              etiqueta={`${pedidosResto} pedido${pedidosResto === 1 ? "" : "s"}`}
            />
          )}
        </ol>

        {horaEntrada && horaSalida && (
          <dl className="flex flex-col text-sm">
            <Dato etiqueta="En tienda" valor={`${horaEntrada} a ${horaSalida}`} />
          </dl>
        )}
        <Link
          href={`/jornada?fecha=${fecha}`}
          className="inline-flex min-h-11 items-center gap-2 self-start text-sm font-semibold text-acento"
        >
          Ver y corregir el detalle
          <Flecha className="size-4" />
        </Link>
      </div>
    </Acordeon>
  );
}

/** Una parada del recorrido: un pin numerado sobre una línea discontinua. */
function Parada({
  pin,
  titulo,
  detalle,
  etiqueta,
  primera = false,
  ultima = false,
  fin = false,
}: {
  pin: string;
  titulo: string;
  detalle: string;
  etiqueta: string;
  primera?: boolean;
  ultima?: boolean;
  fin?: boolean;
}) {
  return (
    <li
      className={`relative grid grid-cols-[24px_1fr_auto] items-center gap-3 py-2 before:absolute before:left-3 before:border-l-2 before:border-dashed before:border-acento/40 before:content-[''] ${
        primera ? "before:top-1/2" : "before:top-0"
      } ${ultima ? "before:bottom-1/2" : "before:bottom-0"}`}
    >
      <span
        className={`relative z-10 grid size-6 -rotate-45 place-items-center rounded-[50%_50%_50%_4px] ${
          fin ? "bg-acento-2 text-acento-2-tinta" : "bg-acento text-acento-texto"
        }`}
      >
        <b className="rotate-45 font-mono text-[10px] leading-none">{pin}</b>
      </span>
      <span className="flex min-w-0 flex-col">
        <b className="truncate text-sm font-bold">{titulo}</b>
        <span className="font-mono text-xs text-tinta-3">{detalle}</span>
      </span>
      <span className="rounded-chip bg-sup-2 px-2.5 py-0.5 text-[11px] font-semibold text-tinta-2">
        {etiqueta}
      </span>
    </li>
  );
}

/**
 * Qué versión está corriendo, al pie de Inicio.
 *
 * Nace de un fallo concreto: alguien estuvo probando una versión de hace
 * varios cambios sin saberlo, porque nada en la propia app se lo decía. El
 * número solo vivía en Ajustes, y a nadie se le ocurre ir a mirarlo si no
 * sospecha que algo anda desactualizado. Aquí está a la vista sin buscarlo,
 * en la pantalla que se abre siempre primero.
 */
/**
 * Recuerda hacer un respaldo si nunca se hizo uno, o si el último ya tiene
 * más de dos semanas.
 *
 * La base vive solo en este teléfono, y hasta que exista la copia en la nube
 * un respaldo manual es la única red de seguridad real. Se avisa aquí, en
 * Inicio, y no solo en Ajustes: nadie va a Ajustes a buscar algo que no sabe
 * que necesita.
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

function PieDeVersion() {
  const datos = useVersion();
  if (!datos) return null;

  return (
    <p className="pt-2 text-center text-xs text-tinta-3">
      Rutas-A · versión {datos.version}
      {datos.build !== "—" && ` (${datos.build})`}
    </p>
  );
}

/**
 * Elegir qué día se está mirando.
 *
 * La semana entera como fichas, de lunes a domingo —así se corresponde con
 * cómo se paga (§13)—. Se cambia de semana igual que se pasa una foto en el
 * carrusel de un teléfono: arrastrando con el dedo, la tira sigue el
 * movimiento en vivo y la semana nueva entra deslizándose por donde empujó
 * el dedo. No hay flechas —tocarlas no se sentía a nada— y no se puede pasar
 * de la semana actual: no tiene sentido deslizar a una que todavía no llega.
 * Un punto bajo la ficha indica que ese día ya está cargado, así se ve de un
 * vistazo lo que falta sin abrir nada. El calendario de al lado salta directo
 * a cualquier fecha, sin tener que arrastrar semana por semana.
 */
function SelectorDeDia({
  dia,
  hoy,
  dias,
  esSemanaActual,
  alElegir,
  alMoverSemana,
}: {
  dia: FechaISO;
  hoy: FechaISO;
  dias: Array<{ fecha: FechaISO; cargado: boolean; descanso: boolean }>;
  esSemanaActual: boolean;
  alElegir: (f: FechaISO) => void;
  alMoverSemana: (delta: -1 | 1) => void;
}) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-end justify-between gap-3">
        {/* Sin el año: ya lo dice el selector de al lado, y con la letra condensada y en
            mayúsculas del modo oscuro la fecha entera ocupaba cuatro líneas. */}
        <h2 className="text-[26px] leading-tight first-letter:uppercase">
          {formatearFechaLarga(dia).replace(/ de \d{4}$/, "")}
        </h2>
        <label className="shrink-0">
          <span className="sr-only">Elegir otra fecha</span>
          <input
            type="date"
            value={dia}
            max={hoy}
            onChange={(e) => e.target.value && alElegir(e.target.value as FechaISO)}
            className="min-h-11 rounded-btn border border-linea-fuerte bg-sup px-3 text-sm"
          />
        </label>
      </div>

      <TiraDeDiasDeslizable
        dia={dia}
        hoy={hoy}
        dias={dias}
        esSemanaActual={esSemanaActual}
        alElegir={alElegir}
        alMoverSemana={alMoverSemana}
      />

      {!esSemanaActual && (
        <button
          type="button"
          onClick={() => alElegir(hoy)}
          className="self-start text-xs font-semibold text-acento-tinta underline underline-offset-2"
        >
          Volver a hoy
        </button>
      )}
    </div>
  );
}

/** Cuánto hay que arrastrar, en píxeles, para que cuente como "cambiar de semana" y no como un toque que tembló. */
const UMBRAL_ARRASTRE = 8;

function TiraDeDiasDeslizable({
  dia,
  hoy,
  dias,
  esSemanaActual,
  alElegir,
  alMoverSemana,
}: {
  dia: FechaISO;
  hoy: FechaISO;
  dias: Array<{ fecha: FechaISO; cargado: boolean; descanso: boolean }>;
  esSemanaActual: boolean;
  alElegir: (f: FechaISO) => void;
  alMoverSemana: (delta: -1 | 1) => void;
}) {
  const marcoRef = useRef<HTMLDivElement>(null);
  const [offset, setOffset] = useState(0);
  const [conTransicion, setConTransicion] = useState(false);
  // Refs, no estado: cambian en cada milímetro de arrastre y no deben, por sí
  // solos, disparar un nuevo render —eso ya lo hace `setOffset`.
  const arrastre = useRef<{ id: number; x0: number; ancho: number; movioBastante: boolean } | null>(
    null,
  );
  const direccionPendiente = useRef<-1 | 1 | null>(null);

  function empezar(e: React.PointerEvent<HTMLDivElement>) {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    arrastre.current = {
      id: e.pointerId,
      x0: e.clientX,
      ancho: marcoRef.current?.clientWidth ?? 320,
      movioBastante: false,
    };
    setConTransicion(false);
  }

  function mover(e: React.PointerEvent<HTMLDivElement>) {
    const a = arrastre.current;
    if (!a || a.id !== e.pointerId) return;
    let delta = e.clientX - a.x0;
    if (!a.movioBastante && Math.abs(delta) > UMBRAL_ARRASTRE) {
      a.movioBastante = true;
      // Recién ahora, que de verdad es un arrastre y no un toque, se captura
      // el puntero —para seguir recibiendo `pointermove`/`pointerup` aunque
      // el dedo se salga del recuadro—. Capturarlo desde el primer toque
      // desviaba el click entero hacia este contenedor, y el día tocado
      // dejaba de elegirse: un simple toque nunca llegaba a su botón.
      e.currentTarget.setPointerCapture(e.pointerId);
    }
    // Resistencia si se intenta ir a una semana que todavía no llega: la tira
    // se mueve, pero un tercio, para que se sienta el tope sin ser rígido.
    if (delta < 0 && esSemanaActual) delta /= 3;
    setOffset(delta);
  }

  function soltar(e: React.PointerEvent<HTMLDivElement>) {
    const a = arrastre.current;
    if (!a || a.id !== e.pointerId) return;
    arrastre.current = null;
    const delta = e.clientX - a.x0;
    const umbral = Math.min(64, a.ancho / 4);
    if (delta <= -umbral && !esSemanaActual) confirmar(1, a.ancho);
    else if (delta >= umbral) confirmar(-1, a.ancho);
    else {
      setConTransicion(true);
      setOffset(0);
    }
  }

  function confirmar(direccion: -1 | 1, ancho: number) {
    direccionPendiente.current = direccion;
    setConTransicion(true);
    setOffset(direccion === 1 ? -ancho : ancho);
  }

  /** Termina la salida y hace entrar la semana nueva por el lado opuesto. */
  function alTerminarTransicion() {
    const direccion = direccionPendiente.current;
    if (direccion === null) return;
    direccionPendiente.current = null;
    const ancho = marcoRef.current?.clientWidth ?? 320;
    alMoverSemana(direccion);
    setConTransicion(false);
    setOffset(direccion === 1 ? ancho : -ancho);
    // Dos cuadros: el primero deja pintada la tira ya en el borde opuesto sin
    // transición, el segundo activa la transición y la manda a 0. Uno solo no
    // basta —el navegador a veces junta el salto y la animación en el mismo
    // cuadro y no se ve nada moverse.
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        setConTransicion(true);
        setOffset(0);
      });
    });
  }

  return (
    <div
      ref={marcoRef}
      className="-mx-4 overflow-hidden px-4"
      style={{ touchAction: "pan-y" }}
      onPointerDown={empezar}
      onPointerMove={mover}
      onPointerUp={soltar}
      onPointerCancel={soltar}
      // Un arrastre que sí cambió de semana no debe, además, elegir el día que
      // haya quedado bajo el dedo al soltar: eso tocaría un día que no se
      // quiso tocar.
      onClickCapture={(e) => {
        if (arrastre.current?.movioBastante) e.stopPropagation();
      }}
    >
      <div
        className={`flex gap-1.5 pb-1 ${conTransicion ? "transition-transform duration-200 ease-out" : ""}`}
        style={{ transform: `translateX(${offset}px)` }}
        onTransitionEnd={alTerminarTransicion}
      >
        {dias.map(({ fecha, cargado, descanso }) => {
          const elegido = fecha === dia;
          return (
            <button
              key={fecha}
              type="button"
              onClick={() => alElegir(fecha)}
              aria-pressed={elegido}
              aria-label={`${nombreDelDia(fecha)} ${Number(fecha.slice(8))}${
                cargado ? ", cargado" : descanso ? ", descanso" : ""
              }`}
              className={`flex min-h-[58px] flex-1 basis-0 flex-col items-center justify-center gap-0.5 rounded-btn border text-xs select-none ${
                elegido
                  ? "border-acento bg-acento text-acento-texto"
                  : fecha === hoy
                    ? "border-acento/50 bg-sup-2 text-tinta-2"
                    : "border-linea bg-sup-2 text-tinta-2"
              }`}
            >
              <span className="capitalize">{nombreDelDia(fecha).slice(0, 3)}</span>
              <b className="text-base font-semibold">{fecha.slice(8)}</b>
              {/* Un punto: del color de la marca si está cargado, amarillo si fue
                  descanso. La forma no cambia; el aria-label dice cuál es. */}
              <span
                aria-hidden
                className={`size-1.5 rounded-full ${
                  cargado
                    ? elegido
                      ? "bg-acento-texto"
                      : "bg-acento"
                    : descanso
                      ? "bg-descanso ring-1 ring-tinta/30"
                      : "bg-transparent"
                }`}
              />
            </button>
          );
        })}
      </div>
    </div>
  );
}

function Dato({ etiqueta, valor }: { etiqueta: string; valor: string }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-linea py-2 last:border-0">
      <dt className="text-tinta-2">{etiqueta}</dt>
      <dd className="font-medium">{valor}</dd>
    </div>
  );
}

function Esqueleto() {
  return (
    <div className="mx-auto flex max-w-[880px] animate-pulse flex-col gap-4" aria-hidden>
      <div className="h-8 w-56 rounded bg-sup-2" />
      <div className="h-[58px] rounded-btn bg-sup-2" />
      <div className="h-[92px] rounded-card bg-sup-2" />
      <div className="h-[72px] rounded-card bg-sup-2" />
      <div className="h-[72px] rounded-card bg-sup-2" />
    </div>
  );
}
