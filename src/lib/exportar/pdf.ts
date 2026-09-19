import { totalesDe, type DatosExportacion } from "./datos";
import { formatearDuracion, formatearFecha, nombreDelDia } from "@/lib/fechas";
import { formatearSoles } from "@/lib/pagos/reglas";

/**
 * PDF del rango (§11).
 *
 * A4 vertical, tipografía sobria y sin fondos pesados, para que imprima bien.
 * Encabezado repetido en cada página, subtotales por día, total general y pie
 * con "Página X de Y".
 *
 * Este es el papel que se le enseña a la tienda cuando un pago no cuadra, así
 * que cuando la permanencia cubre un día se dice explícitamente en la fila de
 * subtotal: si no, el total no cuadraría con la suma de los pedidos y parecería
 * un error nuestro.
 */
export async function generarPdf(datos: DatosExportacion): Promise<Blob> {
  const { jsPDF } = await import("jspdf");
  const autoTabla = (await import("jspdf-autotable")).default;

  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const ancho = doc.internal.pageSize.getWidth();
  const totales = totalesDe(datos);

  /* ----------------------------- encabezado ----------------------------- */
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text("Rutas-A", 14, 18);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text(datos.driver, 14, 25);
  if (datos.tienda) doc.text(datos.tienda, 14, 30);

  doc.setFontSize(9);
  doc.text(
    `Del ${formatearFecha(datos.desde)} al ${formatearFecha(datos.hasta)}`,
    ancho - 14,
    18,
    { align: "right" },
  );
  doc.text(`Generado el ${formatearFecha(new Date().toISOString().slice(0, 10))}`, ancho - 14, 23, {
    align: "right",
  });
  doc.text(
    `${totales.pedidos} pedidos · ${totales.rutas} rutas · ${datos.jornadas.length} días`,
    ancho - 14,
    28,
    { align: "right" },
  );

  /* -------------------------------- tabla ------------------------------- */
  const filas: (string | number)[][] = [];
  let n = 0;

  for (const j of datos.jornadas) {
    for (const p of j.pedidos) {
      n += 1;
      filas.push([
        n,
        formatearFecha(j.fecha),
        p.codigo,
        p.ruta ?? "—",
        p.horarioRuta ?? "—",
        p.estado,
        `T${p.tramo}`,
        formatearSoles(p.montoCentimos),
      ]);
    }

    const cubierto = j.pagaPor === "permanencia";
    filas.push([
      "",
      {
        content: cubierto
          ? `${nombreDelDia(j.fecha)} ${formatearFecha(j.fecha)} · ${j.pedidos.length} pedidos · cubre la permanencia (${j.horasPermanencia} h)`
          : `${nombreDelDia(j.fecha)} ${formatearFecha(j.fecha)} · ${j.pedidos.length} pedidos · ${j.rutas.length} rutas`,
        colSpan: 6,
        styles: { fontStyle: "bold" as const },
      } as unknown as string,
      { content: formatearSoles(j.montoCentimos), styles: { fontStyle: "bold" as const } } as unknown as string,
    ]);
  }

  autoTabla(doc, {
    startY: datos.tienda ? 36 : 33,
    head: [["N°", "Fecha", "Código de pedido", "Ruta", "Horario", "Estado", "Tramo", "Monto"]],
    body: filas,
    theme: "grid",
    styles: { fontSize: 7.5, cellPadding: 1.6, lineColor: [210, 210, 210], lineWidth: 0.1 },
    headStyles: { fillColor: [245, 245, 245], textColor: [30, 30, 30], fontStyle: "bold" },
    columnStyles: {
      0: { halign: "right", cellWidth: 9 },
      3: { halign: "right", cellWidth: 12 },
      7: { halign: "right", cellWidth: 22 },
    },
    // El encabezado se repite en cada página; sin esto una tabla larga deja
    // páginas sueltas sin saber qué es cada columna.
    showHead: "everyPage",
    margin: { top: 16, bottom: 18, left: 14, right: 14 },
  });

  /* ------------------------------- totales ------------------------------ */
  const finTabla =
    (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? 40;

  autoTabla(doc, {
    startY: finTabla + 4,
    body: [
      ["Días trabajados", String(datos.jornadas.length)],
      ["Pedidos", String(totales.pedidos)],
      ["Rutas", String(totales.rutas)],
      ["Tiempo en ruta", formatearDuracion(totales.minutos)],
      ["Total del rango", formatearSoles(totales.centimos)],
    ],
    theme: "plain",
    styles: { fontSize: 9, cellPadding: 1.2 },
    columnStyles: {
      0: { cellWidth: 45, textColor: [90, 90, 90] },
      1: { fontStyle: "bold" },
    },
    margin: { left: 14, right: 14 },
  });

  /* --------------------------------- pie -------------------------------- */
  const paginas = doc.getNumberOfPages();
  const alto = doc.internal.pageSize.getHeight();
  for (let i = 1; i <= paginas; i++) {
    doc.setPage(i);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(120);
    doc.text(`Página ${i} de ${paginas}`, ancho - 14, alto - 8, { align: "right" });
    doc.text("Rutas-A", 14, alto - 8);
  }

  return doc.output("blob");
}
