import Link from "next/link";

import { hoyEnLima } from "@/lib/fechas";
import {
  activosPorMes,
  diasRestantes,
  estadoDe,
  formatearSoles,
  ingresosPorMes,
  resumenDelTablero,
  totalPagadoCentimos,
} from "@/lib/licencia/panel";
import { listarLicencias, listarPagos } from "@/lib/licencia/repositorio";
import { haySesion, panelConfigurado } from "@/lib/licencia/sesion";
import { tursoConfigurado } from "@/lib/licencia/turso";

import { EmitirNueva } from "./EmitirNueva";
import { FormularioEntrada } from "./FormularioEntrada";
import { Graficas } from "./Graficas";
import { ListaUsuarios, type FilaLista } from "./ListaUsuarios";
import { Tablero } from "./Tablero";

export const dynamic = "force-dynamic";

function Aviso({ texto }: { texto: React.ReactNode }) {
  return <div className="tarjeta mx-auto mt-16 max-w-md text-center text-sm text-tinta-2">{texto}</div>;
}

export default async function PaginaLicencias() {
  if (!panelConfigurado()) {
    return (
      <Aviso
        texto={
          <>
            Falta poner <span className="codigo">LICENCIAS_PASSWORD</span> en las variables de entorno del servidor.
            Mientras tanto, sigue usando <span className="codigo">npm run licencia</span> por la terminal.
          </>
        }
      />
    );
  }

  if (!(await haySesion())) return <FormularioEntrada />;

  if (!tursoConfigurado()) {
    return (
      <Aviso
        texto={
          <>
            Falta conectar Turso (<span className="codigo">TURSO_DATABASE_URL</span> y{" "}
            <span className="codigo">TURSO_AUTH_TOKEN</span>). Mientras tanto, sigue usando{" "}
            <span className="codigo">npm run licencia -- lista</span> por la terminal.
          </>
        }
      />
    );
  }

  let licencias: Awaited<ReturnType<typeof listarLicencias>>;
  let pagos: Awaited<ReturnType<typeof listarPagos>>;
  try {
    [licencias, pagos] = await Promise.all([listarLicencias(), listarPagos()]);
  } catch (fallo) {
    /* En producción React oculta el mensaje de un error del servidor («error #441»).
       Aquí se atrapa y se enseña lo esencial —sin direcciones ni claves— para saber
       qué variable de Vercel revisar. */
    const detalle = (fallo instanceof Error ? `${fallo.name}: ${fallo.message}` : String(fallo))
      .replace(/(libsql|https?|wss?):\/\/\S+/gi, "<dirección>")
      .replace(/eyJ[\w.-]+/g, "<token>")
      .slice(0, 240);
    return (
      <Aviso
        texto={
          <>
            No se pudo leer la base de licencias (Turso). Revisa en Vercel que{" "}
            <span className="codigo">TURSO_DATABASE_URL</span> y{" "}
            <span className="codigo">TURSO_AUTH_TOKEN</span> estén copiadas tal cual, sin comillas, y vuelve a desplegar.
            <span className="mt-2 block font-mono text-xs break-words">{detalle}</span>
          </>
        }
      />
    );
  }
  const hoy = hoyEnLima();
  const resumen = resumenDelTablero(licencias, pagos, hoy);

  const filas: FilaLista[] = licencias.map((l) => ({
    codigo: l.codigo,
    nombre: l.nombre,
    vigenteHasta: l.vigenteHasta,
    estado: estadoDe(l.vigenteHasta, l.diasDeGracia, hoy),
    restantes: diasRestantes(l.vigenteHasta, hoy),
    totalTexto: formatearSoles(totalPagadoCentimos(pagos.filter((p) => p.codigo === l.codigo))),
  }));

  return (
    <div className="flex flex-col gap-5">
      <EmitirNueva />
      <Tablero r={resumen} />
      <Graficas ingresos={ingresosPorMes(pagos, hoy)} activos={activosPorMes(pagos, hoy)} />
      <ListaUsuarios filas={filas} />
      <div className="flex flex-wrap gap-2">
        {/* <a> y no <Link>: es una descarga, y Link la precargaría (y la auditaría) sin que se pida. */}
        <a className="lic-btn" data-t="suave" href="/licencias/exportar/usuarios" download>
          Exportar usuarios (CSV)
        </a>
        <a className="lic-btn" data-t="suave" href="/licencias/exportar/pagos" download>
          Exportar pagos (CSV)
        </a>
      </div>
      <Link href="/" className="text-sm text-tinta-3">
        ← Control Driver
      </Link>
    </div>
  );
}
