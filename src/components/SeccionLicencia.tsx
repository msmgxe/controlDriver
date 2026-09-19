"use client";

import { useState } from "react";

import { useLicencia } from "@/components/Licencia";
import { useDatos } from "@/hooks/useDatos";
import { activarCertificado, identificadorDelDispositivo } from "@/lib/licencia/almacen";
import { mensajeDeLicencia } from "@/lib/licencia/estado";

/**
 * Tu licencia: en qué estado está, el código de este teléfono y dónde pegar
 * la licencia que te mandan.
 *
 * El recorrido completo, que es lo que esta sección tiene que hacer obvio:
 *
 *   1. copias el código de tu teléfono y se lo mandas a quien administra;
 *   2. pagas, y te devuelve un texto largo por WhatsApp;
 *   3. lo pegas aquí y tocas Activar.
 */
export function SeccionLicencia() {
  const licencia = useLicencia();
  const { datos: codigo } = useDatos(() => identificadorDelDispositivo(), []);
  const [texto, setTexto] = useState("");
  const [copiado, setCopiado] = useState(false);
  const [resultado, setResultado] = useState<{ ok: boolean; texto: string } | null>(null);
  const [activando, setActivando] = useState(false);

  async function copiar() {
    if (!codigo) return;
    try {
      await navigator.clipboard.writeText(codigo);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    } catch {
      setCopiado(false);
    }
  }

  async function activar() {
    setActivando(true);
    setResultado(null);
    try {
      const r = await activarCertificado(texto);
      if (r.ok) {
        setResultado({
          ok: true,
          texto: `Licencia activada hasta el ${r.hasta.split("-").reverse().join("/")}.`,
        });
        // La licencia se resuelve al abrir la app: se recarga para aplicarla ya.
        setTimeout(() => window.location.reload(), 1200);
      } else {
        setResultado({ ok: false, texto: r.error });
      }
    } catch (fallo) {
      setResultado({
        ok: false,
        texto: `No se pudo activar. Detalle: ${fallo instanceof Error ? fallo.message : String(fallo)}`,
      });
    } finally {
      setActivando(false);
    }
  }

  const tono =
    licencia?.estado === "activa"
      ? "bg-bien-suave text-bien"
      : licencia?.estado === "prueba"
        ? "bg-acento-suave text-acento-tinta"
        : "bg-aviso-suave text-aviso";

  return (
    <section className="tarjeta flex flex-col gap-4">
      <h3 className="text-lg">Tu licencia</h3>

      {licencia && (
        <p className={`rounded-btn px-3 py-2 text-sm font-semibold ${tono}`}>
          {licencia.estado === "activa"
            ? `Activa hasta el ${licencia.vigenteHasta?.split("-").reverse().join("/")}.`
            : mensajeDeLicencia(licencia)}
        </p>
      )}

      <div className="flex flex-col gap-1.5">
        <span className="text-sm font-semibold">1. El código de este teléfono</span>
        <div className="flex items-center gap-2">
          <code className="min-w-0 flex-1 truncate rounded-btn bg-sup-2 px-3 py-2.5 font-mono text-xs">
            {codigo ?? "…"}
          </code>
          <button type="button" onClick={() => void copiar()} className="boton-secundario shrink-0">
            {copiado ? "Copiado ✓" : "Copiar"}
          </button>
        </div>
        <span className="text-xs text-tinta-3">
          Mándaselo a quien administra junto con tu pago. La licencia que te devuelva solo sirve en
          este teléfono.
        </span>
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="certificado" className="text-sm font-semibold">
          2. Pega aquí la licencia que te mandaron
        </label>
        <textarea
          id="certificado"
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          rows={4}
          spellCheck={false}
          autoCapitalize="off"
          autoCorrect="off"
          placeholder="eyJ1c3Vhcmlv…"
          className="rounded-btn border border-linea-fuerte bg-sup px-3 py-2 font-mono text-xs"
        />
        <button
          type="button"
          onClick={() => void activar()}
          disabled={activando || texto.trim().length < 40}
          className="boton-principal"
        >
          {activando ? "Comprobando…" : "Activar"}
        </button>
      </div>

      {resultado && (
        <p
          role="status"
          className={`rounded-btn px-3 py-2 text-sm ${
            resultado.ok ? "bg-bien-suave text-bien" : "bg-mal-suave text-mal"
          }`}
        >
          {resultado.texto}
        </p>
      )}
    </section>
  );
}
