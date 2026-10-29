"use client";

import { Suspense, useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";

import { Acordeon } from "@/components/Acordeon";
import { EditorDeTarifario } from "@/components/AdicionalPorZona";
import { DialogoConfirmar } from "@/components/DialogoConfirmar";
import { IconoDeSeccion } from "@/components/IconoDeSeccion";
import { SeccionDeAjustes } from "@/components/SeccionDeAjustes";
import { PuntosDePin, TecladoPin } from "@/components/TecladoPin";
import { cerrarAplicacion } from "@/components/salirDeLaApp";
import { TourDePantalla } from "@/components/TourDePantalla";
import { SeccionApariencia } from "@/components/SeccionApariencia";
import { SeccionComandas } from "@/components/SeccionComandas";
import { SeccionMetasYSonido } from "@/components/SeccionMetasYSonido";
import { SeccionModalidad } from "@/components/SeccionModalidad";
import { SeccionLicencia } from "@/components/SeccionLicencia";
import { SeccionRespaldo } from "@/components/SeccionRespaldo";
import { LineaCopyright, TextoLegal } from "@/components/TextoLegal";
import { useDatos } from "@/hooks/useDatos";
import { useVersion } from "@/hooks/useVersion";
import { leerAjustesDeComandas } from "@/lib/db/sqlite/ajustes";
import { CATEGORIA_TAXI, listarCategorias } from "@/lib/db/sqlite/bloques-extra";
import { crearTipoDeAdicional } from "@/app/(app)/jornada/acciones";
import { espacioOcupado } from "@/lib/db/sqlite/pruebas";
import { avisarDeCambios } from "@/lib/cambios";
import { formatearFecha, hoyEnLima, type FechaISO } from "@/lib/fechas";
import {
  instantaneaFechaAceptacion,
  instantaneaFechaAceptacionServidor,
  suscribirTerminos,
} from "@/lib/terminos";

import { Check, Huella, Salir } from "@/components/iconos";
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
  const [abierta, setAbierta] = useState<string | null>(null);
  const raiz = useRef<HTMLDivElement>(null);

  const abrir = useCallback((clave: string | null) => {
    setAbierta(clave);
    // Al abrir o volver, se empieza arriba de la pantalla.
    requestAnimationFrame(() => raiz.current?.scrollIntoView({ block: "start" }));
  }, []);

  // Se puede llegar directo a una sección con `?abre=tienda` o con `#aj-tienda`.
  useEffect(() => {
    const q = new URLSearchParams(window.location.search).get("abre");
    const h = window.location.hash.replace(/^#(aj-)?/, "");
    const pedida = ALIAS[q ?? ""] ?? ALIAS[h] ?? null;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- se lee un dato externo (la dirección) tras montar
    if (pedida) setAbierta(pedida);
  }, []);

  const celda = (clave: string, i: number, hijo: React.ReactNode) => (
    <SeccionDeAjustes clave={clave} id={ANCLAS[clave]} indice={i} abierta={abierta} abrir={abrir}>
      {hijo}
    </SeccionDeAjustes>
  );

  return (
    <div ref={raiz} className="mx-auto flex max-w-[880px] scroll-mt-4 flex-col gap-4">
      <Suspense fallback={null}>
        <TourDePantalla pantalla="ajustes" />
      </Suspense>
      {abierta === null && <h2 className="text-[30px] leading-tight">Ajustes</h2>}

      {abierta === null && <SeccionVersion />}

      <div className="aju-grid">
        {celda("apariencia", 0, <SeccionApariencia />)}
        {celda("metas", 1, <SeccionMetasYSonido />)}
        {celda("tienda", 2, <SeccionModalidad />)}
        {celda("adicionales", 3, <AdicionalesYTarifas />)}
        {celda("comandas", 4, <ComandasYClientes />)}
        {celda("pin", 5, <SeccionBloqueo />)}
        {celda("licencia", 6, <SeccionLicencia />)}
        {celda("respaldo", 7, <SeccionRespaldo />)}
        {celda("terminos", 8, <SeccionTerminos />)}
        {celda("ejemplo", 9, <SeccionEjemplo />)}
        {celda("diagnostico", 10, <SeccionDiagnostico />)}
      </div>

      <SeccionSalir />
    </div>
  );
}

const ANCLAS: Record<string, string> = {
  apariencia: "aj-apariencia",
  metas: "aj-metas",
  tienda: "aj-tienda",
  adicionales: "aj-adicionales",
  comandas: "aj-comandas",
  pin: "aj-pin",
  licencia: "aj-licencia",
  respaldo: "aj-respaldo",
  terminos: "aj-terminos",
  ejemplo: "aj-ejemplo",
  diagnostico: "aj-diagnostico",
};

/** Nombres con los que otras pantallas o recorridos pueden pedir una sección. */
const ALIAS: Record<string, string> = {
  ...Object.fromEntries(Object.keys(ANCLAS).map((k) => [k, k])),
  bloqueo: "pin",
  diag: "diagnostico",
  capturas: "diagnostico",
  tarifa: "tienda",
  ubicacion: "tienda",
  sonidos: "metas",
  legal: "terminos",
};

/**
 * El bloqueo del dispositivo: PIN de 4 números con puntos y teclado grande.
 * Quitarlo pide confirmar, porque deja la app abierta a cualquiera.
 */
function SeccionBloqueo() {
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
  const [quitando, setQuitando] = useState(false);

  function tocar(d: string) {
    setError(null);
    setMensaje(null);
    if (pin.length < 4) setPin(pin + d);
    else if (repetir.length < 4) setRepetir(repetir + d);
  }
  function borrar() {
    setError(null);
    if (repetir.length > 0) setRepetir(repetir.slice(0, -1));
    else setPin(pin.slice(0, -1));
  }
  function reiniciar() {
    setPin("");
    setRepetir("");
    setError(null);
  }

  async function guardarPin() {
    setError(null);
    setMensaje(null);
    if (!/^\d{4}$/.test(pin)) {
      setError("El PIN tiene que ser de 4 dígitos.");
      return;
    }
    if (pin !== repetir) {
      setError("Los dos PIN no coinciden. Prueba otra vez.");
      setRepetir("");
      return;
    }
    await fijarPin(pin);
    marcarAbierto();
    reiniciar();
    setMensaje("Listo. La próxima vez que abras Control Driver te pedirá el PIN.");
  }

  const largo = pin.length < 4 ? pin.length : repetir.length;

  return (
    <Acordeon
      titulo="Bloqueo"
      icono="candado"
      resumen={configurado ? `PIN activo${conHuella ? " · con huella" : ""}` : "Sin PIN"}
      aviso={!configurado}
    >
      <p className="text-sm text-tinta-2">
        Un PIN de 4 números al abrir la app. Tus ingresos, los códigos de tus pedidos y los datos de tus
        clientes no quedan a la vista si prestas el celular.
      </p>

      {configurado ? (
        <div className="flex flex-col gap-3">
          <span className="inline-flex items-center gap-2 text-base font-bold text-bien">
            <Check className="size-5" />
            El PIN está activo
          </span>
          <button
            type="button"
            className="min-h-[var(--toque)] rounded-btn bg-mal-suave px-4 text-sm font-bold text-mal"
            onClick={() => setQuitando(true)}
          >
            Quitar el PIN
          </button>
        </div>
      ) : (
        <div className="aju-cent">
          <b className="font-display text-lg">{pin.length < 4 ? "Elige tu PIN de 4 números" : "Repítelo para confirmar"}</b>
          <PuntosDePin largo={largo} error={!!error} />
          <TecladoPin alTocar={tocar} alBorrar={borrar} />
          <div className="flex w-full flex-col gap-2">
            <button
              type="button"
              className="boton-principal"
              disabled={repetir.length < 4}
              onClick={() => void guardarPin()}
            >
              Activar el bloqueo
            </button>
            {pin.length > 0 && (
              <button type="button" className="boton-sec" onClick={reiniciar}>
                Empezar de nuevo
              </button>
            )}
          </div>
        </div>
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
                const ok = await activarHuella("Control Driver");
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
      {error && <p role="alert" className="text-sm font-semibold text-mal">{error}</p>}

      <p className="border-t border-linea pt-4 text-xs text-tinta-3">
        El PIN se guarda solo en este teléfono, cifrado, y no viaja a ningún lado. Es lo único que protege tus
        datos si alguien coge el aparato.
      </p>

      {quitando && (
        <DialogoConfirmar
          titulo="¿Quitar el PIN?"
          texto="La app se abrirá sin pedir nada: tus ingresos y los datos de tus clientes quedarán a la vista si prestas el celular."
          confirmar="Sí, quitar el PIN"
          alCancelar={() => setQuitando(false)}
          alConfirmar={() => {
            setQuitando(false);
            quitarBloqueo();
            setMensaje("Bloqueo quitado.");
          }}
        />
      )}
    </Acordeon>
  );
}

/**
 * «Comandas y clientes»: lo que se guarda de cada cliente. El resumen dice qué
 * datos están activos, que es lo que se quiere saber sin abrirlo.
 */
function AdicionalesYTarifas() {
  const { datos: tipos, recargar } = useDatos(() => listarCategorias(), [], { conservar: true });
  const [abierto, setAbierto] = useState<string | null>(null);
  const [nuevo, setNuevo] = useState("");
  const [error, setError] = useState<string | null>(null);
  // Taxi se cobra por kilómetros y monto libre: no lleva tarifario.
  const lista = (tipos ?? []).filter((t) => t.activa && t.id !== CATEGORIA_TAXI);

  async function crear() {
    const r = await crearTipoDeAdicional(nuevo);
    if (!r.ok) return setError(r.error);
    setError(null);
    setNuevo("");
    setAbierto(r.categoria.id);
    recargar();
  }

  return (
    <Acordeon
      titulo="Adicionales"
      icono="adicional"
      resumen={lista.length === 0 ? "Crea un tipo (Expo Vino, Movilidad…)" : lista.map((t) => t.nombre).join(" · ")}
    >
      <div className="flex flex-col gap-3">
        <p className="text-xs text-tinta-2">
          Cada tipo puede tener su lista de zonas con lo que se paga por pedido. Al registrar un adicional de ese tipo eliges la
          zona y cuántos pedidos, y el monto sale solo.
        </p>
        {lista.map((t) => (
          <div key={t.id} className="rounded-btn border border-linea">
            <button
              type="button"
              aria-expanded={abierto === t.id}
              onClick={() => setAbierto(abierto === t.id ? null : t.id)}
              className="flex min-h-12 w-full items-center justify-between gap-3 px-3 text-left"
            >
              <b className="text-sm">{t.nombre}</b>
              <span className="text-xs text-tinta-3">{t.tarifario.length > 0 ? `${t.tarifario.length} zonas` : "sin tarifas"}</span>
            </button>
            {abierto === t.id && (
              <div className="border-t border-linea p-3">
                <EditorDeTarifario key={t.id + t.tarifario.length} tipo={t} alGuardar={recargar} />
              </div>
            )}
          </div>
        ))}
        <div className="flex gap-2">
          <input
            value={nuevo}
            onChange={(e) => setNuevo(e.target.value)}
            placeholder="Nuevo tipo, ej.: Expo Vino"
            maxLength={40}
            aria-label="Nombre del nuevo tipo"
            className="min-h-11 min-w-0 flex-1 rounded-btn border border-linea-fuerte bg-sup px-3 text-base"
          />
          <button type="button" className="boton-sec" disabled={nuevo.trim().length < 2} onClick={() => void crear()}>
            Crear
          </button>
        </div>
        {error && <p className="text-sm text-mal">{error}</p>}
      </div>
    </Acordeon>
  );
}

function ComandasYClientes() {
  const { datos: a } = useDatos(() => leerAjustesDeComandas(), [], { conservar: true });
  const guarda = a
    ? [a.guardarNombre && "nombre", a.guardarDireccion && "dirección", a.guardarTelefono && "teléfono"].filter(Boolean)
    : [];
  return (
    <Acordeon
      titulo="Comandas y clientes"
      icono="comanda"
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
  const [fechaPrueba, setFechaPrueba] = useState<FechaISO>(hoyEnLima());
  const [preguntandoPrueba, setPreguntandoPrueba] = useState(false);
  const [preguntandoTodo, setPreguntandoTodo] = useState(false);
  const [preguntandoEjemplo, setPreguntandoEjemplo] = useState(false);

  async function cargarPrueba(taxis: boolean, apoyo: boolean) {
    setOcupado("cargando");
    setMensaje(null);
    try {
      const { cargarBloquesDePrueba } = await import("@/lib/db/sqlite/ejemplo");
      const n = await cargarBloquesDePrueba(fechaPrueba, { taxis, apoyo });
      setMensaje(`Listo: ${n} ${n === 1 ? "registro" : "registros"} de prueba el ${fechaPrueba.split("-").reverse().join("/")}. Míralos en Inicio, Pagos y Estadísticas.`);
      avisarDeCambios();
    } catch {
      setMensaje("No se pudieron cargar los datos de prueba.");
    } finally {
      setOcupado(null);
    }
  }

  async function quitarPrueba() {
    setOcupado("borrando");
    setMensaje(null);
    try {
      const { borrarBloquesDePrueba } = await import("@/lib/db/sqlite/ejemplo");
      await borrarBloquesDePrueba();
      setMensaje("Quité los taxis y apoyos de prueba.");
      avisarDeCambios();
    } catch {
      setMensaje("No se pudo quitar.");
    } finally {
      setOcupado(null);
    }
  }

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
    <Acordeon titulo="Datos de ejemplo" icono="probeta" resumen="Para enseñar la aplicación">
      <p className="text-sm text-tinta-2">
        Llena tres semanas con jornadas inventadas para poder enseñar la aplicación. Incluye un
        día flojo donde se ve pagar la permanencia en vez de los pedidos.
      </p>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setPreguntandoEjemplo(true)}
          disabled={ocupado !== null}
          className="boton-accion !w-auto flex-1"
          style={{ "--c": "var(--c-mano)" } as React.CSSProperties}
        >
          {ocupado === "cargando" ? "Cargando…" : "Cargar ejemplo"}
        </button>
        <button
          type="button"
          onClick={() => setPreguntandoTodo(true)}
          disabled={ocupado !== null}
          className="min-h-[var(--toque)] rounded-btn bg-mal-suave px-4 text-sm font-bold text-mal disabled:opacity-50"
        >
          {ocupado === "borrando" ? "Borrando…" : "Borrar todo"}
        </button>
      </div>

      <div className="flex flex-col gap-2 border-t border-linea pt-4">
        <b className="text-sm">Taxi y apoyo de prueba</b>
        <p className="text-xs text-tinta-3">
          Elige el día y carga tres carreras de taxi (y, si quieres, un apoyo por hora) para probar las pantallas, las
          sumas y el PDF. Son normales: se pueden tocar, corregir y quitar.
        </p>
        <label className="flex flex-col gap-1">
          <span className="text-sm font-semibold">Día</span>
          <input
            type="date"
            value={fechaPrueba}
            max={hoyEnLima()}
            onChange={(e) => e.target.value && setFechaPrueba(e.target.value as FechaISO)}
            className="min-h-11 rounded-btn border border-linea-fuerte bg-sup px-3 text-base"
          />
        </label>
        <div className="flex flex-wrap gap-2">
          <button type="button" disabled={ocupado !== null} onClick={() => void cargarPrueba(true, false)} className="boton-sec">
            Cargar 3 taxis
          </button>
          <button type="button" disabled={ocupado !== null} onClick={() => void cargarPrueba(false, true)} className="boton-sec">
            Cargar un apoyo
          </button>
          <button type="button" disabled={ocupado !== null} onClick={() => setPreguntandoPrueba(true)} className="min-h-[var(--toque)] rounded-btn bg-mal-suave px-4 text-sm font-bold text-mal disabled:opacity-50">
            Quitar los de prueba
          </button>
        </div>
      </div>

      {preguntandoEjemplo && (
        <DialogoConfirmar
          titulo="¿Cargar los datos de ejemplo?"
          texto="Se reemplaza lo que tengas cargado en las últimas 3 semanas por jornadas inventadas. No se puede deshacer."
          confirmar="Sí, reemplazar"
          alCancelar={() => setPreguntandoEjemplo(false)}
          alConfirmar={() => {
            setPreguntandoEjemplo(false);
            void cargar();
          }}
        />
      )}

      {preguntandoTodo && (
        <DialogoConfirmar
          titulo="¿Borrar TODAS tus jornadas?"
          texto="Se van también las de verdad, con sus pedidos, rutas, apoyos y taxis. No se puede deshacer."
          confirmar="Sí, borrar todo"
          alCancelar={() => setPreguntandoTodo(false)}
          alConfirmar={() => {
            setPreguntandoTodo(false);
            void borrar();
          }}
        />
      )}

      {preguntandoPrueba && (
        <DialogoConfirmar
          titulo="¿Quitar los taxis y apoyos de prueba?"
          texto="Solo se quitan los que cargaste como prueba; tus registros de verdad no se tocan."
          confirmar="Sí, quitarlos"
          alCancelar={() => setPreguntandoPrueba(false)}
          alConfirmar={() => {
            setPreguntandoPrueba(false);
            void quitarPrueba();
          }}
        />
      )}

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
  const { datos: uso } = useDatos(() => espacioOcupado(), [], { conservar: true });
  const mb = uso ? uso.bytes / (1024 * 1024) : 0;
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
    <Acordeon
      titulo="Diagnóstico"
      icono="lupa"
      resumen={
        !uso
          ? "Ver lo que leyó el lector"
          : uso.cuantas === 0
            ? "Sin fotos guardadas"
            : `${uso.cuantas} foto${uso.cuantas === 1 ? "" : "s"} · ${mb < 0.1 ? "menos de 0.1" : mb.toFixed(1)} MB`
      }
    >
      <p className="text-sm text-tinta-2">
        Las capturas se leen en el teléfono y no se guardan en ningún servidor. Solo se conserva lo que leíste y
        confirmaste, y las fotos que dejaste como evidencia. Para borrar una foto, abre el pedido en su día.
      </p>
      <p className="text-sm text-tinta-2">
        Si algo no se leyó bien, aquí está el texto que sacó el lector de la última carga. Cópialo y mándalo para que se
        pueda corregir. Puede contener nombres y teléfonos de clientes: mándalo solo a quien lo
        arregla.
      </p>

      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={() => void abrir("captura")} className="boton-sec">
          Última captura
        </button>
        <button type="button" onClick={() => void abrir("comanda")} className="boton-sec">
          Última comanda
        </button>
      </div>

      {ver && (
        <>
          <pre className="max-h-64 overflow-auto rounded-btn bg-sup-2 p-3 font-mono text-xs whitespace-pre-wrap">
            {texto}
          </pre>
          <button type="button" onClick={() => void copiar()} className="boton-sec self-start">
            {copiado ? "Copiado ✓" : "Copiar"}
          </button>
        </>
      )}
    </Acordeon>
  );
}

/**
 * Salir de la app.
 *
 * Ya existe el atajo físico —dos toques seguidos en atrás, desde Hoy— pero es
 * un gesto que no todos conocen y que no deja sitio para un «¿seguro?»: la
 * confirmación ahí es la propia repetición del toque. Este botón es la versión
 * visible, con una confirmación de verdad antes de cerrar.
 *
 * En el navegador (mientras se prueba fuera del APK) no hay aplicación que
 * cerrar: se dice y no se pide confirmar nada.
 */
/**
 * «Términos y privacidad»: el mismo aviso legal de la puerta de entrada
 * (`AvisoLegal`), aquí en modo solo lectura, con la fecha en que se aceptó.
 * No hay checkbox ni botón: si se está viendo esta pantalla, ya se aceptó.
 */
function SeccionTerminos() {
  const fecha = useSyncExternalStore(
    suscribirTerminos,
    instantaneaFechaAceptacion,
    instantaneaFechaAceptacionServidor,
  );

  return (
    <Acordeon titulo="Términos" icono="escudo" resumen={fecha ? `Aceptado el ${formatearFecha(fecha)}` : "Privacidad"}>
      <TextoLegal />
      <LineaCopyright className="border-t border-linea pt-3 text-xs text-tinta-3" />
    </Acordeon>
  );
}

function SeccionSalir() {
  const [mensaje, setMensaje] = useState<string | null>(null);
  const [preguntando, setPreguntando] = useState(false);

  async function salir() {
    setPreguntando(false);
    setMensaje(null);
    if ((await cerrarAplicacion()) === "no-nativo") {
      setMensaje("Esto solo cierra la aplicación instalada, no esta pestaña del navegador.");
    }
  }

  return (
    <div className="mt-2 flex flex-col gap-2">
      <button
        type="button"
        onClick={() => setPreguntando(true)}
        className="flex min-h-[var(--toque)] w-full items-center justify-center gap-2 rounded-btn bg-mal-suave px-4 text-base font-bold text-mal"
      >
        <Salir className="size-5" />
        Salir de la app
      </button>
      {mensaje && <p className="text-center text-sm text-tinta-2">{mensaje}</p>}
      {preguntando && (
        <DialogoConfirmar
          titulo="¿Salir de Control Driver?"
          texto="Se cierra la aplicación del todo. Tus datos se quedan guardados."
          confirmar="Sí, salir"
          alCancelar={() => setPreguntando(false)}
          alConfirmar={() => void salir()}
        />
      )}
    </div>
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
    <section className="aju-ver rise-v2">
      <span className="aju-ver__fig">
        <IconoDeSeccion clave="version" className="!bg-transparent" />
      </span>
      <div className="min-w-0">
        <b>Control Driver</b>
        <small>{datos ? `Versión ${datos.version}` : "…"}</small>
      </div>
      <span className="aju-ver__chip">
        {datos && /^\d/.test(datos.version) ? `v${datos.version}` : (datos?.version ?? "?")}
      </span>
    </section>
  );
}
