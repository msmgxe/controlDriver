"use client";

import { useEffect, useRef, useState } from "react";

import { Luna } from "@/components/iconos";
import { nombreDelDia, rangoDeFechas, sumarDias, type FechaISO } from "@/lib/fechas";

/**
 * La barra de semanas: siete días, y se arrastra para ir a otra semana.
 *
 * Está en Inicio (para elegir qué día se mira) y en Pagos (para elegir qué
 * semana se cobra). Es la misma pieza con dos caras: en Inicio cada día lleva
 * un punto si está cargado; en Pagos, lo que se cobró ese día.
 *
 * **Sin huecos.** La semana anterior y la siguiente ya están pegadas a los
 * lados, con el mismo espacio que hay entre día y día: al arrastrar, las
 * fechas corren con el dedo y las de la semana vecina van entrando. Antes la
 * semana salía por un lado y la nueva entraba por el otro, y en medio quedaba
 * un vacío. Al soltar, termina de llegar sola —a la semana de atrás o de
 * adelante, según hacia dónde iba el dedo— o vuelve si no se llegó a la mitad
 * de lo que hacía falta.
 *
 * No se puede pasar a una semana que todavía no llega: ahí la tira se estira
 * un tercio y vuelve, para que se sienta el tope sin que sea rígido.
 *
 * Mientras se arrastra se deja ver un poco de las semanas vecinas a los
 * costados (`clip-path`); en reposo, no: no hay que enseñar medio lunes de otra
 * semana pegado al borde.
 */

export interface DatosDelDia {
  cargado: boolean;
  descanso: boolean;
  /** Lo que se cobró ese día, para la cara de Pagos. */
  centimos?: number;
}

/** Cuánto hay que arrastrar, en píxeles, para que cuente como "cambiar de semana" y no como un toque que tembló. */
const UMBRAL_ARRASTRE = 6;
/** La separación entre días, y entre semanas: la misma, para que no haya hueco. */
const HUECO_PX = 6;

export function TiraDeSemanas({
  semana,
  dia,
  hoy,
  modo,
  datos,
  alElegirDia,
  alMoverSemana,
}: {
  /** El lunes de la semana que se enseña. */
  semana: FechaISO;
  /** El día elegido; en Pagos puede no haber ninguno. */
  dia: FechaISO | null;
  hoy: FechaISO;
  modo: "inicio" | "pagos";
  /** Lo que se sabe de cada día de las tres semanas visibles. */
  datos: ReadonlyMap<FechaISO, DatosDelDia>;
  alElegirDia: (fecha: FechaISO) => void;
  alMoverSemana: (delta: -1 | 1) => void;
}) {
  const marcoRef = useRef<HTMLDivElement>(null);
  const [desplazamiento, setDesplazamiento] = useState(0);
  const [animando, setAnimando] = useState(false);
  const [arrastrando, setArrastrando] = useState(false);
  // Refs, no estado: cambian en cada milímetro de arrastre.
  const arrastre = useRef<{ id: number; x0: number; xUltima: number; tUltima: number; v: number; movio: boolean; ancho: number } | null>(null);
  const pendiente = useRef<-1 | 0 | 1>(0);
  const plazo = useRef<ReturnType<typeof setTimeout> | null>(null);

  const puedeSiguiente = sumarDias(semana, 7) <= hoy;

  useEffect(() => () => {
    if (plazo.current) clearTimeout(plazo.current);
  }, []);

  function terminar() {
    if (plazo.current) clearTimeout(plazo.current);
    const direccion = pendiente.current;
    pendiente.current = 0;
    setAnimando(false);
    setArrastrando(false);
    setDesplazamiento(0);
    if (direccion !== 0) alMoverSemana(direccion);
  }

  function empezar(e: React.PointerEvent<HTMLDivElement>) {
    if ((e.pointerType === "mouse" && e.button !== 0) || pendiente.current !== 0) return;
    arrastre.current = {
      id: e.pointerId,
      x0: e.clientX,
      xUltima: e.clientX,
      tUltima: performance.now(),
      v: 0,
      movio: false,
      ancho: marcoRef.current?.clientWidth ?? 320,
    };
    setAnimando(false);
  }

  function mover(e: React.PointerEvent<HTMLDivElement>) {
    const a = arrastre.current;
    if (!a || a.id !== e.pointerId) return;
    let delta = e.clientX - a.x0;
    if (!a.movio) {
      if (Math.abs(delta) < UMBRAL_ARRASTRE) return;
      a.movio = true;
      setArrastrando(true);
      /* Recién ahora, que de verdad es un arrastre y no un toque, se captura
         el puntero. Capturarlo desde el primer toque desviaba el click entero
         hacia este contenedor, y el día tocado dejaba de elegirse. */
      e.currentTarget.setPointerCapture(e.pointerId);
    }
    const ahora = performance.now();
    // Velocidad suavizada, en px/ms: decide si un arrastre corto pero rápido cuenta.
    a.v = ((e.clientX - a.xUltima) / Math.max(1, ahora - a.tUltima)) * 0.6 + a.v * 0.4;
    a.xUltima = e.clientX;
    a.tUltima = ahora;
    if (delta < 0 && !puedeSiguiente) delta /= 3;
    setDesplazamiento(delta);
  }

  function soltar(e: React.PointerEvent<HTMLDivElement>) {
    const a = arrastre.current;
    if (!a || a.id !== e.pointerId) return;
    arrastre.current = null;
    if (!a.movio) return;

    const delta = e.clientX - a.x0;
    // Hacia dónde iba el dedo: donde estaría 150 ms después de soltar.
    const proyectado = delta + a.v * 150;
    let direccion: -1 | 0 | 1 = 0;
    if (proyectado < -a.ancho * 0.28 && puedeSiguiente) direccion = 1;
    else if (proyectado > a.ancho * 0.28) direccion = -1;

    pendiente.current = direccion;
    setAnimando(true);
    setDesplazamiento(direccion === 1 ? -(a.ancho + HUECO_PX) : direccion === -1 ? a.ancho + HUECO_PX : 0);
    // Por si el navegador no avisa del final de la transición (movimiento reducido).
    plazo.current = setTimeout(terminar, 420);
  }

  const semanas = [sumarDias(semana, -7), semana, sumarDias(semana, 7)];

  return (
    <div
      ref={marcoRef}
      className="touch-pan-y select-none"
      style={{ clipPath: arrastrando ? "inset(-4px -16px)" : "inset(-4px 0)" }}
      onPointerDown={empezar}
      onPointerMove={mover}
      onPointerUp={soltar}
      onPointerCancel={soltar}
    >
      <div
        className="flex"
        style={{
          gap: HUECO_PX,
          transform: `translateX(calc(-100% - ${HUECO_PX}px + ${desplazamiento}px))`,
          transition: animando ? "transform 0.32s cubic-bezier(0.2, 0.8, 0.2, 1)" : "none",
          willChange: "transform",
        }}
        onTransitionEnd={(e) => {
          if (e.target === e.currentTarget && e.propertyName === "transform" && animando) terminar();
        }}
      >
        {semanas.map((lunes, i) => (
          <div
            key={lunes}
            // Las vecinas se ven al arrastrar, pero no se tocan ni se tabulan.
            inert={i !== 1}
            className="grid shrink-0 grid-cols-7"
            style={{ flexBasis: "100%", gap: HUECO_PX }}
          >
            {rangoDeFechas(lunes, sumarDias(lunes, 6)).map((fecha) => (
              <Ficha
                key={fecha}
                fecha={fecha}
                hoy={hoy}
                modo={modo}
                elegido={fecha === dia}
                datos={datos.get(fecha)}
                alElegir={() => {
                  // Un arrastre no debe, además, elegir el día que haya quedado bajo el dedo.
                  if (!arrastrando) alElegirDia(fecha);
                }}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

function Ficha({
  fecha,
  hoy,
  modo,
  elegido,
  datos,
  alElegir,
}: {
  fecha: FechaISO;
  hoy: FechaISO;
  modo: "inicio" | "pagos";
  elegido: boolean;
  datos: DatosDelDia | undefined;
  alElegir: () => void;
}) {
  const futuro = fecha > hoy;
  const cargado = datos?.cargado ?? false;
  const descanso = datos?.descanso ?? false;
  const nombre = nombreDelDia(fecha).slice(0, 3);

  /* Ningún estado depende solo del color: el punto, el número y la luna dicen
     lo mismo con la forma, y el `aria-label` lo dice con palabras. */
  let marca: React.ReactNode = null;
  if (descanso && !cargado) {
    marca = <Luna className="size-3" aria-hidden />;
  } else if (cargado) {
    marca =
      modo === "inicio" ? (
        <i aria-hidden className={`size-[7px] rounded-full ${elegido ? "bg-acento-texto" : "bg-acento"}`} />
      ) : (
        <span className="font-mono text-[10px] font-bold">{Math.round((datos?.centimos ?? 0) / 100)}</span>
      );
  } else if (!futuro) {
    // Un día pasado sin carga ni descanso: falta subirlo.
    marca =
      modo === "inicio" ? (
        <i
          aria-hidden
          className={`size-[7px] rounded-full border-[1.6px] ${elegido ? "border-acento-texto" : "border-tinta-3"}`}
        />
      ) : (
        <span className="font-mono text-[10px]">–</span>
      );
  }

  return (
    <button
      type="button"
      onClick={alElegir}
      aria-pressed={elegido}
      aria-label={`${nombre} ${Number(fecha.slice(8))}${cargado ? ", cargado" : descanso ? ", descanso" : futuro ? "" : ", sin cargar"}`}
      className={`flex min-h-[66px] min-w-0 flex-col items-center justify-center gap-px rounded-btn border text-[11.5px] ${
        elegido
          ? "border-acento bg-acento text-acento-texto"
          : fecha === hoy
            ? "border-acento bg-sup-2 text-acento-tinta"
            : "border-linea bg-sup-2 text-tinta-2"
      } ${futuro && !elegido ? "opacity-45" : ""}`}
    >
      <span className="font-bold capitalize">{nombre}</span>
      <b className={`text-base leading-tight font-extrabold ${elegido ? "" : "text-tinta"}`}>{fecha.slice(8)}</b>
      <span className="grid h-3.5 place-items-center">{marca}</span>
    </button>
  );
}
