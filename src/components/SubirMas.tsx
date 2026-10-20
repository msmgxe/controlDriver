"use client";

import { useState } from "react";

import {
  agregarPedidosDeFoto,
  reordenarRutas,
} from "@/app/(app)/jornada/acciones";
import { Flecha, Reloj, Taxi, Ticket } from "@/components/iconos";
import { ProveedorDeOpcion } from "@/components/OpcionActiva";
import {
  LectorDePedidos,
  PedidoManual,
  PedidosPorCantidad,
} from "@/components/PedidoManual";
import { Pestanas } from "@/components/Pestanas";
import {
  BotonReordenar,
  LectorDeRutas,
  RutaManual,
} from "@/components/RutaManual";
import { Aviso } from "@/components/ui";
import type { JornadaCompleta } from "@/lib/db/tipos";
import { guardarRuta } from "@/lib/db/sqlite/rutas";
import type { FechaISO } from "@/lib/fechas";
import type { ReglaPago } from "@/lib/pagos/reglas";

/**
 * «Subir más»: las otras formas de meter datos en un día, en tres pestañas,
 * una por tipo de cosa que se sube:
 *
 *   · **Pedidos** — de una **comanda** (la hoja de despacho, con su cliente y
 *     su dirección), por cantidad, a mano o de una foto de la lista.
 *   · **Rutas** — a mano, de una foto, o reordenarlas por hora.
 *   · **Taxi y apoyo** — lo que no es de la tienda de siempre: una carrera de
 *     taxi suelta, o haber cubierto a otra tienda.
 *
 * Todas las opciones son filas del mismo tamaño (`boton-fila`).
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
  alAgregarBloque,
}: {
  fecha: FechaISO;
  jornada: JornadaCompleta | null;
  regla: ReglaPago;
  /** Falso en una semana ya pagada: no se puede añadir nada por debajo de una liquidación. */
  editable: boolean;
  alCambiar: () => void;
  alLeerComanda: () => void;
  /** Abre la hoja de apoyo o de taxi, para el día que se está mirando. */
  alAgregarBloque: (tipo: "apoyo" | "taxi") => void;
}) {
  const [pestana, setPestana] = useState("pedido");
  const [activa, setActiva] = useState<string | null>(null);
  const rutas = jornada?.rutas ?? [];

  if (!editable) {
    return (
      <Aviso tono="atento" titulo="Esta semana ya está pagada">
        <p>
          El monto liquidado quedó congelado al registrar el pago. Para añadir
          algo a este día, reabre la semana desde Pagos.
        </p>
      </Aviso>
    );
  }

  return (
    <>
      <Pestanas
        etiqueta="Qué subir"
        actual={pestana}
        alCambiar={(id) => {
          setPestana(id);
          setActiva(null);
        }}
        items={[
          { id: "pedido", etiqueta: "Pedidos" },
          { id: "ruta", etiqueta: "Rutas" },
          { id: "otros", etiqueta: "Adicionales y apoyo" },
        ]}
      />

      {/* Con una opción abierta, las demás se esconden y arriba queda el camino
          de vuelta: así se sabe de qué botón viene el formulario. */}
      {activa !== null && (pestana === "pedido" || pestana === "ruta") && (
        <button
          type="button"
          onClick={() => setActiva(null)}
          className="inline-flex min-h-10 items-center gap-1.5 self-start rounded-btn px-2 text-sm font-semibold text-acento-tinta"
        >
          <Flecha className="size-4 rotate-180" />
          Otras formas de {pestana === "pedido" ? "anotar" : "añadir"}
        </button>
      )}

      {pestana === "pedido" && (
        <ProveedorDeOpcion activa={activa} fijar={setActiva}>
          <div className="flex flex-col gap-2.5">
            {activa === null && (
              <p className="text-xs text-tinta-3">
                Pedidos de tu tienda. Elige cómo quieres anotarlos.
              </p>
            )}
            {/* Primero la más completa: una foto por pedido, con cliente, dirección
              y distancia. Completa un pedido que ya está o crea uno nuevo. */}
            {activa === null && (
              <button
                type="button"
                onClick={alLeerComanda}
                className="boton-fila"
              >
                <Ticket className="size-[18px]" />
                Leer una comanda
              </button>
            )}
            {/* Para cuando no se tiene ni el código a mano: se anota cuántos fueron
              y se completa cada uno después. La fecha también se puede elegir,
              para ponerse al día con una jornada pasada. */}
            <PedidosPorCantidad
              fecha={fecha}
              alAgregar={(fechaElegida) => {
                if (fechaElegida === fecha) alCambiar();
              }}
            />
            <PedidoManual
              fecha={fecha}
              regla={regla}
              rutas={rutas.map((r) => r.numero)}
              alAgregar={alCambiar}
            />
            {/* Al final: lee la lista de códigos de la app de reparto, sin cliente
              ni dirección. Igual que con las rutas, la fecha se puede elegir; los
              pedidos que ya estaban registrados no se vuelven a añadir. */}
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
          </div>
        </ProveedorDeOpcion>
      )}

      {pestana === "ruta" && (
        <ProveedorDeOpcion activa={activa} fijar={setActiva}>
          <div className="flex flex-col gap-2.5">
            {activa === null && (
              <p className="text-xs text-tinta-3">
                Las salidas a repartir de tu tienda, con su hora.
              </p>
            )}
            {/* Sin esto no hay dónde elegir la ruta de un pedido: si la captura salió
              cortada o el día se escribió entero a mano, la lista de rutas está
              vacía y el selector de pedidos no tiene nada que ofrecer. */}
            <RutaManual
              siguienteNumero={Math.max(0, ...rutas.map((r) => r.numero)) + 1}
              onGuardar={(datos) =>
                void guardarRuta(fecha, datos).then(alCambiar)
              }
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
            {activa === null && rutas.length > 1 && (
              <BotonReordenar
                onConfirmar={async () => {
                  await reordenarRutas(fecha);
                  alCambiar();
                }}
              />
            )}
          </div>
        </ProveedorDeOpcion>
      )}

      {pestana === "otros" && (
        <div className="flex flex-col gap-2.5">
          <p className="text-xs text-tinta-3">
            Lo que no es de tu tienda de siempre. Se suma al total del día,
            aparte de tus pedidos.
          </p>
          <button
            type="button"
            onClick={() => alAgregarBloque("taxi")}
            className="boton-fila"
          >
            <Taxi className="size-[18px]" />
            Adicional (taxi, movilidad…)
          </button>
          <button
            type="button"
            onClick={() => alAgregarBloque("apoyo")}
            className="boton-fila"
          >
            <Reloj className="size-[18px]" />
            Apoyo a otra tienda
          </button>
        </div>
      )}
    </>
  );
}
