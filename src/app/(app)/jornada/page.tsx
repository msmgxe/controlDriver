"use client";

import { Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

import { Acordeon } from "@/components/Acordeon";
import { EditorJornada } from "@/components/EditorJornada";
import { agregarPedidosDeFoto, reordenarRutas } from "./acciones";
import { LectorDePedidos, PedidoManual, PedidosPorCantidad } from "@/components/PedidoManual";
import { PruebasDelDia } from "@/components/PruebasDelDia";
import { BotonReordenar, LectorDeRutas, ListaDeRutas, RutaManual } from "@/components/RutaManual";
import { Flecha } from "@/components/iconos";
import { Vacio, Aviso } from "@/components/ui";
import { useDatos } from "@/hooks/useDatos";
import { jornadaPorFecha, reglaVigente } from "@/lib/db/sqlite/jornadas";
import { estadoDeSemana } from "@/lib/db/sqlite/liquidaciones";
import { borrarRuta, guardarRuta } from "@/lib/db/sqlite/rutas";
import { perfilActual } from "@/lib/db/sqlite/perfil";
import { esFechaISO, formatearFechaLarga, hoyEnLima } from "@/lib/fechas";

/**
 * Detalle de una jornada (§9).
 *
 * Igual que Revisión, pero sobre datos ya guardados: se puede corregir el tramo
 * de un pedido, el horario de permanencia, o borrar el día entero.
 *
 * La fecha viaja como parámetro de consulta (`?fecha=`) y no como parte de la
 * ruta. Dentro del APK no hay servidor que resuelva rutas al vuelo: las
 * páginas son archivos fijos, y una ruta con una fecha dentro exigiría generar
 * de antemano una página por cada día que pueda existir.
 *
 * **Un día sin nada guardado todavía no es un error.** Antes, si `fecha` no
 * tenía ninguna jornada, la pantalla entera se rendía a un "no hay nada
 * aquí" —ni un botón, ni un enlace— y no había forma de llegar a "Añadir un
 * pedido a mano" para ESE día: había que subir una captura primero, aunque
 * fuera precisamente la captura la que faltaba. Ahora esta pantalla se abre
 * igual, con las mismas dos puertas de siempre (a mano, o por cantidad),
 * trabajando sobre un día vacío hasta que el primer pedido lo crea.
 */
export default function PaginaJornada() {
  return (
    <Suspense fallback={<Esqueleto />}>
      <Contenido />
    </Suspense>
  );
}

function Contenido() {
  const params = useSearchParams();
  const fecha = params.get("fecha") ?? "";

  const { datos, cargando, recargar } = useDatos(
    async () => {
      if (!esFechaISO(fecha)) return null;

      const [jornada, perfil, estado] = await Promise.all([
        jornadaPorFecha(fecha),
        perfilActual(),
        estadoDeSemana(fecha),
      ]);
      const { regla } = await reglaVigente(fecha, perfil?.tiendaId ?? null, perfil?.vehiculo);

      return { jornada, regla, estado };
    },
    [fecha],
    // Al agregar el primer pedido de un día vacío, `jornada` pasa de null a
    // no-null: sin conservar, la pantalla entera pasaría por el esqueleto y
    // el acordeón que se acababa de abrir para escribir se cerraría solo.
    { conservar: true },
  );

  if (cargando && !datos) return <Esqueleto />;

  if (!esFechaISO(fecha)) {
    return (
      <div className="mx-auto flex max-w-[880px] flex-col gap-4">
        <VolverAlHistorial />
        <Vacio>Esa fecha no es válida.</Vacio>
      </div>
    );
  }

  if (!datos) return <Esqueleto />;

  const { jornada, regla, estado } = datos;
  // Bloquea solo cuando ya se cobró: cerrar la semana en Pagos congela el
  // monto para poder anotar el pago, pero no debe impedir corregir un pedido
  // que faltó mientras eso no haya pasado todavía.
  const editable = estado !== "pagada";
  const rutas = jornada?.rutas ?? [];
  const ordenes = jornada?.ordenes ?? [];

  return (
    <div className="mx-auto flex max-w-[880px] flex-col gap-4">
      <VolverAlHistorial />

      <div>
        <span className="rotulo">Jornada</span>
        <h2 className="text-[30px] leading-tight capitalize">{formatearFechaLarga(fecha)}</h2>
      </div>

      {!jornada && editable && (
        <Vacio>
          Este día todavía no tiene nada guardado. Añade tus pedidos abajo —a mano, por cantidad, o
          desde una foto— y el día se crea solo con el primero.
        </Vacio>
      )}

      {!jornada && !editable && <Vacio>Este día no tiene nada guardado.</Vacio>}

      {!editable && (
        <Aviso tono="atento" titulo="Esta semana ya está pagada">
          <p>
            El monto liquidado quedó congelado al registrar el pago. Para corregir algo de este
            día —incluido añadir un pedido que faltó— reabre la semana desde Pagos.
          </p>
        </Aviso>
      )}

      {jornada && (
        <EditorJornada
          fecha={fecha}
          jornada={{
            rutas,
            ordenes,
            horaEntrada: jornada.horaEntrada,
            horaSalida: jornada.horaSalida,
          }}
          regla={regla}
          editable={editable}
          esHoy={fecha === hoyEnLima()}
          alCambiar={recargar}
        />
      )}

      {editable && (
        <Acordeon
          titulo="Rutas del día"
          resumen={`${rutas.length} ${rutas.length === 1 ? "ruta" : "rutas"}`}
          abiertoPorDefecto={!jornada}
        >
          <div className="flex flex-col gap-3">
            {/* Sin esto no hay dónde elegir la ruta de un pedido: si la
                captura salió cortada o el día se escribió entero a mano, la
                lista de rutas está vacía y el selector de "Añadir un pedido"
                no tiene nada que ofrecer. */}
            <ListaDeRutas
              rutas={rutas.map((r) => ({
                numero: r.numero,
                horaInicio: r.horaInicio,
                horaFin: r.horaFin,
              }))}
              onBorrar={(numero) => {
                const ruta = rutas.find((r) => r.numero === numero);
                if (ruta) void borrarRuta(ruta.id).then(recargar);
              }}
            />
            <RutaManual
              siguienteNumero={Math.max(0, ...rutas.map((r) => r.numero)) + 1}
              onGuardar={(datos) => void guardarRuta(fecha, datos).then(recargar)}
            />
            {/* La fecha se puede elegir: desde el detalle de un día puede
                llegar la foto de la ruta de *otro* día que faltó cargar. */}
            <LectorDeRutas
              fecha={fecha}
              onLeidas={async (fechaElegida, rutasLeidas) => {
                for (const r of rutasLeidas) await guardarRuta(fechaElegida, r);
                if (fechaElegida === fecha) recargar();
              }}
            />
            {rutas.length > 1 && (
              <BotonReordenar
                onConfirmar={async () => {
                  await reordenarRutas(fecha);
                  recargar();
                }}
              />
            )}
          </div>
        </Acordeon>
      )}

      {editable && (
        <Acordeon
          titulo="Añadir un pedido"
          resumen="A mano, por cantidad, o desde una foto"
          abiertoPorDefecto={!jornada}
        >
          <div className="flex flex-col gap-3">
            <PedidoManual fecha={fecha} regla={regla} rutas={rutas.map((r) => r.numero)} alAgregar={recargar} />
            {/* Para cuando no se tiene ni el código a mano: se anota cuántos
                fueron y se completa cada uno después. La fecha también se
                puede elegir, para ponerse al día con una jornada pasada que
                se quedó sin captura a tiempo. */}
            <PedidosPorCantidad
              fecha={fecha}
              alAgregar={(fechaElegida) => {
                if (fechaElegida === fecha) recargar();
              }}
            />
            {/* Igual que con las rutas, la fecha se puede elegir. Los pedidos
                que ya estaban registrados no se vuelven a añadir. */}
            <LectorDePedidos
              fecha={fecha}
              onGuardar={async (fechaElegida, pedidos) => {
                const r = await agregarPedidosDeFoto(fechaElegida, pedidos);
                if (!r.ok) throw new Error(r.error);
                return { nuevos: r.nuevos, repetidos: r.repetidos.length };
              }}
              alTerminar={(fechaElegida) => {
                if (fechaElegida === fecha) recargar();
              }}
            />
          </div>
        </Acordeon>
      )}

      {jornada && (
        <Acordeon titulo="Capturas de este día" resumen="Tu respaldo si hay que reclamar">
          <PruebasDelDia fecha={fecha} />
        </Acordeon>
      )}
    </div>
  );
}

function VolverAlHistorial() {
  return (
    <Link
      href="/historial"
      className="inline-flex items-center gap-2 self-start text-sm text-tinta-2 hover:text-tinta"
    >
      <Flecha className="size-4 rotate-180" />
      Historial
    </Link>
  );
}

function Esqueleto() {
  return (
    <div className="mx-auto flex max-w-[880px] animate-pulse flex-col gap-4" aria-hidden>
      <div className="h-5 w-24 rounded bg-sup-2" />
      <div className="h-8 w-72 rounded bg-sup-2" />
      <div className="h-[420px] rounded-card bg-sup-2" />
    </div>
  );
}
