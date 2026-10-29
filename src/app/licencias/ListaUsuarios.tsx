"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import { formatearFecha } from "@/lib/fechas";
import { ETIQUETA_ESTADO, textoVence, type EstadoPanel } from "@/lib/licencia/panel";

export interface FilaLista {
  codigo: string;
  nombre: string;
  vigenteHasta: string;
  estado: EstadoPanel;
  restantes: number;
  /** Ya formateado (S/ 45.00), porque se calcula en el servidor. */
  totalTexto: string;
}

const FILTROS: { clave: "todos" | EstadoPanel; texto: string }[] = [
  { clave: "todos", texto: "Todos" },
  { clave: "al_dia", texto: "Al día" },
  { clave: "por_vencer", texto: "Por vencer" },
  { clave: "gracia", texto: "En gracia" },
  { clave: "vencido", texto: "Vencidos" },
];

export function ListaUsuarios({ filas }: { filas: FilaLista[] }) {
  const [busqueda, setBusqueda] = useState("");
  const [filtro, setFiltro] = useState<"todos" | EstadoPanel>("todos");

  const visibles = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    return filas.filter(
      (f) =>
        (filtro === "todos" || f.estado === filtro) &&
        (!q || f.nombre.toLowerCase().includes(q) || f.codigo.toLowerCase().includes(q)),
    );
  }, [filas, busqueda, filtro]);

  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-lg font-semibold">Usuarios</h2>
      <input
        type="search"
        value={busqueda}
        onChange={(e) => setBusqueda(e.target.value)}
        placeholder="Buscar por nombre o código…"
        aria-label="Buscar usuario"
        className="min-h-12 rounded-btn border border-linea-fuerte bg-sup px-3 text-base"
      />
      <div className="lic-filtros" role="group" aria-label="Filtrar por estado">
        {FILTROS.map((f) => (
          <button
            key={f.clave}
            type="button"
            className="lic-filtro"
            data-e={f.clave}
            aria-pressed={filtro === f.clave}
            onClick={() => setFiltro(f.clave)}
          >
            {f.texto}
          </button>
        ))}
      </div>
      {filas.length === 0 ? (
        <p className="tarjeta text-sm text-tinta-2">Todavía no has emitido ninguna licencia.</p>
      ) : visibles.length === 0 ? (
        <p className="text-sm text-tinta-3">Nadie coincide con ese filtro.</p>
      ) : (
        <div className="overflow-hidden rounded-card border border-linea bg-sup">
          {visibles.map((f) => (
            <Link key={f.codigo} href={`/licencias/${f.codigo}`} className="lic-fila">
              <div className="min-w-0">
                <div className="lic-fila-n">{f.nombre}</div>
                <div className="lic-fila-s">
                  <span className="codigo">…{f.codigo.slice(-4)}</span> · {textoVence(f.restantes)} ({formatearFecha(f.vigenteHasta)})
                </div>
              </div>
              <div className="lic-fila-der">
                <span className="lic-pildora" data-e={f.estado}>
                  {ETIQUETA_ESTADO[f.estado]}
                </span>
                <span className="monto text-sm">{f.totalTexto}</span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}
