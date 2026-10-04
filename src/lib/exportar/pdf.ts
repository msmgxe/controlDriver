import { describirBloque, fuentesDe, totalesDe, tramosDe, type DatosExportacion } from "./datos";
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
  doc.text("Control Driver", 14, 18);

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
    `${totales.pedidos} pedidos · ${totales.rutas} rutas · ${datos.jornadas.length} días${
      datos.bloques.length > 0 ? ` · ${datos.bloques.length} apoyo/taxi` : ""
    }`,
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

  /* --------------------- apoyo a otras tiendas y taxi --------------------- */
  const ultimaY = () =>
    (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? 40;

  if (datos.bloques.length > 0) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.text("Apoyo a otras tiendas y taxi", 14, ultimaY() + 10);
    autoTabla(doc, {
      startY: ultimaY() + 12,
      head: [["Fecha", "Tipo", "Tienda / carrera", "Detalle", "Horario", "Monto"]],
      body: datos.bloques.map((x) => {
        const d = describirBloque(x.bloque);
        return [formatearFecha(x.fecha), d.tipo, d.titulo, d.detalle, d.horario, formatearSoles(x.bloque.montoCentimos)];
      }),
      theme: "grid",
      styles: { fontSize: 7.5, cellPadding: 1.6, lineColor: [210, 210, 210], lineWidth: 0.1 },
      headStyles: { fillColor: [245, 245, 245], textColor: [30, 30, 30], fontStyle: "bold" },
      columnStyles: { 5: { halign: "right", cellWidth: 22 } },
      showHead: "everyPage",
      margin: { top: 16, bottom: 18, left: 14, right: 14 },
    });
  }

  /* ------------------------------- por tramo ------------------------------ */
  const tramos = tramosDe(datos);
  if (tramos.length > 0) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.text("Pedidos de la tienda por tramo", 14, ultimaY() + 10);
    autoTabla(doc, {
      startY: ultimaY() + 12,
      head: [["Tramo", "Pedidos", "Monto"]],
      body: tramos.map((t) => [t.tramo === 6 ? "Más de 12 km" : `Tramo ${t.tramo}`, String(t.pedidos), formatearSoles(t.centimos)]),
      theme: "grid",
      styles: { fontSize: 8, cellPadding: 1.4, lineColor: [210, 210, 210], lineWidth: 0.1 },
      headStyles: { fillColor: [245, 245, 245], textColor: [30, 30, 30], fontStyle: "bold" },
      columnStyles: { 1: { halign: "right" }, 2: { halign: "right" } },
      tableWidth: 90,
      margin: { left: 14, right: 14 },
    });
  }

  /* ------------------------------- totales ------------------------------ */
  const fuentes = fuentesDe(datos);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text("Total del rango por fuente", 14, ultimaY() + 10);
  autoTabla(doc, {
    startY: ultimaY() + 12,
    head: [["Fuente", "Detalle", "Monto"]],
    body: [
      ...fuentes.map((f) => [f.etiqueta, f.detalle, formatearSoles(f.centimos)]),
      [
        { content: "TOTAL", styles: { fontStyle: "bold" as const } } as unknown as string,
        `${datos.jornadas.length} días · ${formatearDuracion(totales.minutos)} en ruta`,
        { content: formatearSoles(totales.centimos), styles: { fontStyle: "bold" as const } } as unknown as string,
      ],
    ],
    theme: "grid",
    styles: { fontSize: 8.5, cellPadding: 1.6, lineColor: [210, 210, 210], lineWidth: 0.1 },
    headStyles: { fillColor: [245, 245, 245], textColor: [30, 30, 30], fontStyle: "bold" },
    columnStyles: { 2: { halign: "right", cellWidth: 28 } },
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
    doc.text("Control Driver", 14, alto - 8);
  }

  return doc.output("blob");
}
