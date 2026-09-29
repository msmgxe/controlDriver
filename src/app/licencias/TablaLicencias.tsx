"use client";

import { useMemo, useState, useTransition } from "react";

import { diasEntre, formatearFecha, hoyEnLima } from "@/lib/fechas";
import type { FilaLicencia } from "@/lib/licencia/repositorio";

import { renovar, salir, type EstadoEmision } from "./acciones";

function estadoDe(fila: FilaLicencia, hoy: string): { texto: string; clase: string } {
  const diasRestantes = diasEntre(hoy, fila.vigenteHasta);
  if (diasRestantes >= 0) return { texto: "al día", clase: "text-bien" };
  if (diasRestantes >= -fila.diasDeGracia) return { texto: "en gracia", clase: "text-acento-tinta" };
  return { texto: "vencida", clase: "text-mal" };
}

export function TablaLicencias({ filas }: { filas: FilaLicencia[] }) {
  const hoy = hoyEnLima();
  const [pendiente, iniciar] = useTransition();
  const [renovando, setRenovando] = useState<string | null>(null);
  const [resultado, setResultado] = useState<EstadoEmision | null>(null);
  const [copiado, setCopiado] = useState(false);
  const [busqueda, setBusqueda] = useState("");

  const filtradas = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    if (!q) return filas;
    return filas.filter((f) => f.nombre.toLowerCase().includes(q) || f.codigo.toLowerCase().includes(q));
  }, [filas, busqueda]);

  function renovarUnMes(f: FilaLicencia) {
    setResultado(null);
    setRenovando(f.codigo);
    iniciar(async () => {
      const r = await renovar(f.codigo, f.nombre, "1");
      setResultado(r);
      setRenovando(null);
    });
  }

  async function copiar() {
    if (!resultado?.certificado) return;
    try {
      await navigator.clipboard.writeText(resultado.certificado);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    } catch {
      // Sin permiso de portapapeles: el texto sigue ahí, seleccionable a mano.
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-xs text-tinta-3">
          {filas.length} licencia{filas.length === 1 ? "" : "s"} registrada
          {filas.length === 1 ? "" : "s"}
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

      {resultado?.error && <p className="text-sm text-mal">{resultado.error}</p>}
      {resultado?.certificado && (
        <div className="flex flex-col gap-2 rounded-btn bg-bien-suave px-4 py-3">
          <p className="text-sm font-semibold text-bien">
            Renovada hasta el {formatearFecha(resultado.hasta!)}. Mándale esto por WhatsApp:
          </p>
          <textarea
            readOnly
            value={resultado.certificado}
            rows={3}
            className="rounded-btn border border-linea-fuerte bg-sup px-3 py-2 font-mono text-xs select-all"
          />
          <button type="button" className="boton-sec self-start" onClick={copiar}>
            {copiado ? "Copiado ✓" : "Copiar"}
          </button>
        </div>
      )}

      {filas.length === 0 ? (
        <p className="tarjeta text-sm text-tinta-2">Todavía no has emitido ninguna licencia.</p>
      ) : (
        <>
          <input
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar por nombre o código…"
            className="min-h-11 max-w-xs rounded-btn border border-linea-fuerte bg-sup px-3 text-sm"
          />
          <div className="overflow-x-auto rounded-card border border-linea bg-sup">
            <table className="tabla min-w-[720px]">
              <thead>
                <tr>
                  <th>Nombre</th>
                  <th>Código</th>
                  <th>Vigente hasta</th>
                  <th>Estado</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filtradas.map((f) => {
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
                      <td>
                        <button
                          type="button"
                          className="min-h-8 rounded-chip border border-linea-fuerte px-3 text-xs font-semibold whitespace-nowrap hover:bg-sup-2"
                          disabled={pendiente}
                          onClick={() => renovarUnMes(f)}
                        >
                          {renovando === f.codigo ? "Renovando…" : "Renovar 1 mes"}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {filtradas.length === 0 && (
            <p className="text-sm text-tinta-3">Nada con &quot;{busqueda}&quot;.</p>
          )}
        </>
      )}
    </div>
  );
}
