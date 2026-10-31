"use client";

import { useState } from "react";

import { Acordeon } from "@/components/Acordeon";
import { Auto } from "@/components/Auto";
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
/**
 * La licencia dentro de lo que se pegó. Acepta el mensaje entero de WhatsApp
 * («Tu licencia de Control Driver. Ábrela en…») o solo el texto largo, y se
 * queda con ese texto largo, que empieza por «eyJ».
 */
function extraerLicencia(pegado: string): string | null {
  return /eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}/.exec(pegado)?.[0] ?? null;
}

/** El código de un teléfono (un UUID) no es una licencia: es lo que se manda para pedirla. */
const parecidoACodigo = (t: string) => /^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(t.trim());

export function SeccionLicencia() {
  const licencia = useLicencia();
  const { datos: codigo } = useDatos(() => identificadorDelDispositivo(), []);
  const [texto, setTexto] = useState("");
  const [copiado, setCopiado] = useState(false);
  const [resultado, setResultado] = useState<{ ok: boolean; texto: string } | null>(null);
  const [activando, setActivando] = useState(false);

  const licenciaPegada = extraerLicencia(texto);

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
      const r = await activarCertificado(licenciaPegada ?? texto);
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
      icono="llave"
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

      {/* Los tres tramos de un mes, ilustrados con el auto en su posición. */}
      <LineaDeLicencia estado={licencia?.estado} diasRestantes={licencia?.diasRestantes} />

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
        {parecidoACodigo(texto) ? (
          <p role="status" className="rounded-btn bg-aviso-suave px-3 py-2 text-sm text-aviso">
            Eso es un <b>código de teléfono</b>, no una licencia. La licencia es un texto largo que empieza por{" "}
            <b className="font-mono">eyJ</b>: pídela mandando el código de arriba y pega aquí lo que te devuelvan.
          </p>
        ) : texto.trim() !== "" && licenciaPegada === null ? (
          <p role="status" className="text-xs text-tinta-3">
            Todavía no veo una licencia ahí. Pega el texto largo completo (empieza por «eyJ»); si te mandaron el mensaje
            entero con «Tu licencia de Control Driver…», también sirve.
          </p>
        ) : null}
        <button
          type="button"
          onClick={() => void activar()}
          disabled={activando || licenciaPegada === null}
          className="boton-principal"
          style={{ background: "var(--c-licencia)", color: "#fff" }}
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
 * La licencia, mes a mes, como una carretera: «Mes pagado → 7 días de gracia →
 * Solo lectura». El auto está donde estás ahora mismo.
 */
function LineaDeLicencia({ estado, diasRestantes }: { estado?: EstadoLicencia; diasRestantes?: number }) {
  // La barra mide 4 + 2 + 2 partes: el mes pagado ocupa la mitad.
  let pos = 4;
  if (estado === "activa" || estado === "prueba") {
    const gastado = 1 - Math.min(30, Math.max(0, diasRestantes ?? 30)) / 30;
    pos = 4 + gastado * 42;
  } else if (estado === "gracia") pos = 62;
  else if (estado === "vencida" || estado === "sin_licencia") pos = 88;

  return (
    <div
      role="img"
      aria-label="Un mes pagado con todo activo, luego siete días de gracia, y después solo lectura."
      className="aju-lic"
      style={{ "--pos": `${pos}%` } as React.CSSProperties}
    >
      <div className="aju-pista">
        <span className="a" />
        <span className="b" />
        <span className="c" />
      </div>
      <div className="aju-coche">
        <Auto vehiculo="auto" />
      </div>
      <div className="aju-etq">
        <span>Mes pagado</span>
        <span>7 días de gracia</span>
        <span>Solo lectura</span>
      </div>
    </div>
  );
}
