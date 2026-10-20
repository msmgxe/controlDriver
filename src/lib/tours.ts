/**
 * Los recorridos guiados de cada pantalla.
 *
 * Cada uno señala, uno a uno, elementos **reales** de la pantalla (por su `id`) con
 * una burbuja que dice qué hacen. Se abren desde Tutoriales, que navega a la
 * pantalla con `?tour=<nombre>`; `TourDePantalla` los recoge.
 *
 * `abrir` es una clave que la pantalla entiende para dejar a la vista lo que
 * el paso señala (por ejemplo, desplegar un acordeón de Pagos) antes de medir.
 * Un paso cuyo elemento no existe —un día sin apoyo no tiene fila de apoyo— se
 * salta solo.
 */
export interface PasoDeTour {
  selector: string;
  titulo: string;
  texto: string;
  abrir?: string;
}

export type PantallaConTours = "inicio" | "pagos" | "estadisticas" | "ajustes" | "historial";

export const TOURS: Record<PantallaConTours, Record<string, PasoDeTour[]>> = {
  inicio: {
    tarjeta: [
      {
        selector: "#recorrido-tarjeta",
        titulo: "La tarjeta del día",
        texto:
          "El anillo reparte lo que ganaste entre tu tienda, el apoyo y el taxi. Toca un color o una ficha para ver el detalle de esa fuente. La llama cuenta tus días seguidos y la estrella aparece cuando hoy supera a tus otros días.",
      },
      {
        selector: "#recorrido-lista",
        titulo: "¿Qué hiciste hoy?",
        texto:
          "Cada cosa del día con su monto. Lo hecho lleva un ✓ y se despliega con su detalle; lo que falta lleva un «+» y, al tocarlo, empiezas a anotarlo.",
      },
    ],
    dias: [
      {
        selector: "#recorrido-tira",
        titulo: "Cambia de día",
        texto:
          "Toca un día para verlo. Arrastra la barra para pasar de semana, o desliza la pantalla a los lados para ir al día anterior o al siguiente.",
      },
      {
        selector: "#recorrido-calendario",
        titulo: "Salta a cualquier fecha",
        texto: "El calendario te lleva directo a un día de otra semana o de otro mes.",
      },
      {
        selector: "#recorrido-pista",
        titulo: "Día de descanso",
        texto:
          "Mantén presionado un día de la barra: se abre una hoja para marcarlo como descanso (la lunita) o quitar la marca. Un día con pedidos, apoyo o taxi no se puede marcar.",
      },
    ],
    agregar: [
      {
        selector: "#recorrido-fab",
        titulo: "El botón «+»",
        texto:
          "Abre tres opciones: pedidos de tu tienda, apoyo a otra tienda y adicionales (taxi, movilidad…). En cada hoja eliges el día arriba, así que puedes registrar algo de ayer.",
      },
      {
        selector: "#recorrido-tarjeta",
        titulo: "Todo suma al día",
        texto: "Lo que registres se suma al total del anillo, con su color: el apoyo en el segundo color de la cara y el taxi en otro.",
      },
      {
        selector: "#recorrido-lista",
        titulo: "Detalle, corregir y quitar",
        texto:
          "Cada apoyo o taxi sale como una fila con su monto. Tócala para ver la cuenta, corregirla o quitarla. Quitar siempre pregunta antes.",
      },
    ],
    comanda: [
      {
        selector: "#recorrido-tomar-foto",
        titulo: "Fotografía la hoja de despacho",
        texto:
          "Abre la cámara de una vez. La app lee el número (de 7 u 8 cifras), el cliente, la dirección y el teléfono, y con la dirección calcula el tramo.",
      },
      {
        selector: "#recorrido-lista",
        titulo: "Revisa y guarda",
        texto:
          "Si la hoja trae su horario, el pedido va a la ruta de esa hora, y se crea si es la primera vez. Lo dudoso se marca para que lo corrijas. La foto queda como evidencia del pedido.",
      },
    ],
  },
  pagos: {
    pagos: [
      {
        selector: "#pagos-tira",
        titulo: "La semana, día por día",
        texto: "Cada día muestra lo que produjo, sumando tienda, apoyo y taxi. Toca uno para ver su detalle más abajo.",
      },
      {
        selector: "#pagos-total",
        titulo: "El total de la semana",
        texto: "Dice cuánto llevas, si la semana está en curso, por cobrar o pagada, y qué día se paga.",
      },
      {
        selector: "#pagos-carretera",
        titulo: "La carretera de tu meta",
        texto:
          "Tu vehículo avanza de izquierda a derecha hasta donde vas de la meta semanal; los banderines marcan 25, 50, 75 y 100 %. Cambias la meta en Ajustes. Tócala para repetir la animación.",
      },
      {
        selector: "#pagos-desglose",
        titulo: "De dónde viene",
        texto: "Tu tienda, cada tienda de apoyo y el taxi, cada uno con su monto y su porcentaje.",
      },
      {
        selector: "#pagos-dias",
        titulo: "Día por día",
        texto: "Abre cada día para ver sus pedidos, su apoyo y su taxi, o marcar un día sin trabajo.",
        abrir: "dias",
      },
    ],
    tramos: [
      {
        selector: "#pagos-tramos",
        titulo: "Por tramo",
        texto:
          "Los pedidos agrupados por distancia. Toca un tramo para ver sus pedidos y un pedido para ver su foto de comanda como evidencia, o cambiarle el tramo.",
        abrir: "tramos",
      },
      {
        selector: "#pagos-cobro",
        titulo: "Cobro",
        texto: "Aquí anotas lo que te depositaron; la app avisa si no cuadra con lo calculado. Cierra la semana cuando esté completa.",
        abrir: "cobro",
      },
    ],
  },
  estadisticas: {
    estadisticas: [
      {
        selector: "#est-vistas",
        titulo: "Semana, Comparar y Mes",
        texto: "Mira una semana, compárala con otra, o revisa un mes entero semana a semana.",
      },
      {
        selector: "#est-semana",
        titulo: "Elige el periodo",
        texto: "Con las flechas o el calendario vas a cualquier semana. Lo de abajo se recalcula.",
      },
      {
        selector: "#est-resumen",
        titulo: "El resumen",
        texto: "Los pedidos y lo generado: tienda, apoyo y taxi juntos.",
      },
      {
        selector: "#est-meta",
        titulo: "El velocímetro de tu meta",
        texto:
          "La aguja sube hasta tu avance. El arco usa los colores de cada fuente. Tócalo para repetirlo. En la vista de mes, la meta se ajusta a las semanas del mes.",
      },
      {
        selector: "#est-fuentes",
        titulo: "De dónde viene",
        texto: "El mismo reparto, con montos y porcentajes: lo que te dio cada tienda, tu apoyo y el taxi.",
      },
    ],
  },
  ajustes: {
    ajustes: [
      {
        selector: "#aj-metas",
        titulo: "Mis metas y sonidos",
        texto: "Pon cuánto quieres ganar al día y a la semana: mueven la carretera de Pagos y el velocímetro de Estadísticas. Aquí también apagas los sonidos.",
      },
      {
        selector: "#aj-tienda",
        titulo: "Tienda, ubicación y tarifa",
        texto: "Eliges para quién repartes, dónde está la tienda y si trabajas en auto o en moto. Cambia el vehículo que ves en toda la app.",
      },
      {
        selector: "#aj-comandas",
        titulo: "Comandas y clientes",
        texto: "Decides qué se guarda del cliente (nombre, dirección, teléfono, foto) y si el cálculo del tramo es automático.",
      },
      {
        selector: "#aj-pin",
        titulo: "Bloqueo del dispositivo",
        texto: "Un PIN de 4 dígitos, y la huella si quieres, para que nadie vea tus ingresos si presta tu teléfono.",
      },
      {
        selector: "#aj-respaldo",
        titulo: "Respaldo de tus datos",
        texto: "Crea una copia y mándala por WhatsApp, Drive o correo. Si cambias de teléfono, la restauras aquí.",
      },
    ],
  },
  historial: {
    exportar: [
      {
        selector: "#hist-rango",
        titulo: "Elige el periodo",
        texto: "Una semana o un mes: lo que exportes es exactamente lo que ves.",
      },
      {
        selector: "#hist-exportar",
        titulo: "PDF y Excel con el detalle",
        texto:
          "Incluyen los pedidos, el apoyo y el taxi por separado, los pedidos por tramo y el total por fuente. Se generan en tu teléfono y los compartes o los guardas.",
        abrir: "exportar",
      },
    ],
  },
};
