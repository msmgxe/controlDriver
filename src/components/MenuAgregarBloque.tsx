"use client";

import { useState } from "react";

import { useCapa } from "@/hooks/useCapa";
import { Reloj, Suma, Taxi, Tienda } from "@/components/iconos";

/**
 * El botón flotante «+» de Inicio: al tocarlo se abre en abanico con las tres
 * cosas que se pueden agregar al día. El «+» gira a «×», las opciones salen una
 * tras otra y el resto de la pantalla se oscurece. Mientras está cerrado,
 * «respira» —un pulso lento— para que se note que invita a tocar.
 */
export function MenuAgregarBloque({
  disabled,
  onElegirTienda,
  onElegirApoyo,
  onElegirTaxi,
}: {
  disabled: boolean;
  onElegirTienda: () => void;
  onElegirApoyo: () => void;
  onElegirTaxi: () => void;
}) {
  const [abierto, setAbierto] = useState(false);

  function elegir(accion: () => void) {
    setAbierto(false);
    accion();
  }

  return (
    <>
      {abierto && <Abanico alCerrar={() => setAbierto(false)} />}
      {abierto && (
        <div className="fixed right-5 bottom-[calc(150px+env(safe-area-inset-bottom,0px))] z-[45] flex flex-col items-end gap-3 sm:bottom-24">
          <OpcionDelAbanico i={2} Icono={Taxi} texto="Taxi libre" color="#5b2bd6" onClick={() => elegir(onElegirTaxi)} />
          <OpcionDelAbanico i={1} Icono={Reloj} texto="Apoyo a otra tienda" color="#c99700" onClick={() => elegir(onElegirApoyo)} />
          <OpcionDelAbanico i={0} Icono={Tienda} texto="Pedidos de mi tienda" color="var(--acento)" onClick={() => elegir(onElegirTienda)} />
        </div>
      )}
      <button
        type="button"
        aria-label={abierto ? "Cerrar" : "Agregar al día"}
        aria-expanded={abierto}
        disabled={disabled}
        onClick={() => setAbierto((a) => !a)}
        className={`fixed right-5 bottom-[calc(84px+env(safe-area-inset-bottom,0px))] z-[46] grid size-14 place-items-center rounded-full bg-acento text-acento-texto shadow-alta transition-transform duration-300 active:scale-90 disabled:opacity-50 sm:bottom-6 ${
          abierto ? "rotate-45" : "respira"
        }`}
      >
        <Suma className="size-7" />
      </button>
    </>
  );
}

/** Aparte: `useCapa` (el botón «atrás» de Android) debe montarse solo mientras el abanico está abierto. */
function Abanico({ alCerrar }: { alCerrar: () => void }) {
  useCapa(alCerrar);
  return <div className="fixed inset-0 z-[44] bg-black/45" onClick={alCerrar} aria-hidden />;
}

function OpcionDelAbanico({
  i,
  Icono,
  texto,
  color,
  onClick,
}: {
  i: number;
  Icono: typeof Tienda;
  texto: string;
  color: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="abanico-item flex items-center gap-2.5 rounded-full bg-sup py-1.5 pr-4 pl-1.5 text-sm font-bold shadow-alta active:scale-95"
      style={{ "--i": i } as React.CSSProperties}
    >
      <span className="grid size-10 place-items-center rounded-full text-white" style={{ background: color }}>
        <Icono className="size-[19px]" />
      </span>
      {texto}
    </button>
  );
}
