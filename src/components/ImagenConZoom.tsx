"use client";

import { useRef, useState } from "react";

/**
 * Una imagen que se puede acercar: pellizco con dos dedos, doble toque para
 * alternar 1× / 2.5×, y arrastre cuando está ampliada.
 */
export function ImagenConZoom({ src, alt }: { src: string; alt: string }) {
  const [t, setT] = useState({ s: 1, x: 0, y: 0 });
  const punteros = useRef(new Map<number, { x: number; y: number }>());
  const base = useRef<{ d: number; s: number } | null>(null);
  const ultimoToque = useRef(0);
  const [tocando, setTocando] = useState(false);

  const acotar = (s: number, x: number, y: number) => {
    const lim = ((s - 1) * 300) / 1; // margen razonable de desplazamiento
    return { s, x: s <= 1 ? 0 : Math.max(-lim, Math.min(lim, x)), y: s <= 1 ? 0 : Math.max(-lim, Math.min(lim, y)) };
  };

  return (
    <div
      data-sin-deslizar
      className="flex max-h-[80dvh] w-full touch-none items-center justify-center overflow-hidden"
      onClick={(e) => e.stopPropagation()}
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture(e.pointerId);
        punteros.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
        setTocando(true);
        if (punteros.current.size === 2) {
          const [a, b] = [...punteros.current.values()];
          base.current = { d: Math.hypot(a.x - b.x, a.y - b.y), s: t.s };
        } else {
          const ahora = Date.now();
          if (ahora - ultimoToque.current < 300) setT((v) => (v.s > 1 ? { s: 1, x: 0, y: 0 } : { s: 2.5, x: 0, y: 0 }));
          ultimoToque.current = ahora;
        }
      }}
      onPointerMove={(e) => {
        const previo = punteros.current.get(e.pointerId);
        if (!previo) return;
        const nuevo = { x: e.clientX, y: e.clientY };
        punteros.current.set(e.pointerId, nuevo);
        if (punteros.current.size === 2 && base.current) {
          const [a, b] = [...punteros.current.values()];
          const d = Math.hypot(a.x - b.x, a.y - b.y);
          const s = Math.max(1, Math.min(6, (base.current.s * d) / Math.max(1, base.current.d)));
          setT((v) => acotar(s, v.x, v.y));
        } else if (punteros.current.size === 1 && t.s > 1) {
          setT((v) => acotar(v.s, v.x + nuevo.x - previo.x, v.y + nuevo.y - previo.y));
        }
      }}
      onPointerUp={(e) => {
        punteros.current.delete(e.pointerId);
        base.current = null;
        if (punteros.current.size === 0) setTocando(false);
      }}
      onPointerCancel={(e) => {
        punteros.current.delete(e.pointerId);
        base.current = null;
        if (punteros.current.size === 0) setTocando(false);
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- imagen local */}
      <img
        src={src}
        alt={alt}
        draggable={false}
        className="max-h-[80dvh] max-w-full rounded-btn object-contain select-none"
        style={{ transform: `translate(${t.x}px, ${t.y}px) scale(${t.s})`, transition: tocando ? "none" : "transform .2s" }}
      />
    </div>
  );
}
