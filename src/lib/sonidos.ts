"use client";

/**
 * Sonidos y vibración de la app, **sintetizados al momento** (Web Audio): no hay
 * archivos de audio, así que no pesan y funcionan sin internet.
 *
 * Cada gráfico tiene su sonido, para que se oiga lo que se ve:
 *   · `tienda`, `apoyo`, `taxi` — al tocar su color, uno distinto cada uno;
 *   · `moneda` — al guardar algo, el «tin» de una moneda;
 *   · `motor` y `bocina` — el coche de la meta que arranca y llega;
 *   · `acelerar` — la aguja del velocímetro que sube;
 *   · `barrido` — el cursor de la línea de horas que recorre el día;
 *   · `toque` — el clic suave de un icono de Ajustes.
 *
 * Se pueden apagar en Ajustes. Hasta el primer toque la página no deja sonar
 * nada (regla del navegador), así que antes de eso simplemente no suena.
 */

const CLAVE = "cd.sonidos";

export function sonidosActivados(): boolean {
  try {
    return localStorage.getItem(CLAVE) !== "0";
  } catch {
    return true;
  }
}

export function activarSonidos(activo: boolean): void {
  try {
    localStorage.setItem(CLAVE, activo ? "1" : "0");
  } catch {
    /* sin almacenamiento: queda como estaba */
  }
}

let contexto: AudioContext | null = null;

function ctx(): AudioContext | null {
  if (!sonidosActivados()) return null;
  try {
    if (!contexto) {
      const Constructor =
        window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Constructor) return null;
      contexto = new Constructor();
    }
    if (contexto.state === "suspended") void contexto.resume();
    return contexto;
  } catch {
    return null;
  }
}

function nota(f: number, t0: number, dur: number, tipo: OscillatorType = "sine", vol = 0.16, f2?: number) {
  const a = ctx();
  if (!a) return;
  const o = a.createOscillator();
  const g = a.createGain();
  const t = a.currentTime + t0;
  o.type = tipo;
  o.frequency.setValueAtTime(f, t);
  if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + 0.015);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(a.destination);
  o.start(t);
  o.stop(t + dur + 0.05);
}

function ruido(t0: number, dur: number, f0: number, f1: number, vol = 0.1) {
  const a = ctx();
  if (!a) return;
  const largo = Math.max(1, Math.floor(a.sampleRate * dur));
  const buffer = a.createBuffer(1, largo, a.sampleRate);
  const datos = buffer.getChannelData(0);
  for (let i = 0; i < largo; i++) datos[i] = Math.random() * 2 - 1;
  const fuente = a.createBufferSource();
  fuente.buffer = buffer;
  const filtro = a.createBiquadFilter();
  filtro.type = "bandpass";
  filtro.Q.value = 2;
  const t = a.currentTime + t0;
  filtro.frequency.setValueAtTime(f0, t);
  filtro.frequency.exponentialRampToValueAtTime(f1, t + dur);
  const g = a.createGain();
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  fuente.connect(filtro).connect(g).connect(a.destination);
  fuente.start(t);
}

const SONIDOS = {
  tienda: () => {
    nota(523, 0, 0.18, "triangle", 0.18);
    nota(784, 0.07, 0.22, "triangle", 0.14);
  },
  apoyo: () => {
    nota(440, 0, 0.14, "sine", 0.18);
    nota(554, 0.1, 0.14, "sine", 0.16);
    nota(659, 0.2, 0.3, "sine", 0.14);
  },
  taxi: () => {
    nota(196, 0, 0.2, "sawtooth", 0.06, 330);
    nota(330, 0.16, 0.22, "sawtooth", 0.05);
  },
  moneda: () => {
    nota(988, 0, 0.09, "square", 0.06);
    nota(1319, 0.08, 0.28, "square", 0.06);
  },
  motor: () => {
    nota(90, 0, 0.9, "sawtooth", 0.05, 170);
    ruido(0, 0.8, 150, 600, 0.05);
  },
  bocina: () => {
    nota(392, 0, 0.3, "square", 0.045);
    nota(494, 0, 0.3, "square", 0.045);
  },
  acelerar: () => {
    nota(180, 0, 1.4, "sawtooth", 0.045, 520);
    ruido(0, 1.2, 200, 1800, 0.05);
  },
  barrido: () => ruido(0, 0.7, 300, 2400, 0.1),
  toque: () => nota(660, 0, 0.08, "sine", 0.12, 990),
  acorde: () => {
    [523, 659, 784, 1047].forEach((f, i) => nota(f, i * 0.09, 0.5, "sine", 0.12));
  },
} as const;

export type NombreDeSonido = keyof typeof SONIDOS;

/** Suena `nombre`, y vibra un instante si el teléfono puede. Nunca lanza. */
export function sonar(nombre: NombreDeSonido, vibrar = true): void {
  try {
    if (!sonidosActivados()) return;
    SONIDOS[nombre]();
    if (vibrar && typeof navigator !== "undefined" && "vibrate" in navigator) navigator.vibrate(12);
  } catch {
    /* un sonido que falla no debe romper nada */
  }
}
