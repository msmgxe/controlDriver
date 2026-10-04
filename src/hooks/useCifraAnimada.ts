"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Un número que **corre** hasta su valor nuevo en vez de cambiar de golpe: al
 * abrir la pantalla sube desde cero; si después cambia (se guardó un pedido),
 * sigue desde donde estaba. Con «reducir movimiento» salta directo.
 */
export function useCifraAnimada(objetivo: number, ms = 1100): number {
  const [valor, setValor] = useState(0);
  const desde = useRef(0);

  useEffect(() => {
    const reducir = typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reducir) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- sin animación: se salta al valor.
      setValor(objetivo);
      desde.current = objetivo;
      return;
    }
    const inicio = desde.current;
    const t0 = performance.now();
    let cuadro = 0;
    const paso = (t: number) => {
      const p = Math.min(1, (t - t0) / ms);
      const e = 1 - Math.pow(1 - p, 3);
      const v = inicio + (objetivo - inicio) * e;
      desde.current = v;
      setValor(v);
      if (p < 1) cuadro = requestAnimationFrame(paso);
    };
    cuadro = requestAnimationFrame(paso);
    return () => cancelAnimationFrame(cuadro);
  }, [objetivo, ms]);

  return valor;
}
