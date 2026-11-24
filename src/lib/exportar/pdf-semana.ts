import { formatearFecha, nombreDelDia } from "@/lib/fechas";
import { formatearSoles } from "@/lib/pagos/reglas";

import type { DatosDeSemana } from "./semana";

/**
 * PDF de pagos de una semana, pensado para mandarlo por WhatsApp.
 *
 * A4 vertical y sobrio: cada pedido con su día, ruta, código, destino y origen;
 * un subtotal por día; el total de la semana; y, si se cotejó con la lista de la
 * empresa, una columna «Empresa» que dice **Sí** o **NO FIGURA**, con los que no
 * figuran en rojo y juntos al final, con su monto, para poder reclamarlos.
 *
 * `soloNoFiguran` deja en la tabla únicamente esos pedidos: es el papel corto que
 * se manda a quien paga cuando solo importa lo que falta.
 */
export async function generarPdfSemana(datos: DatosDeSemana, opciones: { soloNoFiguran?: boolean } = {}): Promise<Blob> {
  const { jsPDF } = await import("jspdf");
  const autoTabla = (await import("jspdf-autotable")).default;

  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const ancho = doc.internal.pageSize.getWidth();
  const t = datos.totales;
  const solo = Boolean(opciones.soloNoFiguran) && datos.cotejado;

  /* ----------------------------- encabezado ----------------------------- */
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text("Control Driver", 14, 18);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  if (datos.conductor) doc.text(datos.conductor, 14, 25);
  if (datos.tienda) doc.text(datos.tienda, 14, 30);
  doc.setFontSize(9);
  doc.text(`Pagos del ${formatearFecha(datos.desde)} al ${formatearFecha(datos.hasta)}`, ancho - 14, 18, { align: "right" });
  doc.text(`Generado el ${formatearFecha(new Date().toISOString().slice(0, 10) as never)}`, ancho - 14, 23, { align: "right" });
  doc.text(`${t.pedidos} pedidos · ${datos.dias.length} días`, ancho - 14, 28, { align: "right" });

  /* Cuadro del cotejo con la empresa. */
  const y = 37;
  doc.setFontSize(9);
  if (datos.cotejado) {
    doc.setFont("helvetica", "bold");
    doc.text(`Cotejo con el reporte de la empresa: ${t.contados} figuran (${formatearSoles(t.contadosCentimos)}) · ${t.noFiguran} NO figuran (${formatearSoles(t.noFiguranCentimos)})`, 14, y);
  } else {
    doc.setFont("helvetica", "italic");
    doc.text("Todavía no se cotejó con el reporte de la empresa.", 14, y);
  }
  doc.setFont("helvetica", "normal");

  /* -------------------------------- tabla ------------------------------- */
  const ROJO: [number, number, number] = [185, 28, 28];
  const FONDO_ROJO: [number, number, number] = [254, 226, 226];
  const FONDO_DIA: [number, number, number] = [240, 240, 240];

  const filas: Array<Array<string | number | Record<string, unknown>>> = [];
  let n = 0;
  for (const d of datos.dias) {
    const visibles = solo ? d.pedidos.filter((p) => !p.contado) : d.pedidos;
    if (visibles.length === 0) continue;
    for (const p of visibles) {
      n += 1;
      const falta = datos.cotejado && !p.contado;
      const estilo = falta ? { fillColor: FONDO_ROJO, textColor: ROJO } : {};
      const celda = (contenido: string | number, extra: Record<string, unknown> = {}) => ({ content: String(contenido), styles: { ...estilo, ...extra } });
      filas.push([
        celda(n, { halign: "right" }),
        celda(formatearFecha(d.fecha)),
        celda(p.ruta ?? "—", { halign: "right" }),
        celda(p.codigo),
        celda(p.bonoCentimos > 0 ? `${p.destino}\n+${formatearSoles(p.bonoCentimos)}${p.bonoNombre ? ` ${p.bonoNombre}` : ""}` : p.destino),
        celda(p.origen),
        celda(formatearSoles(p.montoCentimos), { halign: "right" }),
        celda(!datos.cotejado ? "—" : p.contado ? "Sí" : "NO FIGURA", { fontStyle: falta ? "bold" : "normal", halign: "center" }),
      ]);
    }
    const subtotal = visibles.reduce((s, p) => s + p.montoCentimos, 0);
    const permanencia = d.pagaPor === "permanencia" && !solo;
    filas.push([
      "",
      {
        content: `${nombreDelDia(d.fecha)} ${formatearFecha(d.fecha)} · ${visibles.length} pedido${visibles.length === 1 ? "" : "s"}${permanencia ? ` · se paga por permanencia (${formatearSoles(d.pagadoCentimos)})` : ""}`,
        colSpan: 5,
        styles: { fontStyle: "bold", fillColor: FONDO_DIA },
      },
      { content: formatearSoles(subtotal), styles: { fontStyle: "bold", halign: "right", fillColor: FONDO_DIA } },
      { content: "", styles: { fillColor: FONDO_DIA } },
    ]);
  }

  autoTabla(doc, {
    startY: y + 4,
    head: [["N°", "Fecha", "Ruta", "Pedido", "Destino", "Origen", "Monto", "Empresa"]],
    body: filas as never,
    theme: "grid",
    styles: { fontSize: 7.5, cellPadding: 1.6, lineColor: [210, 210, 210], lineWidth: 0.1 },
    headStyles: { fillColor: [245, 245, 245], textColor: [30, 30, 30], fontStyle: "bold" },
    columnStyles: { 0: { cellWidth: 8 }, 2: { cellWidth: 10 }, 6: { cellWidth: 21 }, 7: { cellWidth: 22 } },
    showHead: "everyPage",
    margin: { top: 16, bottom: 18, left: 14, right: 14 },
  });

  const ultimaY = () => (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? 40;

  /* ------------------------------ resumen ------------------------------- */
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text("Resumen de la semana", 14, ultimaY() + 10);
  const resumen: Array<Array<string | Record<string, unknown>>> = [
    ["Pedidos", String(t.pedidos), formatearSoles(t.subtotalCentimos)],
  ];
  if (datos.cotejado) {
    resumen.push(["Figuran en el reporte de la empresa", String(t.contados), formatearSoles(t.contadosCentimos)]);
    resumen.push([
      { content: "NO figuran en el reporte", styles: { textColor: ROJO, fontStyle: "bold" } },
      { content: String(t.noFiguran), styles: { textColor: ROJO, fontStyle: "bold" } },
      { content: formatearSoles(t.noFiguranCentimos), styles: { textColor: ROJO, fontStyle: "bold" } },
    ]);
  }
  resumen.push([
    { content: "Total a cobrar de la semana", styles: { fontStyle: "bold" } },
    "",
    { content: formatearSoles(t.pagadoCentimos), styles: { fontStyle: "bold" } },
  ]);
  autoTabla(doc, {
    startY: ultimaY() + 12,
    head: [["Concepto", "Pedidos", "Monto"]],
    body: resumen as never,
    theme: "grid",
    styles: { fontSize: 8.5, cellPadding: 1.6, lineColor: [210, 210, 210], lineWidth: 0.1 },
    headStyles: { fillColor: [245, 245, 245], textColor: [30, 30, 30], fontStyle: "bold" },
    columnStyles: { 1: { halign: "right", cellWidth: 22 }, 2: { halign: "right", cellWidth: 30 } },
    margin: { left: 14, right: 14 },
  });

  /* ----------------- lista corta de lo que no figura -------------------- */
  const faltantes = datos.dias.flatMap((d) => d.pedidos.filter((p) => !p.contado));
  if (datos.cotejado && faltantes.length > 0 && !solo) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(...ROJO);
    doc.text("Pedidos que NO figuran en el reporte de la empresa", 14, ultimaY() + 10);
    doc.setTextColor(0);
    autoTabla(doc, {
      startY: ultimaY() + 12,
      head: [["Fecha", "Pedido", "Destino", "Monto"]],
      body: faltantes.map((p) => [formatearFecha(p.fecha), p.codigo, p.destino, formatearSoles(p.montoCentimos)]),
      theme: "grid",
      styles: { fontSize: 8, cellPadding: 1.5, lineColor: [210, 210, 210], lineWidth: 0.1 },
      headStyles: { fillColor: FONDO_ROJO, textColor: ROJO, fontStyle: "bold" },
      columnStyles: { 3: { halign: "right", cellWidth: 26 } },
      margin: { left: 14, right: 14 },
    });
  }

  /* --------------------------------- pie -------------------------------- */
  const paginas = doc.getNumberOfPages();
  const alto = doc.internal.pageSize.getHeight();
  for (let i = 1; i <= paginas; i++) {
    doc.setPage(i);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(120);
    doc.text(`Página ${i} de ${paginas}`, ancho - 14, alto - 8, { align: "right" });
    doc.text("Control Driver", 14, alto - 8);
  }
  return doc.output("blob");
}
