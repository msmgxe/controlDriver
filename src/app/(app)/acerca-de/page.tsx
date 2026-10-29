"use client";

import { useState } from "react";

import { Auto } from "@/components/Auto";
import { IconoApp } from "@/components/IconoApp";
import { Telefono } from "@/components/iconos";
import { LineaCopyright } from "@/components/TextoLegal";
import { useVersion } from "@/hooks/useVersion";

/**
 * Acerca de: quién hizo la app, qué versión es, y cómo contactar. Una escena
 * con el auto en marcha, la versión y dos botones: llamar y copiar el número.
 */
export default function PaginaAcercaDe() {
  const datos = useVersion();
  const [copiado, setCopiado] = useState(false);

  async function copiar() {
    try {
      await navigator.clipboard.writeText("984368710");
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    } catch {
      setCopiado(false);
    }
  }

  return (
    <div className="aju-cent mx-auto max-w-[420px] px-1 py-4">
      <div className="aju-escena rise-v2 w-full">
        <svg className="fondo" viewBox="0 0 340 190" role="img" aria-label="Un auto recorre la calle">
          <circle cx="270" cy="44" r="22" style={{ fill: "var(--c-taxi)" }} />
          <g style={{ fill: "var(--sup)" }}>
            <rect x="24" y="70" width="46" height="70" rx="6" />
            <rect x="78" y="48" width="56" height="92" rx="6" />
            <rect x="142" y="82" width="40" height="58" rx="6" />
            <rect x="200" y="58" width="52" height="82" rx="6" />
          </g>
          <g style={{ fill: "var(--acento)" }} opacity=".35">
            <rect x="34" y="82" width="10" height="10" />
            <rect x="50" y="82" width="10" height="10" />
            <rect x="90" y="62" width="10" height="10" />
            <rect x="108" y="62" width="10" height="10" />
            <rect x="212" y="72" width="10" height="10" />
            <rect x="230" y="72" width="10" height="10" />
          </g>
          <rect y="140" width="340" height="50" style={{ fill: "var(--tinta-2)" }} />
          <path className="aju-via" d="M0 168H340" stroke="#fff" strokeWidth="4" fill="none" />
        </svg>
        <Auto vehiculo="auto" animado className="aju-auto" />
      </div>

      <IconoApp className="-mt-10 size-16 shrink-0 rounded-2xl" />
      <div>
        <h2 className="font-display text-2xl font-bold">Control Driver</h2>
        <p className="mt-2 inline-block rounded-full bg-acento-suave px-4 py-1.5 text-sm font-bold text-acento-tinta">
          {datos ? `Versión ${datos.version} · v${datos.build}` : "…"}
        </p>
      </div>

      <div className="flex w-full flex-col gap-2.5">
        <a
          href="tel:+51984368710"
          className="boton-accion"
          style={{ "--c": "var(--c-cantidad)" } as React.CSSProperties}
        >
          <Telefono className="size-5" />
          Llamar al 984 368 710
        </a>
        <button type="button" onClick={() => void copiar()} className="boton-sec w-full">
          {copiado ? "Copiado ✓" : "Copiar el número"}
        </button>
      </div>

      <LineaCopyright className="text-sm text-tinta-2" />
    </div>
  );
}
