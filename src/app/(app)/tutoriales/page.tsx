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
          Guías cortas, paso a paso. Toca un tema para abrirlo.
        </p>
      </div>

      <Acordeon
        titulo="Cómo registrar tus pedidos por día: resumen y foto"
        resumen="Los dos botones de Inicio, y qué hace cada uno"
      >
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
        En Inicio hay <b className="text-tinta">dos botones</b>, uno junto al otro y de distinto color a
        propósito, para los dos momentos en que se registra un pedido: al terminar el día, con todo junto, o
        pedido por pedido, apenas lo entregas. Elige el que va con tu forma de trabajar; los dos terminan en el
        mismo lugar, contando para tu pago de la semana.
      </p>

      <Link href="/?tour=registrar" className="boton-sec self-start !text-sm">
        ▶ Ver el recorrido guiado
      </Link>

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
          En el día, abre el acordeón <b className="text-tinta">«Subir más»</b> —la cabecera oscura, fácil de
          encontrar— y dentro, la pestaña <b className="text-tinta">Pedido</b>. Ahí hay cuatro formas, de la más
          completa a la más simple:
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
