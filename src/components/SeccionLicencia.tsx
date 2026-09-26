"use client";

import { useState } from "react";

import { Acordeon } from "@/components/Acordeon";
import { useLicencia } from "@/components/Licencia";
import { useDatos } from "@/hooks/useDatos";
import { activarCertificado, identificadorDelDispositivo } from "@/lib/licencia/almacen";
import { mensajeDeLicencia, type EstadoLicencia } from "@/lib/licencia/estado";

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
    <Acordeon
      titulo="Licencia"
      resumen={resumenDeLicencia(licencia)}
      aviso={licencia?.estado === "gracia" || licencia?.estado === "vencida" || licencia?.estado === "sin_licencia"}
    >
      {licencia && (
        <p className={`rounded-btn px-3 py-2 text-sm font-semibold ${tono}`}>
          {licencia.estado === "activa"
            ? `Activa hasta el ${licencia.vigenteHasta?.split("-").reverse().join("/")}.`
            : mensajeDeLicencia(licencia)}
        </p>
      )}

      {/* Los tres tramos de un mes, de la infografía: mismo dibujo, ahora en
          la propia app y no solo explicándola desde fuera. */}
      <LineaDeLicencia estado={licencia?.estado} />

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
    </Acordeon>
  );
}

/** Lo esencial de la licencia, para leerlo sin abrir el acordeón. */
function resumenDeLicencia(licencia: ReturnType<typeof useLicencia>): string {
  if (!licencia) return "…";
  switch (licencia.estado) {
    case "activa":
      return `Activa hasta el ${licencia.vigenteHasta?.split("-").reverse().join("/")}`;
    case "prueba":
      return "En prueba";
    case "gracia":
      return "En gracia: renuévala pronto";
    case "vencida":
      return "Vencida · solo lectura";
    default:
      return "Sin licencia";
  }
}

/**
 * Los tramos de un mes, como una barra segmentada.
 *
 * El mismo dibujo de la infografía ("La licencia, mes a mes"): un tramo
 * activo, siete días de gracia, y solo lectura. El tramo en el que está
 * ahora mismo esta licencia se resalta, para que el esquema deje de ser una
 * explicación abstracta y pase a decir "estás aquí".
 */
function LineaDeLicencia({ estado }: { estado?: EstadoLicencia }) {
  const activo = estado === "activa" || estado === "prueba";
  const enGracia = estado === "gracia";
  const soloLectura = estado === "vencida" || estado === "sin_licencia";

  return (
    <div
      role="img"
      aria-label="Un mes pagado con todo activo, luego siete días de gracia, y después solo lectura."
      className="flex min-h-14 overflow-hidden rounded-btn text-[13px] font-semibold"
    >
      <Tramo etiqueta="Mes pagado" detalle="todo funciona" peso={30} activo={activo}
        clases="bg-acento text-acento-texto" />
      <Tramo etiqueta="7 días de gracia" peso={11} activo={enGracia}
        clases="bg-aviso-suave text-aviso" />
      <Tramo etiqueta="Solo lectura" peso={13} activo={soloLectura}
        clases="bg-sup-2 text-tinta-2" />
    </div>
  );
}

function Tramo({
  etiqueta,
  detalle,
  peso,
  activo,
  clases,
}: {
  etiqueta: string;
  detalle?: string;
  peso: number;
  activo: boolean;
  clases: string;
}) {
  return (
    <div
      style={{ flex: peso }}
      className={`grid place-items-center px-2 py-2 text-center leading-tight ${clases} ${
        activo ? "" : "opacity-45"
      }`}
    >
      <span>
        {etiqueta}
        {detalle && <span className="block font-normal opacity-80">{detalle}</span>}
      </span>
    </div>
  );
}
