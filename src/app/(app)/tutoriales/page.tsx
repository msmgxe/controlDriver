import Link from "next/link";

import { Acordeon } from "@/components/Acordeon";

export const dynamic = "force-static";

/**
 * Tutoriales: guías cortas de cómo se hace cada cosa en la app, para quien
 * prefiere leer los pasos antes que ir probando. Un acordeón por tema, todos
 * cerrados al entrar —igual que el resto de la app—, para no enseñar de
 * golpe algo que no todos necesitan en ese momento.
 *
 * Vive detrás de «Más» en la barra de abajo (`src/lib/navegacion.ts`), junto
 * a Buscar, Historial y Ajustes.
 */
export default function PaginaTutoriales() {
  return (
    <div className="mx-auto flex max-w-[880px] flex-col gap-4">
      <div>
        <h2 className="text-[30px] leading-tight">Tutoriales</h2>
        <p className="mt-1 max-w-[60ch] text-sm text-tinta-2">
          Guías cortas, paso a paso, de cada pantalla. En cada una, el botón{" "}
          <b className="text-tinta">▶ Ver el recorrido guiado</b> te lleva a la pantalla real y te señala cada cosa.
        </p>
      </div>

      <Grupo titulo="Inicio" />
      <Tema titulo="Registrar tus pedidos del día" resumen="Resumen del día, foto de comanda y las otras formas" tour="/?tour=registrar">
        <TutorialRegistrarPedidos />
      </Tema>
      <Tema titulo="La tarjeta del día" resumen="El anillo, las fichas, la racha y el récord" tour="/?tour=tarjeta">
        <TutorialTarjeta />
      </Tema>
      <Tema titulo="Cambiar de día y marcar descansos" resumen="La barra de fechas, el calendario y la pulsación larga" tour="/?tour=dias">
        <TutorialDias />
      </Tema>
      <Tema titulo="La foto de la comanda" resumen="Cliente, dirección, teléfono y ruta, leídos solos" tour="/?tour=comanda">
        <TutorialComanda />
      </Tema>
      <Tema titulo="Apoyo a otra tienda y taxi libre" resumen="El botón «+», el día, corregir y quitar" tour="/?tour=agregar">
        <TutorialApoyoYTaxi />
      </Tema>

      <Grupo titulo="Pagos" />
      <Tema titulo="Tu semana y tu meta" resumen="El total, la carretera y de dónde viene el dinero" tour="/pagos?tour=pagos">
        <TutorialPagos />
      </Tema>
      <Tema titulo="Por tramo, evidencia y cobro" resumen="Comprueba cada pago con la foto de la comanda" tour="/pagos?tour=tramos">
        <TutorialTramos />
      </Tema>

      <Grupo titulo="Estadísticas e historial" />
      <Tema titulo="Estadísticas" resumen="Semana, comparar, mes y el velocímetro de tu meta" tour="/estadisticas?tour=estadisticas">
        <TutorialEstadisticas />
      </Tema>
      <Tema titulo="Exportar a PDF y Excel" resumen="Con el detalle de tienda, apoyo, taxi y tramos" tour="/historial?tour=exportar">
        <TutorialExportar />
      </Tema>

      <Grupo titulo="Ajustes" />
      <Tema titulo="Metas, sonidos, transporte, PIN y respaldo" resumen="Deja la app a tu medida y tus datos a salvo" tour="/ajustes?tour=ajustes">
        <TutorialAjustes />
      </Tema>
    </div>
  );
}

function Grupo({ titulo }: { titulo: string }) {
  return <h3 className="rotulo mt-2 px-1">{titulo}</h3>;
}

/** Un tema: acordeón cerrado, con su botón de recorrido guiado y sus pasos. */
function Tema({
  titulo,
  resumen,
  tour,
  children,
}: {
  titulo: string;
  resumen: string;
  tour: string;
  children: React.ReactNode;
}) {
  return (
    <Acordeon titulo={titulo} resumen={resumen}>
      <Link href={tour} className="boton-sec self-start !text-sm">
        ▶ Ver el recorrido guiado
      </Link>
      {children}
    </Acordeon>
  );
}

function Paso({ numero, titulo, children }: { numero: number; titulo: string; children: React.ReactNode }) {
  return (
    <li className="flex gap-3">
      <span className="grid size-7 shrink-0 place-items-center rounded-full bg-acento-suave font-display text-sm font-bold text-acento-tinta">
        {numero}
      </span>
      <div className="flex flex-col gap-0.5 pt-0.5">
        <b className="text-[15px]">{titulo}</b>
        <p className="text-sm text-tinta-2">{children}</p>
      </div>
    </li>
  );
}

function TutorialRegistrarPedidos() {
  return (
    <div className="flex flex-col gap-4 text-sm text-tinta-2">
      <p>
        En Inicio hay <b className="text-tinta">dos botones</b>, uno junto al otro y de distinto color a
        propósito, para los dos momentos en que se registra un pedido: al terminar el día, con todo junto, o
        pedido por pedido, apenas lo entregas. Elige el que va con tu forma de trabajar; los dos terminan en el
        mismo lugar, contando para tu pago de la semana.
      </p>

      <div>
        <h4 className="mb-2 text-xs font-bold tracking-wide text-tinta uppercase">
          «Cargar resumen del día» — al terminar la jornada
        </h4>
        <ol className="flex flex-col gap-3">
          <Paso numero={1} titulo="Elige el día en Inicio">
            La tira de días de arriba manda: toca el que quieres cargar. Por defecto es hoy.
          </Paso>
          <Paso numero={2} titulo='Toca "Cargar resumen del día"'>
            Elige las capturas de la app de la tienda —de la galería o compartidas desde ella—, con tus rutas y tus
            pedidos. Puedes subir varias a la vez.
          </Paso>
          <Paso numero={3} titulo="Revisa lo que se leyó">
            La app lee los códigos, las rutas y los estados solo, en el teléfono, sin internet. Si algo no cuadra,
            se marca para que lo corrijas antes de guardar.
          </Paso>
          <Paso numero={4} titulo="Confirma">
            Al guardar, los pedidos quedan contando para el pago de esa semana. Puedes seguir subiendo más
            capturas del mismo día después: lo nuevo se suma, no se repite.
          </Paso>
        </ol>
      </div>

      <div className="rounded-card border border-linea-fuerte bg-sup-2 p-3">
        <h4 className="mb-1 text-xs font-bold tracking-wide text-tinta uppercase">
          «Tomar foto de una comanda» — pedido por pedido, el camino más corto
        </h4>
        <p>
          Un solo toque abre la cámara de una vez, sin pasar por ninguna otra pantalla. Fotografías la hoja de
          despacho del pedido que acabas de recoger o entregar, y la app lee sola el número, el cliente, el
          teléfono y la dirección —con la dirección, calcula cuánto se cobra—. Revisas lo dudoso y guardas. Es la
          misma lectura de comandas de siempre; este botón solo la deja a un toque, para cuando prefieres ir
          registrando cada pedido en el momento en vez de guardar todas las fotos para el final del día.
        </p>
      </div>

      <div>
        <h4 className="mb-2 text-xs font-bold tracking-wide text-tinta uppercase">
          Cuando falta un pedido, o no hay captura
        </h4>
        <p className="mb-2">
          En Inicio toca la fila <b className="text-tinta">«Pedidos de mi tienda»</b> (o el botón{" "}
          <b className="text-tinta">+</b> y luego «Pedidos de mi tienda»). Se abre una hoja con la pestaña{" "}
          <b className="text-tinta">Pedidos</b>, que tiene cuatro formas, de la más completa a la más simple:
        </p>
        <ul className="flex flex-col gap-2">
          <li>
            <b className="text-tinta">Leer una comanda:</b> la misma lectura del botón de arriba, pero desde aquí
            se puede elegir varias fotos de la galería de una vez, no solo tomar una con la cámara.
          </li>
          <li>
            <b className="text-tinta">Anotar cuántos pedidos hice:</b> cuando no tienes ni el código a mano. Escribes
            cuántos fueron y los completas después, uno por uno.
          </li>
          <li>
            <b className="text-tinta">Añadir un pedido a mano:</b> escribes el código, eliges la ruta y el estado.
            El más directo cuando ya lo sabes de memoria.
          </li>
          <li>
            <b className="text-tinta">Leer pedidos de una foto:</b> una lista de códigos de la propia app de
            reparto, sin cliente ni dirección —para cuando la comanda no está a mano, solo la lista.
          </li>
        </ul>
      </div>

      <p className="rounded-btn bg-sup-2 p-3 text-xs text-tinta-3">
        Un pedido nunca se duplica: su código lo identifica siempre, venga de una captura, de una comanda o
        escrito a mano. Si ya estaba cargado, lo que agregues lo completa; no crea uno al lado.
      </p>
    </div>
  );
}


function Nota({ children }: { children: React.ReactNode }) {
  return <p className="rounded-btn bg-sup-2 p-3 text-xs text-tinta-3">{children}</p>;
}

function Lista({ children }: { children: React.ReactNode }) {
  return <ol className="flex flex-col gap-3">{children}</ol>;
}

function TutorialTarjeta() {
  return (
    <div className="flex flex-col gap-4 text-sm text-tinta-2">
      <p>
        La tarjeta azul de Inicio resume el día. Se dibuja sola al abrir la pantalla y el total cuenta hacia arriba.
      </p>
      <Lista>
        <Paso numero={1} titulo="Lee el anillo">
          Reparte lo que ganaste ese día entre <b className="text-tinta">tu tienda</b>, el <b className="text-tinta">apoyo</b> a
          otras tiendas y el <b className="text-tinta">taxi</b>. El número del centro es el total de todo.
        </Paso>
        <Paso numero={2} titulo="Toca un color o una ficha">
          Suena distinto cada fuente y la lista de abajo despliega el detalle de esa fuente: pedidos, horas o carreras.
        </Paso>
        <Paso numero={3} titulo="Mira la racha y el récord">
          La llama cuenta cuántos días seguidos cargas; la estrella «¡Récord!» aparece cuando hoy superó a tus otros días
          cercanos. Si el día es solo de tienda, la tarjeta queda limpia, sin fichas.
        </Paso>
        <Paso numero={4} titulo="Revisa «¿Qué hiciste hoy?»">
          Lo hecho lleva un ✓ verde y se despliega. Lo que falta lleva un «+»: al tocarlo empiezas a anotarlo.
        </Paso>
      </Lista>
    </div>
  );
}

function TutorialDias() {
  return (
    <div className="flex flex-col gap-4 text-sm text-tinta-2">
      <Lista>
        <Paso numero={1} titulo="Elige un día de la semana">
          Toca cualquier día de la barra de arriba. Los puntos dicen cuáles ya tienen carga; la lunita, cuáles marcaste como descanso.
        </Paso>
        <Paso numero={2} titulo="Cambia de semana">
          Arrastra la barra a la izquierda o a la derecha. También puedes deslizar toda la pantalla de lado para ir al día
          anterior o al siguiente.
        </Paso>
        <Paso numero={3} titulo="Salta a una fecha lejana">
          El icono del calendario abre el selector de fecha: ideal para ponerte al día con un día de hace dos semanas.
        </Paso>
        <Paso numero={4} titulo="Marca un día de descanso">
          Mantén presionado el día en la barra: el teléfono vibra y se abre una hoja con «Marcar como día de descanso». Para
          quitarlo, haces lo mismo. Un día con pedidos, apoyo o taxi no se puede marcar, porque se trabajó.
        </Paso>
      </Lista>
      <Nota>Un día de descanso no cuenta como «falta subirlo» ni entra en ningún monto.</Nota>
    </div>
  );
}

function TutorialComanda() {
  return (
    <div className="flex flex-col gap-4 text-sm text-tinta-2">
      <p>
        La <b className="text-tinta">hoja de despacho</b> que acompaña a cada pedido se lee con una foto. Funciona con las de
        Wong (número de 8 cifras) y con las de Metro (7 cifras).
      </p>
      <Lista>
        <Paso numero={1} titulo="Toca «Tomar foto de una comanda»">
          Se abre la cámara. Enfoca la hoja entera, con el número arriba a la izquierda y el cliente a la derecha.
        </Paso>
        <Paso numero={2} titulo="Revisa lo que se leyó">
          Aparecen el número, el cliente, la dirección y el teléfono. Lo dudoso se marca para que lo corrijas; un teléfono
          cortado por el borde sale parcial para que lo completes.
        </Paso>
        <Paso numero={3} titulo="La ruta sale del horario de la hoja">
          Si la hoja trae su ventana horaria (por ejemplo 17:00–18:00), el pedido va a la ruta de esa hora. Si todavía no
          existe, se crea y el día se renumera por hora.
        </Paso>
        <Paso numero={4} titulo="Guarda">
          El pedido queda con su cliente, su distancia y su tramo, y la foto como evidencia. El código se guarda como está
          impreso y se registra de dónde vino.
        </Paso>
      </Lista>
    </div>
  );
}

function TutorialApoyoYTaxi() {
  return (
    <div className="flex flex-col gap-4 text-sm text-tinta-2">
      <p>
        Además de tu tienda de siempre, puedes registrar el <b className="text-tinta">apoyo</b> a otra tienda y las{" "}
        <b className="text-tinta">carreras de taxi</b>. Todo suma al total, cada cosa con su color.
      </p>
      <Lista>
        <Paso numero={1} titulo="Toca el botón «+»">
          Se abre en abanico: pedidos de tu tienda, apoyo a otra tienda y taxi libre. También están en la hoja de «Cargar».
        </Paso>
        <Paso numero={2} titulo="Elige el día">
          Arriba de cada hoja está el día; tócalo para cambiarlo y registrar algo de ayer.
        </Paso>
        <Paso numero={3} titulo="Taxi libre">
          Toca «Marcar inicio» al comenzar y «Marcar fin» al terminar: con el GPS la app calcula los km. Sin señal, escríbelos a
          mano. El monto lo pones tú, porque lo fija la app de taxi.
        </Paso>
        <Paso numero={4} titulo="Apoyo por hora o por tramos">
          Por hora: la tienda, la entrada, la salida y tu tarifa; la cuenta sale sola. Por tramos: eliges la tienda y el tramo
          de cada pedido, y se paga con la tarifa de esa tienda.
        </Paso>
        <Paso numero={5} titulo="Toca un registro para ver su detalle">
          Verás la cuenta (horas × tarifa o cada pedido), la cinta de horas con su cursor luminoso, y los botones{" "}
          <b className="text-tinta">Corregir</b> y <b className="text-tinta">Quitar</b>. Quitar siempre pregunta antes.
        </Paso>
      </Lista>
    </div>
  );
}

function TutorialPagos() {
  return (
    <div className="flex flex-col gap-4 text-sm text-tinta-2">
      <Lista>
        <Paso numero={1} titulo="Elige la semana">
          La barra de arriba es la misma de Inicio, pero cada día muestra lo que produjo. Arrastra para ver otras semanas.
        </Paso>
        <Paso numero={2} titulo="Lee el total">
          Suma tienda, apoyo y taxi. La etiqueta dice si la semana está en curso, por cobrar o pagada, y abajo, qué día se paga.
        </Paso>
        <Paso numero={3} titulo="Sigue la carretera de tu meta">
          Tu vehículo avanza de izquierda a derecha hasta tu avance. Los banderines marcan 25, 50, 75 y 100 %. Debajo, cuánto
          rindes por hora trabajada. Tócala para verla otra vez, con su sonido.
        </Paso>
        <Paso numero={4} titulo="Mira de dónde viene">
          Tu tienda, cada tienda de apoyo y el taxi, cada uno con su monto y su porcentaje.
        </Paso>
        <Paso numero={5} titulo="Abre «Día por día»">
          El detalle de cada día: pedidos, rutas, apoyo y taxi, con sus filas tocables. Desde ahí marcas un día sin trabajo.
        </Paso>
      </Lista>
      <Nota>La meta de la semana se cambia en Ajustes › Mis metas y sonidos.</Nota>
    </div>
  );
}

function TutorialTramos() {
  return (
    <div className="flex flex-col gap-4 text-sm text-tinta-2">
      <Lista>
        <Paso numero={1} titulo="Abre «Por tramo»">
          Verás los pedidos agrupados por distancia, con cuántos cayeron en cada tramo y cuánto sumó cada uno. Si tocaste un
          día arriba, solo cuenta ese día.
        </Paso>
        <Paso numero={2} titulo="Toca un tramo">
          Se despliegan sus pedidos, con su ruta, su estado y su monto.
        </Paso>
        <Paso numero={3} titulo="Toca un pedido para comprobarlo">
          Su hoja tiene pestañas: Pedido, Cliente, Distancia y <b className="text-tinta">Evidencia</b>, donde está la captura o la
          foto de la comanda. Si el tramo está mal, lo cambias ahí mismo.
        </Paso>
        <Paso numero={4} titulo="Anota tu cobro">
          En «Cobro» escribes lo que te depositaron. Si no cuadra con lo calculado, la app te avisa de cuánto es la diferencia.
          El apoyo y el taxi no entran en esa conciliación: no los deposita la tienda.
        </Paso>
      </Lista>
    </div>
  );
}

function TutorialEstadisticas() {
  return (
    <div className="flex flex-col gap-4 text-sm text-tinta-2">
      <Lista>
        <Paso numero={1} titulo="Elige qué mirar">
          <b className="text-tinta">Semana</b> para una semana, <b className="text-tinta">Comparar</b> para ponerla frente a otra, y{" "}
          <b className="text-tinta">Mes</b> para ver un mes entero semana a semana.
        </Paso>
        <Paso numero={2} titulo="Elige el periodo">
          Con las flechas o el calendario vas a cualquier semana o mes.
        </Paso>
        <Paso numero={3} titulo="Lee el resumen y el velocímetro">
          El resumen suma tienda, apoyo y taxi. La aguja sube hasta tu avance de la meta y su arco usa un color por fuente. En el
          mes, la meta se ajusta a las semanas que tiene.
        </Paso>
        <Paso numero={4} titulo="Baja a «De dónde viene»">
          El mismo reparto con montos y porcentajes, y más abajo los gráficos por día, los tiempos, los ingresos y los récords.
        </Paso>
      </Lista>
      <Nota>El «por pedido» solo cuenta lo de tu tienda: dividir el apoyo y el taxi entre los pedidos inflaría la cifra.</Nota>
    </div>
  );
}

function TutorialExportar() {
  return (
    <div className="flex flex-col gap-4 text-sm text-tinta-2">
      <Lista>
        <Paso numero={1} titulo="Abre Historial">
          Está en «Más». Elige una semana o un mes: lo que exportes es exactamente lo que ves.
        </Paso>
        <Paso numero={2} titulo="Abre «Exportar»">
          Elige <b className="text-tinta">Excel</b> o <b className="text-tinta">PDF</b>. Se generan en tu teléfono.
        </Paso>
        <Paso numero={3} titulo="Qué incluyen">
          Los pedidos día por día; una tabla con el apoyo y el taxi (fecha, tienda o carrera, horas o km, monto); los pedidos por
          tramo; y el total por fuente. El Excel trae además las hojas «Apoyo y taxi» y «Por fuente».
        </Paso>
        <Paso numero={4} titulo="Compártelo o guárdalo">
          Al terminar, la app te dice dónde quedó el archivo y te deja verlo, guardarlo en Descargas o compartirlo.
        </Paso>
      </Lista>
    </div>
  );
}

function TutorialAjustes() {
  return (
    <div className="flex flex-col gap-4 text-sm text-tinta-2">
      <Lista>
        <Paso numero={1} titulo="Mis metas y sonidos">
          Pon tu meta del día y de la semana: mueven la carretera de Pagos y el velocímetro de Estadísticas. Aquí también se
          apagan los sonidos y la vibración.
        </Paso>
        <Paso numero={2} titulo="Tienda, ubicación y tarifa">
          Para quién repartes, dónde está la tienda y <b className="text-tinta">si vas en auto o en moto</b>: cambia el vehículo en
          toda la app y la tarifa que se aplica.
        </Paso>
        <Paso numero={3} titulo="Comandas y clientes">
          Decides qué se guarda del cliente (nombre, dirección, teléfono, foto) y si el tramo se calcula solo con la distancia.
        </Paso>
        <Paso numero={4} titulo="Bloqueo del dispositivo">
          Un PIN de 4 dígitos y, si quieres, la huella. Así nadie ve tus ingresos si presta tu teléfono.
        </Paso>
        <Paso numero={5} titulo="Respaldo de tus datos">
          «Crear y compartir» genera un archivo que mandas por WhatsApp, Drive o correo. Si cambias de teléfono, lo restauras
          desde la misma sección. Incluye el apoyo y el taxi.
        </Paso>
      </Lista>
      <Nota>Cada sección tiene un icono animado que se mueve como lo que hace: así la encuentras de un vistazo.</Nota>
    </div>
  );
}
