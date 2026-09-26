"use client";

import { useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";

import { Acordeon } from "@/components/Acordeon";
import { SeccionApariencia } from "@/components/SeccionApariencia";
import { SeccionComandas } from "@/components/SeccionComandas";
import { SeccionModalidad } from "@/components/SeccionModalidad";
import { SeccionLicencia } from "@/components/SeccionLicencia";
import { SeccionRespaldo } from "@/components/SeccionRespaldo";
import { useDatos } from "@/hooks/useDatos";
import { useVersion } from "@/hooks/useVersion";
import { leerAjustesDeComandas } from "@/lib/db/sqlite/ajustes";
import { espacioOcupado } from "@/lib/db/sqlite/pruebas";

import { Check, Huella } from "@/components/iconos";
import {
  activarHuella,
  fijarPin,
  instantaneaAjustes,
  instantaneaAjustesServidor,
  marcarAbierto,
  quitarBloqueo,
  suscribirBloqueo,
} from "@/lib/bloqueo";

export const dynamic = "force-static";

/**
 * Ajustes.
 *
 * La versión arriba y todo lo demás en acordeones **cerrados**: cada uno dice
 * su estado sin abrirlo («PIN activo», «Wong - Aldabas · Auto · S/ 10»), y se
 * abre solo el que se va a tocar.
 *
 * El bloqueo del dispositivo protege los ingresos, los códigos de pedido y los
 * datos de los clientes si el driver presta o pierde el celular con la sesión
 * abierta; la sesión en sí dura semanas a propósito, para no pedir el código
 * de correo todos los días.
 */
export default function PaginaAjustes() {
  // El estado del bloqueo vive en el navegador, fuera de React. Se lee con
  // useSyncExternalStore para no tener que sincronizarlo con un efecto.
  const instantanea = useSyncExternalStore(
    suscribirBloqueo,
    instantaneaAjustes,
    instantaneaAjustesServidor,
  );
  const [configurado, conHuella, hayHuella] = instantanea
    .split(",")
    .map((v) => v === "true");

  const [pin, setPin] = useState("");
  const [repetir, setRepetir] = useState("");
  const [mensaje, setMensaje] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function guardarPin(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setMensaje(null);

    if (!/^\d{4}$/.test(pin)) {
      setError("El PIN tiene que ser de 4 dígitos.");
      return;
    }
    if (pin !== repetir) {
      setError("Los dos PIN no coinciden.");
      return;
    }
    await fijarPin(pin);
    marcarAbierto();
    setPin("");
    setRepetir("");
    setMensaje("Listo. La próxima vez que abras Rutas-A te pedirá el PIN.");
  }

  return (
    <div className="mx-auto flex max-w-[880px] flex-col gap-4">
      <h2 className="text-[30px] leading-tight">Ajustes</h2>

      <SeccionVersion />

      <SeccionApariencia />

      <SeccionModalidad />

      <ComandasYClientes />

      <Acordeon
        titulo="Bloqueo del dispositivo"
        resumen={configurado ? `PIN activo${conHuella ? " · con huella" : ""}` : "Sin PIN"}
        aviso={!configurado}
      >
        <p className="text-sm text-tinta-2">
          Un PIN de 4 dígitos al abrir la app. Tus ingresos, los códigos de tus pedidos y los datos
          de tus clientes no quedan a la vista si prestas el celular.
        </p>

        {configurado ? (
          <div className="flex flex-wrap items-center gap-3">
            <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-bien">
              <Check className="size-4" />
              PIN activo
            </span>
            <button
              type="button"
              className="boton-sec"
              onClick={() => {
                quitarBloqueo();
                setMensaje("Bloqueo quitado.");
              }}
            >
              Quitar bloqueo
            </button>
          </div>
        ) : (
          <form className="flex flex-col gap-3" onSubmit={(e) => void guardarPin(e)}>
            <div className="flex flex-wrap gap-3">
              <div className="flex flex-1 flex-col gap-1.5">
                <label htmlFor="pin-nuevo" className="text-sm font-semibold">
                  PIN nuevo
                </label>
                <input
                  id="pin-nuevo"
                  type="password"
                  inputMode="numeric"
                  maxLength={4}
                  autoComplete="new-password"
                  value={pin}
                  onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 4))}
                  className="min-h-12 rounded-btn border border-linea-fuerte bg-sup px-4 text-base tracking-[0.5em]"
                />
              </div>
              <div className="flex flex-1 flex-col gap-1.5">
                <label htmlFor="pin-repetir" className="text-sm font-semibold">
                  Repítelo
                </label>
                <input
                  id="pin-repetir"
                  type="password"
                  inputMode="numeric"
                  maxLength={4}
                  autoComplete="new-password"
                  value={repetir}
                  onChange={(e) => setRepetir(e.target.value.replace(/\D/g, "").slice(0, 4))}
                  className="min-h-12 rounded-btn border border-linea-fuerte bg-sup px-4 text-base tracking-[0.5em]"
                />
              </div>
            </div>
            <button type="submit" className="boton-sec self-start">
              Activar el bloqueo
            </button>
          </form>
        )}

        {configurado && hayHuella && (
          <div className="flex flex-wrap items-center gap-3 border-t border-linea pt-4">
            <span className="grid size-10 shrink-0 place-items-center rounded-chip bg-sup-2">
              <Huella className="size-5" />
            </span>
            {conHuella ? (
              <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-bien">
                <Check className="size-4" />
                Huella activa
              </span>
            ) : (
              <button
                type="button"
                className="boton-sec"
                onClick={async () => {
                  const ok = await activarHuella("Rutas-A");
                  setMensaje(
                    ok
                      ? "Huella activada. El PIN sigue funcionando como respaldo."
                      : "Tu dispositivo no pudo registrar la huella. El PIN sigue activo.",
                  );
                }}
              >
                Desbloquear también con huella
              </button>
            )}
          </div>
        )}

        {mensaje && <p className="text-sm font-semibold text-bien">{mensaje}</p>}
        {error && <p className="text-sm font-semibold text-mal">{error}</p>}

        <p className="border-t border-linea pt-4 text-xs text-tinta-3">
          El PIN se guarda solo en este teléfono, cifrado, y no viaja a ningún lado. Es lo único
          que protege tus datos si alguien coge el aparato.
        </p>
      </Acordeon>

      <SeccionLicencia />

      <SeccionRespaldo />

      <SeccionCapturas />

      <SeccionEjemplo />

      <SeccionDiagnostico />
    </div>
  );
}

/**
 * «Comandas y clientes»: lo que se guarda de cada cliente. El resumen dice qué
 * datos están activos, que es lo que se quiere saber sin abrirlo.
 */
function ComandasYClientes() {
  const { datos: a } = useDatos(() => leerAjustesDeComandas(), [], { conservar: true });
  const guarda = a
    ? [a.guardarNombre && "nombre", a.guardarDireccion && "dirección", a.guardarTelefono && "teléfono"].filter(Boolean)
    : [];
  return (
    <Acordeon
      titulo="Comandas y clientes"
      resumen={
        !a
          ? "…"
          : guarda.length === 0
            ? "No se guarda nada del cliente"
            : `Guarda ${guarda.join(", ")}`
      }
    >
      <SeccionComandas />
    </Acordeon>
  );
}

/**
 * Las fotos que quedaron como evidencia de pedidos. Una por pedido, en el
 * teléfono y en ningún servidor; aquí se ve cuánto ocupan.
 */
function SeccionCapturas() {
  const { datos: uso } = useDatos(() => espacioOcupado(), [], { conservar: true });
  const mb = uso ? uso.bytes / (1024 * 1024) : 0;
  return (
    <Acordeon
      titulo="Capturas y evidencias"
      resumen={
        !uso
          ? "…"
          : uso.cuantas === 0
            ? "Sin fotos guardadas"
            : `${uso.cuantas} foto${uso.cuantas === 1 ? "" : "s"} · ${mb < 0.1 ? "menos de 0.1" : mb.toFixed(1)} MB`
      }
    >
      <p className="text-sm text-tinta-2">
        Las capturas se leen en el teléfono y no se guardan en ningún servidor. Solo se conserva lo
        que leíste y confirmaste, y las fotos que dejaste como evidencia de un pedido o de una
        comanda. Para borrar una foto, abre el pedido en su día.
      </p>
    </Acordeon>
  );
}

/**
 * Datos de ejemplo.
 *
 * Existe para poder enseñar la aplicación: vacía no se ve el historial, ni el
 * gráfico, ni la regla de permanencia haciendo su trabajo. Va al final de
 * Ajustes y no en la pantalla principal a propósito —es una herramienta de
 * demostración, no parte del uso diario— y borrar avisa antes, porque quien lo
 * toque por error perdería su trabajo de verdad.
 */
function SeccionEjemplo() {
  const router = useRouter();
  const [ocupado, setOcupado] = useState<"cargando" | "borrando" | null>(null);
  const [mensaje, setMensaje] = useState<string | null>(null);

  async function cargar() {
    setOcupado("cargando");
    setMensaje(null);
    try {
      const { cargarDatosDeEjemplo } = await import("@/lib/db/sqlite/ejemplo");
      const cuantas = await cargarDatosDeEjemplo();
      setMensaje(`Listo: ${cuantas} jornadas de ejemplo. Míralas en Historial.`);
      router.refresh();
    } catch {
      setMensaje("No se pudieron cargar los datos de ejemplo.");
    } finally {
      setOcupado(null);
    }
  }

  async function borrar() {
    if (!confirm("Se borrarán TODAS tus jornadas, también las de verdad. ¿Seguro?")) return;
    setOcupado("borrando");
    setMensaje(null);
    try {
      const { borrarTodasLasJornadas } = await import("@/lib/db/sqlite/ejemplo");
      await borrarTodasLasJornadas();
      setMensaje("Base vacía, como recién instalada.");
      router.refresh();
    } catch {
      setMensaje("No se pudo borrar.");
    } finally {
      setOcupado(null);
    }
  }

  return (
    <Acordeon titulo="Datos de ejemplo" resumen="Para enseñar la aplicación">
      <p className="text-sm text-tinta-2">
        Llena tres semanas con jornadas inventadas para poder enseñar la aplicación. Incluye un
        día flojo donde se ve pagar la permanencia en vez de los pedidos.
      </p>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => void cargar()}
          disabled={ocupado !== null}
          className="boton-secundario min-h-11 px-4"
        >
          {ocupado === "cargando" ? "Cargando…" : "Cargar ejemplo"}
        </button>
        <button
          type="button"
          onClick={() => void borrar()}
          disabled={ocupado !== null}
          className="min-h-11 rounded-btn px-4 text-sm font-semibold text-mal"
        >
          {ocupado === "borrando" ? "Borrando…" : "Borrar todo"}
        </button>
      </div>

      {mensaje && <p className="text-sm text-tinta-2">{mensaje}</p>}
    </Acordeon>
  );
}

/**
 * Qué leyó el lector en la última carga.
 *
 * Existe para poder arreglar una lectura que salió mal. El intérprete depende
 * del orden en que el lector devuelve las regiones de la imagen, y ese orden
 * cambia según el teléfono y la versión de Android: sin ver el texto crudo,
 * diagnosticar a distancia es adivinar.
 *
 * Va plegado y al final de Ajustes porque no es para el uso diario.
 */
function SeccionDiagnostico() {
  const [ver, setVer] = useState<"captura" | "comanda" | null>(null);
  const [texto, setTexto] = useState<string | null>(null);
  const [copiado, setCopiado] = useState(false);

  async function abrir(cual: "captura" | "comanda") {
    const leer =
      cual === "captura"
        ? (await import("@/lib/extraccion/enDispositivo")).ultimaLectura
        : (await import("@/lib/comanda/leer")).ultimaLecturaDeComanda;
    setTexto(
      (await leer()) ??
        (cual === "captura"
          ? "Todavía no has cargado ninguna captura."
          : "Todavía no has leído ninguna comanda."),
    );
    setVer(cual);
  }

  async function copiar() {
    if (!texto) return;
    try {
      await navigator.clipboard.writeText(texto);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    } catch {
      setCopiado(false);
    }
  }

  return (
    <Acordeon titulo="Si algo no se leyó bien" resumen="Ver el texto que sacó el lector">
      <p className="text-sm text-tinta-2">
        Aquí está el texto que sacó el lector de la última carga. Cópialo y mándalo para que se
        pueda corregir. Puede contener nombres y teléfonos de clientes: mándalo solo a quien lo
        arregla.
      </p>

      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={() => void abrir("captura")} className="boton-secundario">
          Última captura
        </button>
        <button type="button" onClick={() => void abrir("comanda")} className="boton-secundario">
          Última comanda
        </button>
      </div>

      {ver && (
        <>
          <pre className="max-h-64 overflow-auto rounded-btn bg-sup-2 p-3 font-mono text-xs whitespace-pre-wrap">
            {texto}
          </pre>
          <button type="button" onClick={() => void copiar()} className="boton-secundario self-start">
            {copiado ? "Copiado ✓" : "Copiar"}
          </button>
        </>
      )}
    </Acordeon>
  );
}

/**
 * Qué versión está instalada.
 *
 * Parece un detalle y no lo es: cuando se prueba una app instalándola a mano,
 * la pregunta constante es «¿estoy viendo el arreglo o la versión de antes?».
 * Sin este dato, un fallo ya corregido se reporta dos veces y se pierde media
 * tarde buscándolo.
 */
function SeccionVersion() {
  const datos = useVersion();

  return (
    <section className="tarjeta flex items-center justify-between gap-3">
      <div className="flex flex-col">
        <h3 className="text-lg">Rutas-A</h3>
        <span className="text-sm text-tinta-2">
          {datos ? `Versión ${datos.version}` : "…"}
        </span>
      </div>
      <span className="rounded-chip bg-acento-suave px-3 py-1 font-mono text-sm font-bold text-acento-tinta">
        v{datos?.build ?? "?"}
      </span>
    </section>
  );
}
