import Link from "next/link";
import { notFound } from "next/navigation";

import { formatearFecha, hoyEnLima } from "@/lib/fechas";
import {
  diasRestantes,
  estadoDe,
  ETIQUETA_ESTADO,
  formatearSoles,
  textoDuracion,
  textoVence,
  totalPagadoCentimos,
  ultimoPagoValido,
} from "@/lib/licencia/panel";
import { obtenerLicencia, pagosDe, ultimaAuditoria } from "@/lib/licencia/repositorio";
import { haySesion, panelConfigurado } from "@/lib/licencia/sesion";
import { tursoConfigurado } from "@/lib/licencia/turso";
import { esquemaCodigo } from "@/lib/licencia/validar";

import { FormularioEntrada } from "../FormularioEntrada";
import { AnularPago, Contacto, MensajeYCodigo, Renovar } from "../FichaAcciones";

export const dynamic = "force-dynamic";

/** La ficha de un usuario: estado, historial de pagos y acciones. */
export default async function FichaDeUsuario({ params }: { params: Promise<{ codigo: string }> }) {
  const { codigo: crudo } = await params;
  const c = esquemaCodigo.safeParse(crudo);
  if (!c.success) notFound();

  if (!panelConfigurado() || !(await haySesion())) return <FormularioEntrada />;
  if (!tursoConfigurado()) notFound();

  const licencia = await obtenerLicencia(c.data);
  if (!licencia) notFound();

  const [pagos, auditoria] = await Promise.all([pagosDe(licencia.codigo), ultimaAuditoria(200)]);
  const hoy = hoyEnLima();
  const estado = estadoDe(licencia.vigenteHasta, licencia.diasDeGracia, hoy);
  const restantes = diasRestantes(licencia.vigenteHasta, hoy);
  const ultimo = ultimoPagoValido(pagos);
  const movimientos = auditoria.filter((a) => a.codigo === licencia.codigo).slice(0, 8);

  return (
    <div className="flex flex-col gap-4">
      <Link href="/licencias" className="text-sm text-tinta-2">
        ← Todos los usuarios
      </Link>

      <section className="tarjeta flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="font-display text-2xl">{licencia.nombre}</h2>
          <span className="lic-pildora" data-e={estado}>
            {ETIQUETA_ESTADO[estado]}
          </span>
        </div>
        <p className="text-sm text-tinta-2">
          Vigente hasta el {formatearFecha(licencia.vigenteHasta)} ({textoVence(restantes)}) · Total pagado{" "}
          <b className="monto">{formatearSoles(totalPagadoCentimos(pagos))}</b>
          {licencia.creadaEn && <> · Alta {formatearFecha(licencia.creadaEn)}</>}
        </p>
        <p className="break-all text-xs text-tinta-3">
          Código: <span className="codigo">{licencia.codigo}</span>
        </p>
      </section>

      <Renovar codigo={licencia.codigo} nombre={licencia.nombre} />
      <MensajeYCodigo codigo={licencia.codigo} />

      <section className="tarjeta flex flex-col gap-2">
        <h2 className="text-lg font-semibold">Historial de pagos</h2>
        {pagos.length === 0 ? (
          <p className="text-sm text-tinta-3">Sin pagos registrados.</p>
        ) : (
          <div className="lic-tabla-scroll">
            <table className="tabla min-w-[480px]">
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Duración</th>
                  <th>Hasta</th>
                  <th className="num">Monto</th>
                  <th>Método</th>
                </tr>
              </thead>
              <tbody>
                {[...pagos].reverse().map((p) => (
                  <tr key={p.id} className={p.anuladoEn ? "lic-anulado" : undefined}>
                    <td>{formatearFecha(p.fecha)}</td>
                    <td>{textoDuracion(p.duracion)}</td>
                    <td>{formatearFecha(p.hasta)}</td>
                    <td className="num">{p.montoCentimos === null ? "—" : formatearSoles(p.montoCentimos)}</td>
                    <td>{p.anuladoEn ? "anulado" : (p.metodo ?? "—")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <AnularPago codigo={licencia.codigo} ultimo={ultimo} />
      <Contacto codigo={licencia.codigo} nombre={licencia.nombre} telefono={licencia.telefono} notas={licencia.notas} />

      {movimientos.length > 0 && (
        <section className="tarjeta flex flex-col gap-1">
          <h2 className="text-lg font-semibold">Movimientos recientes</h2>
          {movimientos.map((m, i) => (
            <p key={i} className="text-xs text-tinta-3">
              {m.fecha.slice(0, 16).replace("T", " ")} UTC · {m.accion} · {m.ip}
            </p>
          ))}
        </section>
      )}
    </div>
  );
}
