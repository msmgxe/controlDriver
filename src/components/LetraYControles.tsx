"use client";

import { Pestanas } from "@/components/Pestanas";
import { useVisual } from "@/components/Apariencia";
import { Check, Tienda } from "@/components/iconos";
import { VISUAL_DEFECTO, type Letra, type Visual } from "@/lib/apariencia";

/**
 * «Letra y controles»: cómo se lee y cómo se toca la app. Cada cambio se aplica
 * al instante a toda la app (ver `useVisual`), y la vista previa de arriba es un
 * mini Inicio hecho con las mismas clases reales, así que reacciona sola.
 */
const LETRAS: Array<{ valor: Letra; nombre: string; clase: string }> = [
  { valor: "tema", nombre: "La de cada cara", clase: "" },
  { valor: "redondeada", nombre: "Redondeada", clase: "aju-f-redondeada" },
  { valor: "clasica", nombre: "Clásica", clase: "aju-f-clasica" },
  { valor: "moderna", nombre: "Moderna", clase: "aju-f-moderna" },
  { valor: "condensada", nombre: "Condensada", clase: "aju-f-condensada" },
  { valor: "amigable", nombre: "Amigable", clase: "aju-f-amigable" },
  { valor: "legible", nombre: "Muy legible", clase: "aju-f-legible" },
];

export function LetraYControles() {
  const { visual, cambiar } = useVisual();
  const defecto = (Object.keys(VISUAL_DEFECTO) as Array<keyof Visual>).every((k) => visual[k] === VISUAL_DEFECTO[k]);

  return (
    <div className="flex flex-col gap-4 border-t border-linea pt-4">
      <div>
        <h4 className="aju-sub">Letra y controles</h4>
        <p className="text-sm text-tinta-2">Pruébalo aquí: se aplica de inmediato en toda la app.</p>
      </div>

      {/* Mini Inicio con las clases reales: reacciona al instante. */}
      <div className="aju-prev" role="img" aria-label="Vista previa de Inicio con tus ajustes">
        <div className="aju-prev__tile">
          <span className="grid size-10 place-items-center rounded-[14px] bg-white/25">
            <Tienda className="size-6" />
          </span>
          <span>
            <b className="block font-display text-[1.06rem] leading-tight font-semibold">Pedidos de mi tienda</b>
            <small className="text-[0.78rem] font-semibold opacity-90">12 pedidos hoy</small>
          </span>
        </div>
        <div className="aju-prev__fila">
          <span className="fig-color" style={{ "--c": "var(--c-pagos)" } as React.CSSProperties}>
            <Check className="size-6" />
          </span>
          <span className="min-w-0">
            <b className="block leading-tight">Ruta de las 17:00</b>
            <small className="text-tinta-2">4 pedidos</small>
          </span>
          <b className="ml-auto font-display">S/ 38.00</b>
        </div>
        <div className="boton-accion" style={{ "--c": "var(--c-comanda)" } as React.CSSProperties}>
          Leer una comanda
        </div>
        <span className="aju-prev__chip">Meta del día 80%</span>
      </div>

      <div className="flex flex-col gap-2">
        <b className="text-sm">Tipo de letra</b>
        <div role="radiogroup" aria-label="Tipo de letra" className="aju-opc">
          {LETRAS.map((l) => (
            <button
              key={l.valor}
              type="button"
              role="radio"
              aria-checked={visual.letra === l.valor}
              className={l.clase}
              onClick={() => cambiar({ letra: l.valor })}
            >
              {l.nombre}
            </button>
          ))}
        </div>
      </div>

      <Grupo titulo="Tamaño de letra">
        <Pestanas
          etiqueta="Tamaño de letra"
          actual={visual.tamano}
          alCambiar={(id) => cambiar({ tamano: id as Visual["tamano"] })}
          items={[
            { id: "normal", etiqueta: "Normal" },
            { id: "grande", etiqueta: "Grande" },
            { id: "muy-grande", etiqueta: "Muy grande" },
          ]}
        />
      </Grupo>
      <Grupo titulo="Botones">
        <Pestanas
          etiqueta="Botones"
          actual={visual.botones}
          alCambiar={(id) => cambiar({ botones: id as Visual["botones"] })}
          items={[
            { id: "relieve", etiqueta: "Con relieve" },
            { id: "plano", etiqueta: "Planos" },
          ]}
        />
      </Grupo>
      <Grupo titulo="Toques">
        <Pestanas
          etiqueta="Toques"
          actual={visual.toques}
          alCambiar={(id) => cambiar({ toques: id as Visual["toques"] })}
          items={[
            { id: "comodo", etiqueta: "Cómodos" },
            { id: "compacto", etiqueta: "Compactos" },
          ]}
        />
      </Grupo>
      <Grupo titulo="Animaciones">
        <Pestanas
          etiqueta="Animaciones"
          actual={visual.anim}
          alCambiar={(id) => cambiar({ anim: id as Visual["anim"] })}
          items={[
            { id: "completa", etiqueta: "Completas" },
            { id: "reducida", etiqueta: "Reducidas" },
          ]}
        />
      </Grupo>

      <button type="button" className="boton-sec" disabled={defecto} onClick={() => cambiar({ ...VISUAL_DEFECTO })}>
        Volver a lo de fábrica
      </button>
    </div>
  );
}

function Grupo({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <b className="text-sm">{titulo}</b>
      {children}
    </div>
  );
}
