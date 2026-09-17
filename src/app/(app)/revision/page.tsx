"use client";

import dynamic from "next/dynamic";

/**
 * Revisión (§4.7).
 *
 * El contenido se carga solo en el navegador (`ssr: false`) porque los datos de
 * la carga viven en `sessionStorage`: son catorce pedidos con sus códigos, y no
 * queremos códigos de pedido viajando por la URL ni apareciendo en los registros
 * del servidor (§7). Renderizar en servidor algo que solo existe en el cliente
 * obligaría a sincronizarlo con un efecto, que es justo lo que se evita así.
 */
const Contenido = dynamic(() => import("./Contenido").then((m) => m.Contenido), {
  ssr: false,
  loading: () => <p className="py-10 text-center text-sm text-tinta-3">Cargando la revisión…</p>,
});

export default function PaginaRevision() {
  return <Contenido />;
}
