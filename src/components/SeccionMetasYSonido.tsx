"use client";

import { useState } from "react";

import { Acordeon } from "@/components/Acordeon";
import { Interruptor } from "@/components/Interruptor";
import { useDatos } from "@/hooks/useDatos";
import { guardarMetas, leerMetas, METAS_POR_DEFECTO } from "@/lib/db/sqlite/ajustes";
import { avisarDeCambios } from "@/lib/cambios";
import { activarSonidos, sonar, sonidosActivados } from "@/lib/sonidos";
import { formatearSoles } from "@/lib/pagos/reglas";

/**
 * Mis metas (la del día y la de la semana, que mueven la carretera de Pagos y el
 * velocímetro de Estadísticas) y los sonidos y la vibración de la app.
 */
export function SeccionMetasYSonido() {
  const { datos: metas, recargar } = useDatos(() => leerMetas(), [], { conservar: true });
  const [sonido, setSonido] = useState(sonidosActivados());

  return (
    <Acordeon
      titulo="Mis metas y sonidos"
      icono="meta"
      resumen={
        metas
          ? `Día ${formatearSoles(metas.diaCentimos)} · semana ${formatearSoles(metas.semanaCentimos)} · sonidos ${sonido ? "sí" : "no"}`
          : "…"
      }
    >
      <p className="text-sm text-tinta-2">
        Cuánto quieres ganar. La carretera de Pagos y el velocímetro de Estadísticas se llenan según estas metas.
      </p>
      {metas && <CamposDeMetas inicial={metas} alGuardar={() => { recargar(); avisarDeCambios(); }} />}

      <div className="border-t border-linea pt-3">
        <Interruptor
          titulo="Sonidos y vibración"
          detalle="Un «tin» al guardar, un sonido distinto para tienda, apoyo y taxi, y el motor del coche de la meta."
          activo={sonido}
          alCambiar={(v) => {
            activarSonidos(v);
            setSonido(v);
            if (v) sonar("moneda");
          }}
        />
      </div>
    </Acordeon>
  );
}

function CamposDeMetas({ inicial, alGuardar }: { inicial: { diaCentimos: number; semanaCentimos: number }; alGuardar: () => void }) {
  const [dia, setDia] = useState(String(inicial.diaCentimos / 100));
  const [semana, setSemana] = useState(String(inicial.semanaCentimos / 100));
  const [guardado, setGuardado] = useState(false);

  const aCentimos = (t: string, defecto: number) => {
    const n = Number(t.replace(",", "."));
    return n > 0 ? Math.round(n * 100) : defecto;
  };

  async function guardar() {
    await guardarMetas({
      diaCentimos: aCentimos(dia, METAS_POR_DEFECTO.diaCentimos),
      semanaCentimos: aCentimos(semana, METAS_POR_DEFECTO.semanaCentimos),
    });
    sonar("moneda");
    setGuardado(true);
    setTimeout(() => setGuardado(false), 2000);
    alGuardar();
  }

  const campo = "min-h-11 rounded-btn border border-linea-fuerte bg-sup px-3 text-base";
  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-2 gap-3">
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-semibold">Meta del día (S/)</span>
          <input inputMode="decimal" value={dia} onChange={(e) => setDia(e.target.value)} className={campo} />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-semibold">Meta de la semana (S/)</span>
          <input inputMode="decimal" value={semana} onChange={(e) => setSemana(e.target.value)} className={campo} />
        </label>
      </div>
      <button type="button" className="boton-secundario self-start" onClick={() => void guardar()}>
        {guardado ? "✓ Guardadas" : "Guardar metas"}
      </button>
    </div>
  );
}
