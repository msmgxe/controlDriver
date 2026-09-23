"use client";

import { useState } from "react";
import Link from "next/link";

import { CargarCapturas } from "@/components/CargarCapturas";
import { usePuedeEscribir } from "@/components/Licencia";
import { PanelDeDescansos } from "@/components/PanelDeDescansos";
import { Flecha, Luna, Reloj } from "@/components/iconos";
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
 *   1. **¿Qué día miro?** Los últimos siete días como fichas. La fecha se elige
 *      arriba y no manda sobre la carga: las capturas traen su propia fecha, y
 *      atarlas al día elegido sería una trampa silenciosa —subir el lunes las
 *      del domingo lo guardaría mal—.
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
  const desde = sumarDias(hoy, -60);

  const { datos, cargando, recargar } = useDatos(
    async () => {
      const [filas, descansos] = await Promise.all([
        resumenPorRango(desde, semana.fin),
        descansosPorRango(desde, semana.fin),
      ]);
      return { filas, descansos };
    },
    [hoy, semana.fin],
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
      <SelectorDeDia dia={dia} hoy={hoy} alElegir={setDia} cargadas={porFecha} descansos={descansos} />

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
        <button
          type="button"
          className="boton-sec self-start"
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
    <section className="tarjeta flex flex-col gap-1" aria-label="Recorrido del día">
      <h3 className="text-base">{fecha === hoy ? "Tu recorrido de hoy" : "El recorrido de ese día"}</h3>

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

      <dl className="mt-1 flex flex-col text-sm">
        <Dato etiqueta="Tiempo en ruta" valor={formatearDuracion(minutosEnRuta)} />
        {horaEntrada && horaSalida && (
          <Dato etiqueta="En tienda" valor={`${horaEntrada} a ${horaSalida}`} />
        )}
      </dl>
      <Link
        href={`/jornada?fecha=${fecha}`}
        className="inline-flex min-h-11 items-center gap-2 self-start text-sm font-semibold text-acento"
      >
        Ver y corregir el detalle
        <Flecha className="size-4" />
      </Link>
    </section>
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
 * Los últimos siete días como fichas —que es lo que se consulta el 95 % de las
 * veces— y un calendario al lado para ir más atrás sin pelearse con flechas.
 * Un punto bajo la ficha indica que ese día ya está cargado, así se ve de un
 * vistazo lo que falta sin abrir nada.
 */
function SelectorDeDia({
  dia,
  hoy,
  alElegir,
  cargadas,
  descansos,
}: {
  dia: FechaISO;
  hoy: FechaISO;
  alElegir: (f: FechaISO) => void;
  cargadas: Map<string, unknown>;
  descansos: ReadonlySet<FechaISO>;
}) {
  const ultimos = rangoDeFechas(sumarDias(hoy, -6), hoy);

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

      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
        {ultimos.map((fecha) => {
          const elegido = fecha === dia;
          const cargado = cargadas.has(fecha);
          const descanso = !cargado && descansos.has(fecha);
          return (
            <button
              key={fecha}
              type="button"
              onClick={() => alElegir(fecha)}
              aria-pressed={elegido}
              aria-label={`${nombreDelDia(fecha)} ${Number(fecha.slice(8))}${
                cargado ? ", cargado" : descanso ? ", descanso" : ""
              }`}
              className={`flex min-h-[58px] w-[52px] shrink-0 flex-col items-center justify-center gap-0.5 rounded-btn border text-xs ${
                elegido
                  ? "border-acento bg-acento text-acento-texto"
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
