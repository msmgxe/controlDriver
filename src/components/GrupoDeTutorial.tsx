"use client";

import { useState } from "react";

import { Barras, Cartera, Casa, Engranaje, Flecha } from "@/components/iconos";

/** El icono va por nombre y no como función: la página de Tutoriales es de servidor y no puede pasar funciones a un componente de cliente. */
const ICONOS = { casa: Casa, cartera: Cartera, barras: Barras, engranaje: Engranaje } as const;
export type IconoDeTutorial = keyof typeof ICONOS;

/**
 * Un grupo de tutoriales: una tarjeta grande de color con su figura. Al tocarla
 * se despliegan los temas del grupo (cada uno, un acordeón con sus pasos).
 */
export function GrupoDeTutorial({
  titulo,
  detalle,
  color,
  icono,
  indice,
  children,
}: {
  titulo: string;
  detalle: string;
  color: string;
  icono: IconoDeTutorial;
  indice: number;
  children: React.ReactNode;
}) {
  const [abierto, setAbierto] = useState(false);
  const Icono = ICONOS[icono];
  return (
    <section className="rise-v2 flex flex-col gap-3" style={{ animationDelay: `${indice * 0.06}s` }}>
      <button
        type="button"
        className="aju-tut"
        style={{ "--c": color } as React.CSSProperties}
        aria-expanded={abierto}
        onClick={() => setAbierto((v) => !v)}
      >
        <i className="aju-tut__c1" aria-hidden />
        <i className="aju-tut__c2" aria-hidden />
        <span className="aju-tut__fig" aria-hidden>
          <Icono className="size-8" />
        </span>
        <span className="min-w-0">
          <b>{titulo}</b>
          <small>{detalle}</small>
        </span>
        <Flecha className="aju-tut__chev size-5 shrink-0" />
      </button>
      {abierto && <div className="flex flex-col gap-3" style={{ "--tc": color } as React.CSSProperties}>{children}</div>}
    </section>
  );
}
