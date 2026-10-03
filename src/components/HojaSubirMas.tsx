"use client";

import { Equis } from "@/components/iconos";
import { useCapa } from "@/hooks/useCapa";

/** «Subir más» como hoja: el contenido de siempre (`SubirMas`), que ahora se abre desde «Pedidos de mi tienda». */
export function HojaSubirMas({
  titulo,
  alCerrar,
  children,
}: {
  titulo: string;
  alCerrar: () => void;
  children: React.ReactNode;
}) {
  useCapa(alCerrar);
  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center sm:p-5"
      onClick={(e) => {
        if (e.target === e.currentTarget) alCerrar();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={titulo}
        className="flex max-h-[92dvh] w-full max-w-md flex-col gap-3 overflow-y-auto rounded-t-hoja bg-sup px-4 pt-3 pb-[calc(1rem+env(safe-area-inset-bottom,0px))] shadow-alta sm:rounded-hoja"
      >
        <span className="mx-auto h-1 w-9 shrink-0 rounded-full bg-linea-fuerte sm:hidden" />
        <div className="flex items-start justify-between gap-3">
          <h3 className="text-xl leading-tight">{titulo}</h3>
          <button type="button" onClick={alCerrar} aria-label="Cerrar" className="grid size-11 shrink-0 place-items-center rounded-full bg-sup-2">
            <Equis className="size-5" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
