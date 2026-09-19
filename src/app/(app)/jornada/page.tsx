"use client";

import { Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

import { Acordeon } from "@/components/Acordeon";
import { EditorJornada } from "@/components/EditorJornada";
import { PedidoManual } from "@/components/PedidoManual";
import { PruebasDelDia } from "@/components/PruebasDelDia";
import { Flecha } from "@/components/iconos";
import { Aviso, Vacio } from "@/components/ui";
import { useDatos } from "@/hooks/useDatos";
import { jornadaPorFecha, reglaVigente } from "@/lib/db/sqlite/jornadas";
import { estadoDeSemana } from "@/lib/db/sqlite/liquidaciones";
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

  const { datos, cargando, recargar } = useDatos(async () => {
    if (!esFechaISO(fecha)) return null;

    const jornada = await jornadaPorFecha(fecha);
    if (!jornada) return null;

    const perfil = await perfilActual();
    const [{ regla }, estado] = await Promise.all([
      reglaVigente(fecha, perfil?.tiendaId ?? null, perfil?.vehiculo),
      estadoDeSemana(fecha),
    ]);

    return { jornada, regla, estado };
  }, [fecha]);

  if (cargando) return <Esqueleto />;

  if (!datos) {
    return (
      <div className="mx-auto flex max-w-[880px] flex-col gap-4">
        <VolverAlHistorial />
        <Vacio>No hay ninguna jornada guardada en esa fecha.</Vacio>
      </div>
    );
  }

  const { jornada, regla, estado } = datos;
  const editable = estado === "abierta";

  return (
    <div className="mx-auto flex max-w-[880px] flex-col gap-4">
      <VolverAlHistorial />

      <div>
        <span className="rotulo">Jornada</span>
        <h2 className="text-[30px] leading-tight capitalize">{formatearFechaLarga(fecha)}</h2>
      </div>

      {!editable && (
        <Aviso tono="atento" titulo={`Esta semana está ${estado}`}>
          <p>
            El monto liquidado está congelado. Para corregir algo de este día, reabre la semana
            desde Pagos.
          </p>
        </Aviso>
      )}

      <EditorJornada
        fecha={fecha}
        jornada={{
          rutas: jornada.rutas,
          ordenes: jornada.ordenes,
          horaEntrada: jornada.horaEntrada,
          horaSalida: jornada.horaSalida,
        }}
        regla={regla}
        editable={editable}
        esHoy={fecha === hoyEnLima()}
      />

      {editable && (
        <Acordeon
          titulo="Añadir un pedido"
          resumen="Cuando no salió en ninguna captura"
        >
          <PedidoManual
            fecha={fecha}
            regla={regla}
            rutas={jornada.rutas.map((r) => r.numero)}
            alAgregar={recargar}
          />
        </Acordeon>
      )}

      <Acordeon titulo="Capturas de este día" resumen="Tu respaldo si hay que reclamar">
        <PruebasDelDia fecha={fecha} />
      </Acordeon>
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
