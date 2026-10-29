"use client";

import { Flecha } from "@/components/iconos";

/** Cuatro puntos que se llenan: cuántos números lleva el PIN. */
export function PuntosDePin({ largo, error = false }: { largo: number; error?: boolean }) {
  return (
    <div className={`aju-pin ${error ? "aju-pin--err" : ""}`} role="img" aria-label={`${largo} de 4 números`}>
      {[0, 1, 2, 3].map((i) => (
        <i key={i} className={i < largo ? "on" : ""} />
      ))}
    </div>
  );
}

/** Teclado numérico grande, de 3 columnas, con «borrar» y un hueco extra (huella). */
export function TecladoPin({
  alTocar,
  alBorrar,
  deshabilitado = false,
  extra,
}: {
  alTocar: (digito: string) => void;
  alBorrar: () => void;
  deshabilitado?: boolean;
  extra?: React.ReactNode;
}) {
  return (
    <div className="aju-teclado">
      {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((n) => (
        <button key={n} type="button" disabled={deshabilitado} onClick={() => alTocar(n)}>
          {n}
        </button>
      ))}
      <button type="button" aria-label="Borrar" disabled={deshabilitado} onClick={alBorrar}>
        <Flecha className="size-6 rotate-180" />
      </button>
      <button type="button" disabled={deshabilitado} onClick={() => alTocar("0")}>
        0
      </button>
      {extra ?? <span />}
    </div>
  );
}
