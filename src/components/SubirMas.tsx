"use client";

import { useState } from "react";

import { agregarPedidosDeFoto, reordenarRutas } from "@/app/(app)/jornada/acciones";
import { Ticket } from "@/components/iconos";
import { LectorDePedidos, PedidoManual, PedidosPorCantidad } from "@/components/PedidoManual";
import { Pestanas } from "@/components/Pestanas";
import { BotonReordenar, LectorDeRutas, RutaManual } from "@/components/RutaManual";
import { Aviso } from "@/components/ui";
import type { JornadaCompleta } from "@/lib/db/tipos";
import { guardarRuta } from "@/lib/db/sqlite/rutas";
import type { FechaISO } from "@/lib/fechas";
import type { ReglaPago } from "@/lib/pagos/reglas";

/**
 * «Subir más»: las otras formas de meter datos en un día, en dos pestañas.
 *
 *   · **Pedido** — a mano, por cantidad, de una foto de la lista, o de una
 *     **comanda** (la hoja de despacho, con su cliente y su dirección).
 *   · **Ruta** — a mano, de una foto, o reordenarlas por hora.
 *
 * Es lo mismo que antes estaba en la pantalla de la jornada, sin cambios de
 * fondo: cada formulario se abre solo cuando se toca su botón.
 */
export function SubirMas({
  fecha,
  jornada,
  regla,
  editable,
  alCambiar,
  alLeerComanda,
}: {
  fecha: FechaISO;
  jornada: JornadaCompleta | null;
  regla: ReglaPago;
  /** Falso en una semana ya pagada: no se puede añadir nada por debajo de una liquidación. */
  editable: boolean;
  alCambiar: () => void;
  alLeerComanda: () => void;
}) {
  const [pestana, setPestana] = useState("pedido");
  const rutas = jornada?.rutas ?? [];

  if (!editable) {
    return (
      <Aviso tono="atento" titulo="Esta semana ya está pagada">
        <p>
          El monto liquidado quedó congelado al registrar el pago. Para añadir algo a este día, reabre la semana desde
          Pagos.
        </p>
      </Aviso>
    );
  }

  return (
    <>
      <Pestanas
        etiqueta="Qué subir"
        actual={pestana}
        alCambiar={setPestana}
        items={[
          { id: "pedido", etiqueta: "Pedido" },
          { id: "ruta", etiqueta: "Ruta" },
        ]}
      />

      {pestana === "pedido" && (
        <div className="flex flex-col gap-3">
          <PedidoManual fecha={fecha} regla={regla} rutas={rutas.map((r) => r.numero)} alAgregar={alCambiar} />
          {/* Para cuando no se tiene ni el código a mano: se anota cuántos fueron
              y se completa cada uno después. La fecha también se puede elegir,
              para ponerse al día con una jornada pasada. */}
          <PedidosPorCantidad
            fecha={fecha}
            alAgregar={(fechaElegida) => {
              if (fechaElegida === fecha) alCambiar();
            }}
          />
          {/* Igual que con las rutas, la fecha se puede elegir. Los pedidos que
              ya estaban registrados no se vuelven a añadir. */}
          <LectorDePedidos
            fecha={fecha}
            onGuardar={async (fechaElegida, pedidos) => {
              const r = await agregarPedidosDeFoto(fechaElegida, pedidos);
              if (!r.ok) throw new Error(r.error);
              return { nuevos: r.nuevos, repetidos: r.repetidos.length };
            }}
            alTerminar={(fechaElegida) => {
              if (fechaElegida === fecha) alCambiar();
            }}
          />
          {/* La comanda: una foto por pedido, con su cliente, su dirección y la
              distancia. Completa un pedido que ya está o crea uno nuevo. */}
          <button type="button" onClick={alLeerComanda} className="boton-secundario self-start">
            <Ticket className="size-[18px]" />
            Leer una comanda
          </button>
        </div>
      )}

      {pestana === "ruta" && (
        <div className="flex flex-col gap-3">
          {/* Sin esto no hay dónde elegir la ruta de un pedido: si la captura salió
              cortada o el día se escribió entero a mano, la lista de rutas está
              vacía y el selector de pedidos no tiene nada que ofrecer. */}
          <RutaManual
            siguienteNumero={Math.max(0, ...rutas.map((r) => r.numero)) + 1}
            onGuardar={(datos) => void guardarRuta(fecha, datos).then(alCambiar)}
          />
          {/* La fecha se puede elegir: desde el detalle de un día puede llegar la
              foto de la ruta de *otro* día que faltó cargar. */}
          <LectorDeRutas
            fecha={fecha}
            onLeidas={async (fechaElegida, rutasLeidas) => {
              for (const r of rutasLeidas) await guardarRuta(fechaElegida, r);
              if (fechaElegida === fecha) alCambiar();
            }}
          />
          {rutas.length > 1 && (
            <BotonReordenar
              onConfirmar={async () => {
                await reordenarRutas(fecha);
                alCambiar();
              }}
            />
          )}
        </div>
      )}
    </>
  );
}
