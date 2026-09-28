"use client";

import { useTransition } from "react";

import { diasEntre, formatearFecha, hoyEnLima } from "@/lib/fechas";
import type { FilaLicencia } from "@/lib/licencia/repositorio";

import { salir } from "./acciones";

function estadoDe(fila: FilaLicencia, hoy: string): { texto: string; clase: string } {
  const diasRestantes = diasEntre(hoy, fila.vigenteHasta);
  if (diasRestantes >= 0) return { texto: "al día", clase: "text-bien" };
  if (diasRestantes >= -fila.diasDeGracia) return { texto: "en gracia", clase: "text-acento-tinta" };
  return { texto: "vencida", clase: "text-mal" };
}

export function TablaLicencias({ filas }: { filas: FilaLicencia[] }) {
  const hoy = hoyEnLima();
  const [pendiente, iniciar] = useTransition();

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-xs text-tinta-3">
          {filas.length} licencia{filas.length === 1 ? "" : "s"} registrada
          {filas.length === 1 ? "" : "s"} · se emiten desde la terminal, esto solo lee
        </span>
        <button
          type="button"
          className="boton-sec"
          disabled={pendiente}
          onClick={() => iniciar(() => salir())}
        >
          Salir
        </button>
      </div>

      {filas.length === 0 ? (
        <p className="tarjeta text-sm text-tinta-2">Todavía no has emitido ninguna licencia.</p>
      ) : (
        <div className="overflow-x-auto rounded-card border border-linea bg-sup">
          <table className="tabla min-w-[640px]">
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Código</th>
                <th>Vigente hasta</th>
                <th>Estado</th>
              </tr>
            </thead>
            <tbody>
              {filas.map((f) => {
                const estado = estadoDe(f, hoy);
                return (
                  <tr key={f.codigo}>
                    <td>
                      <b>{f.nombre}</b>
                    </td>
                    <td>
                      <span className="codigo">{f.codigo.slice(0, 8)}…</span>
                    </td>
                    <td className="whitespace-nowrap">{formatearFecha(f.vigenteHasta)}</td>
                    <td>
                      <span className={`text-xs font-semibold ${estado.clase}`}>{estado.texto}</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
