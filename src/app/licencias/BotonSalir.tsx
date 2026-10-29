"use client";

import { useTransition } from "react";

import { salir } from "./acciones";

export function BotonSalir() {
  const [pendiente, iniciar] = useTransition();
  return (
    <button type="button" className="lic-btn ml-auto" data-t="suave" disabled={pendiente} onClick={() => iniciar(() => salir())}>
      Salir
    </button>
  );
}
