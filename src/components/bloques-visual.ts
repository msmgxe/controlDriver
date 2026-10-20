import { Reloj, Taxi, Tienda } from "@/components/iconos";
import type { BloqueExtraFila, TipoBloqueExtra } from "@/lib/db/tipos";

/** Cómo se ve cada tipo de bloque (apoyo por hora, apoyo por tramos, taxi), igual en todas las pantallas. */
export const ICONO_DE_BLOQUE: Record<TipoBloqueExtra, typeof Tienda> = {
  apoyo_hora: Reloj,
  apoyo_tramos: Tienda,
  taxi: Taxi,
};

export const FONDO_DE_BLOQUE: Record<TipoBloqueExtra, string> = {
  apoyo_hora: "bg-[var(--apoyo-suave)] text-[var(--apoyo-tinta)]",
  apoyo_tramos: "bg-acento-suave text-acento-tinta",
  taxi: "bg-[var(--taxi-suave)] text-[var(--taxi-tinta)]",
};

export function tituloYDetalleDeBloque(b: BloqueExtraFila): { titulo: string; detalle: string } {
  if (b.tipo === "apoyo_hora") {
    return { titulo: b.tiendaNombre || "Apoyo por hora", detalle: `${b.horas} h${b.motivo ? ` · ${b.motivo}` : ""}` };
  }
  if (b.tipo === "apoyo_tramos") {
    return { titulo: b.tiendaNombre || "Apoyo por tramos", detalle: `${b.pedidos.length} pedido${b.pedidos.length === 1 ? "" : "s"}` };
  }
  return {
    titulo: b.categoriaNombre ?? "Taxi",
    detalle: [b.descripcion, b.km ? `${b.km} km` : null].filter(Boolean).join(" · ") || "Adicional",
  };
}

/** «Apoyo», «Taxi»: la categoría con la que se suma en los desgloses. */
export function categoriaDeBloque(b: BloqueExtraFila): "apoyo" | "taxi" {
  return b.tipo === "taxi" ? "taxi" : "apoyo";
}
