import {
  comoFechaExcel,
  comoHoraExcel,
  comoTexto,
  horaAFraccion,
  totalesDe,
  type DatosExportacion,
} from "./datos";
import { formatearFecha, nombreDelDia } from "@/lib/fechas";

/**
 * Excel del rango (§11).
 *
 * Es el formato de **respaldo y registro**: lleva todo el dato del rango, no un
 * resumen. Tres hojas —Pedidos, Rutas y Resumen por día— con fechas, horas y
 * montos como tipos reales de Excel, no como texto: así se puede filtrar,
 * ordenar y sumar sin pelearse con el archivo.
 *
 * ExcelJS se importa aquí dentro, no arriba: pesa casi un mega y no tiene por
 * qué estar en el paquete que carga la app al abrirse.
 */
export async function generarExcel(datos: DatosExportacion): Promise<Blob> {
  const ExcelJS = (await import("exceljs")).default;
  const libro = new ExcelJS.Workbook();

  libro.creator = "Rutas-A";
  libro.created = new Date();

  const MONEDA = '"S/ "#,##0.00';
  const FECHA = "dd/mm/yyyy";
  const HORA = "hh:mm";

  /* ------------------------------ Pedidos ------------------------------ */
  const pedidos = libro.addWorksheet("Pedidos", {
    views: [{ state: "frozen", ySplit: 1 }],
  });
  pedidos.columns = [
    { header: "N°", key: "n", width: 6 },
    { header: "Fecha", key: "fecha", width: 12, style: { numFmt: FECHA } },
    { header: "Día", key: "dia", width: 11 },
    { header: "Código de pedido", key: "codigo", width: 22 },
    { header: "Ruta", key: "ruta", width: 7 },
    { header: "Horario de ruta", key: "horario", width: 16 },
    { header: "Estado", key: "estado", width: 16 },
    { header: "Tramo", key: "tramo", width: 7 },
    { header: "Km", key: "km", width: 7 },
    { header: "Monto", key: "monto", width: 12, style: { numFmt: MONEDA } },
  ];

  let n = 0;
  for (const j of datos.jornadas) {
    for (const p of j.pedidos) {
      n += 1;
      pedidos.addRow({
        n,
        fecha: comoFechaExcel(j.fecha),
        dia: nombreDelDia(j.fecha),
        codigo: comoTexto(p.codigo),
        ruta: p.ruta,
        horario: p.horarioRuta ?? "",
        estado: p.estado,
        tramo: p.tramo,
        km: p.km,
        monto: p.montoCentimos / 100,
      });
    }
  }

  const totales = totalesDe(datos);
  const filaTotalPedidos = pedidos.addRow({
    codigo: `TOTAL · ${totales.pedidos} pedidos`,
    monto: totales.centimos / 100,
  });
  filaTotalPedidos.font = { bold: true };

  pedidos.getRow(1).font = { bold: true };
  pedidos.autoFilter = { from: "A1", to: { row: 1, column: 10 } };

  /* ------------------------------- Rutas ------------------------------- */
  const rutas = libro.addWorksheet("Rutas", { views: [{ state: "frozen", ySplit: 1 }] });
  rutas.columns = [
    { header: "Fecha", key: "fecha", width: 12, style: { numFmt: FECHA } },
    { header: "Día", key: "dia", width: 11 },
    { header: "Ruta", key: "ruta", width: 7 },
    { header: "Inicio", key: "inicio", width: 9, style: { numFmt: HORA } },
    { header: "Fin", key: "fin", width: 9, style: { numFmt: HORA } },
    { header: "Duración", key: "duracion", width: 10, style: { numFmt: HORA } },
    { header: "Pedidos", key: "pedidos", width: 9 },
  ];

  for (const j of datos.jornadas) {
    for (const r of j.rutas) {
      rutas.addRow({
        fecha: comoFechaExcel(j.fecha),
        dia: nombreDelDia(j.fecha),
        ruta: r.numero,
        inicio: horaAFraccion(r.horaInicio),
        fin: horaAFraccion(r.horaFin),
        duracion: r.duracionMin === null ? null : comoHoraExcel(r.duracionMin),
        pedidos: r.pedidos,
      });
    }
  }
  rutas.getRow(1).font = { bold: true };
  rutas.autoFilter = { from: "A1", to: { row: 1, column: 7 } };

  /* -------------------------- Resumen por día -------------------------- */
  const resumen = libro.addWorksheet("Resumen por día", {
    views: [{ state: "frozen", ySplit: 1 }],
  });
  resumen.columns = [
    { header: "Fecha", key: "fecha", width: 12, style: { numFmt: FECHA } },
    { header: "Día", key: "dia", width: 11 },
    { header: "Pedidos", key: "pedidos", width: 9 },
    { header: "Rutas", key: "rutas", width: 8 },
    { header: "Tiempo en ruta", key: "tiempo", width: 15, style: { numFmt: HORA } },
    { header: "Horas en tienda", key: "horas", width: 15 },
    { header: "Por pedidos", key: "porPedidos", width: 13, style: { numFmt: MONEDA } },
    { header: "Por permanencia", key: "porPermanencia", width: 16, style: { numFmt: MONEDA } },
    { header: "Se cobra", key: "cobra", width: 13, style: { numFmt: MONEDA } },
    { header: "Paga por", key: "pagaPor", width: 13 },
  ];

  for (const j of datos.jornadas) {
    resumen.addRow({
      fecha: comoFechaExcel(j.fecha),
      dia: nombreDelDia(j.fecha),
      pedidos: j.pedidos.length,
      rutas: j.rutas.length,
      tiempo: comoHoraExcel(j.minutosEnRuta),
      horas: j.horasPermanencia || null,
      porPedidos: j.montoPedidosCentimos / 100,
      porPermanencia: j.montoPermanenciaCentimos ? j.montoPermanenciaCentimos / 100 : null,
      cobra: j.montoCentimos / 100,
      pagaPor: j.pagaPor === "permanencia" ? "permanencia" : "pedidos",
    });
  }

  const filaTotalResumen = resumen.addRow({
    dia: "TOTAL",
    pedidos: totales.pedidos,
    rutas: totales.rutas,
    tiempo: comoHoraExcel(totales.minutos),
    cobra: totales.centimos / 100,
  });
  filaTotalResumen.font = { bold: true };
  resumen.getRow(1).font = { bold: true };

  /* ------------------------------ Portada ------------------------------ */
  const portada = libro.addWorksheet("Datos");
  portada.columns = [
    { header: "", key: "campo", width: 22 },
    { header: "", key: "valor", width: 34 },
  ];
  portada.addRows([
    { campo: "Driver", valor: datos.driver },
    { campo: "Tienda", valor: datos.tienda ?? "sin asignar" },
    { campo: "Desde", valor: formatearFecha(datos.desde) },
    { campo: "Hasta", valor: formatearFecha(datos.hasta) },
    { campo: "Días trabajados", valor: datos.jornadas.length },
    { campo: "Generado", valor: new Date() },
  ]);
  portada.getColumn("campo").font = { bold: true };

  const buffer = await libro.xlsx.writeBuffer();
  return new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
}
