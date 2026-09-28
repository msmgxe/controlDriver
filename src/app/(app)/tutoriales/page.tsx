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
          Guías cortas, paso a paso. Toca un tema para abrirlo.
        </p>
      </div>

      <Acordeon titulo="Cómo registrar tus pedidos por día" resumen="La forma normal: subir capturas y confirmar">
        <TutorialRegistrarPedidos />
      </Acordeon>
    </div>
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
        Hay dos caminos para que un pedido quede registrado: <b className="text-tinta">subir la captura</b> de la
        app de reparto —lo normal, cuando terminas el día— o <b className="text-tinta">añadirlo aparte</b>, para lo
        que se escapó o llegó distinto. Los dos terminan en el mismo lugar: el pedido, con su código, su ruta y su
        monto, contando para tu pago de la semana.
      </p>

      <div>
        <h4 className="mb-2 text-xs font-bold tracking-wide text-tinta uppercase">El camino normal</h4>
        <ol className="flex flex-col gap-3">
          <Paso numero={1} titulo="Elige el día en Inicio">
            La tira de días de arriba manda: toca el que quieres cargar. Por defecto es hoy.
          </Paso>
          <Paso numero={2} titulo='Toca "Cargar capturas"'>
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

      <div>
        <h4 className="mb-2 text-xs font-bold tracking-wide text-tinta uppercase">
          Cuando falta un pedido, o no hay captura
        </h4>
        <p className="mb-2">
          En el día, abre el acordeón <b className="text-tinta">«Subir más»</b> —la cabecera oscura, fácil de
          encontrar— y dentro, la pestaña <b className="text-tinta">Pedido</b>. Ahí hay cuatro formas, de la más
          completa a la más simple:
        </p>
        <ul className="flex flex-col gap-2">
          <li>
            <b className="text-tinta">Leer una comanda:</b> toma o elige la foto de la hoja de despacho. Lee el
            número de pedido, el cliente, el teléfono y la dirección; con la dirección, calcula sola cuánto se
            cobra.
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
