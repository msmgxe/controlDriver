"use client";

import { useActionState, useState, useTransition } from "react";

import { formatearFecha } from "@/lib/fechas";
import { formatearSoles, textoDuracion, type FilaPago } from "@/lib/licencia/panel";

import { actualizarContacto, anularUltimoPago, mensajeDeWhatsApp, renovarLicencia } from "./acciones";
import { Campo, CamposDePago } from "./Campos";
import { BotonCopiar } from "./Copiar";
import { ResultadoFirma } from "./ResultadoFirma";
import { ESTADO_VACIO, type Estado } from "./tipos";

export function Renovar({ codigo, nombre }: { codigo: string; nombre: string }) {
  const [estado, accion, pendiente] = useActionState(renovarLicencia, ESTADO_VACIO);
  return (
    <form action={accion} className="tarjeta flex flex-col gap-3">
      <h2 className="text-lg font-semibold">Renovar</h2>
      <input type="hidden" name="codigo" value={codigo} />
      <input type="hidden" name="nombre" value={nombre} />
      <div className="lic-rejilla">
        <CamposDePago prefijo="r" />
      </div>
      <p className="text-xs text-tinta-3">Si todavía le quedaban días, el mes nuevo se suma a lo que tenía.</p>
      {estado.error && <p className="lic-error">{estado.error}</p>}
      <button type="submit" className="lic-btn" data-t="principal" disabled={pendiente}>
        {pendiente ? "Firmando…" : "Renovar y registrar pago"}
      </button>
      {estado.resultado && <ResultadoFirma r={estado.resultado} />}
    </form>
  );
}

/** Mensaje de WhatsApp sin pago nuevo (para quien perdió el suyo) y copiar el código. */
export function MensajeYCodigo({ codigo }: { codigo: string }) {
  const [estado, setEstado] = useState<Estado>(ESTADO_VACIO);
  const [pendiente, iniciar] = useTransition();
  return (
    <div className="tarjeta flex flex-col gap-3">
      <h2 className="text-lg font-semibold">Mensaje para WhatsApp</h2>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className="lic-btn"
          data-t="verde"
          disabled={pendiente}
          onClick={() => iniciar(async () => setEstado(await mensajeDeWhatsApp(codigo)))}
        >
          {pendiente ? "Firmando…" : "Preparar mensaje para WhatsApp"}
        </button>
        <BotonCopiar texto={codigo} etiqueta="Copiar código" />
      </div>
      <p className="text-xs text-tinta-3">Vuelve a firmar la fecha actual, sin cobrar ni alargar nada.</p>
      {estado.error && <p className="lic-error">{estado.error}</p>}
      {estado.resultado && <ResultadoFirma r={estado.resultado} />}
    </div>
  );
}

/** Anular el último pago, en dos pasos: primero se muestra qué se anulará, luego se confirma. */
export function AnularPago({ codigo, ultimo }: { codigo: string; ultimo: FilaPago | null }) {
  const [paso, setPaso] = useState<1 | 2>(1);
  const [estado, setEstado] = useState<Estado>(ESTADO_VACIO);
  const [pendiente, iniciar] = useTransition();
  if (!ultimo) return null;

  return (
    <div className="tarjeta flex flex-col gap-3">
      <h2 className="text-lg font-semibold">Deshacer el último pago</h2>
      {paso === 1 ? (
        <button type="button" className="lic-btn self-start" data-t="peligro-suave" onClick={() => setPaso(2)}>
          Anular último pago…
        </button>
      ) : (
        <div className="flex flex-col gap-3 rounded-btn bg-mal-suave p-3">
          <p className="text-sm font-semibold text-mal">
            ¿Anular el pago del {formatearFecha(ultimo.fecha)} ({textoDuracion(ultimo.duracion)}
            {ultimo.montoCentimos !== null ? `, ${formatearSoles(ultimo.montoCentimos)}` : ""})? La vigencia vuelve al pago anterior. El mensaje que ya
            enviaste seguirá funcionando en su teléfono.
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="lic-btn"
              data-t="peligro"
              disabled={pendiente}
              onClick={() => iniciar(async () => setEstado(await anularUltimoPago(codigo, ultimo.id)))}
            >
              {pendiente ? "Anulando…" : "Sí, anular"}
            </button>
            <button type="button" className="lic-btn" data-t="suave" onClick={() => setPaso(1)}>
              No, dejarlo
            </button>
          </div>
        </div>
      )}
      {estado.error && <p className="lic-error">{estado.error}</p>}
      {estado.aviso && <p className="lic-aviso-ok">{estado.aviso}</p>}
    </div>
  );
}

export function Contacto({
  codigo,
  nombre,
  telefono,
  notas,
}: {
  codigo: string;
  nombre: string;
  telefono: string | null;
  notas: string | null;
}) {
  const [estado, accion, pendiente] = useActionState(actualizarContacto, ESTADO_VACIO);
  return (
    <form action={accion} className="tarjeta flex flex-col gap-3">
      <h2 className="text-lg font-semibold">Contacto y notas</h2>
      <input type="hidden" name="codigo" value={codigo} />
      <div className="lic-rejilla">
        <Campo id="c-nombre" etiqueta="Nombre">
          <input id="c-nombre" name="nombre" defaultValue={nombre} required maxLength={80} />
        </Campo>
        <Campo id="c-telefono" etiqueta="WhatsApp">
          <input id="c-telefono" name="telefono" defaultValue={telefono ?? ""} inputMode="tel" />
        </Campo>
      </div>
      <Campo id="c-notas" etiqueta="Notas">
        <textarea id="c-notas" name="notas" rows={3} maxLength={500} defaultValue={notas ?? ""} />
      </Campo>
      {estado.error && <p className="lic-error">{estado.error}</p>}
      {estado.aviso && <p className="lic-aviso-ok">{estado.aviso}</p>}
      <button type="submit" className="lic-btn self-start" data-t="suave" disabled={pendiente}>
        {pendiente ? "Guardando…" : "Guardar"}
      </button>
    </form>
  );
}
