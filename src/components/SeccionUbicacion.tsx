"use client";

import { useState } from "react";

import { Pin } from "@/components/iconos";
import { RadarDeTramos } from "@/components/RadarDeTramos";
import { guardarMetodoDeDistancia, guardarUbicacionDeTienda } from "@/lib/db/sqlite/perfil";
import type { MetodoDeDistancia, Tienda } from "@/lib/db/tipos";
import { enlaceDeMapa } from "@/lib/geo/enlaces";
import { buscarDireccion, posicionActual, resolverEnlace, type Candidato } from "@/lib/geo/nativo";
import type { ReglaPago } from "@/lib/pagos/reglas";

/**
 * Dónde está la tienda y cómo se mide desde ella.
 *
 * La tienda es el punto de partida de todas las distancias: de ella al cliente
 * sale el tramo de cada pedido. Se puede poner de cuatro maneras, de la más
 * fiable a la menos: **estando ahí** (GPS), **pegando** el enlace o las
 * coordenadas de Google Maps, **buscando** su dirección, o —si nada de eso—
 * dejarla sin ubicar y elegir el tramo a mano.
 *
 * Y cada tienda mide a su manera: unas pagan por **línea recta** y otras por la
 * ruta **por calles** que genera Waze o Maps. Es una elección por tienda y esta
 * sección es donde se hace.
 */
export function SeccionUbicacion({
  tienda,
  regla,
  alCambiar,
}: {
  tienda: Tienda;
  regla: ReglaPago | null;
  alCambiar: () => void;
}) {
  const punto = tienda.lat !== null && tienda.lng !== null ? { lat: tienda.lat, lng: tienda.lng } : null;

  const [trabajando, setTrabajando] = useState<"gps" | "enlace" | "buscar" | null>(null);
  const [enlace, setEnlace] = useState("");
  const [direccion, setDireccion] = useState("");
  const [candidatos, setCandidatos] = useState<Candidato[] | null>(null);
  const [mensaje, setMensaje] = useState<{ ok: boolean; texto: string } | null>(null);

  async function fijar(lat: number, lng: number, deDireccion: string | null, como: string) {
    await guardarUbicacionDeTienda(tienda.id, { lat, lng, direccion: deDireccion });
    setCandidatos(null);
    setEnlace("");
    setMensaje({ ok: true, texto: `Ubicación guardada ${como}.` });
    alCambiar();
  }

  async function usarGps() {
    setTrabajando("gps");
    setMensaje(null);
    try {
      const p = await posicionActual();
      const margen = p.precisionM !== null ? ` (±${Math.round(p.precisionM)} m)` : "";
      await fijar(p.lat, p.lng, tienda.direccion, `desde tu ubicación${margen}`);
    } catch (e) {
      setMensaje({ ok: false, texto: e instanceof Error ? e.message : "No se pudo saber dónde estás." });
    } finally {
      setTrabajando(null);
    }
  }

  async function usarEnlace() {
    setTrabajando("enlace");
    setMensaje(null);
    try {
      const p = await resolverEnlace(enlace);
      if (!p) {
        setMensaje({
          ok: false,
          texto: "No encontré coordenadas ahí. Pega el enlace de Google Maps o algo como «-12.0464, -77.0428».",
        });
        return;
      }
      await fijar(p.lat, p.lng, tienda.direccion, "desde el enlace");
    } catch (e) {
      setMensaje({ ok: false, texto: e instanceof Error ? e.message : "No se pudo abrir el enlace." });
    } finally {
      setTrabajando(null);
    }
  }

  async function buscar() {
    const texto = direccion.trim();
    if (!texto) return;
    setTrabajando("buscar");
    setMensaje(null);
    setCandidatos(null);
    try {
      const encontrados = await buscarDireccion(texto, punto ?? undefined);
      setCandidatos(encontrados);
      if (encontrados.length === 0) {
        setMensaje({ ok: false, texto: "Android no encontró esa dirección. Prueba con otra forma de escribirla." });
      }
    } catch (e) {
      setMensaje({ ok: false, texto: e instanceof Error ? e.message : "No se pudo buscar la dirección." });
    } finally {
      setTrabajando(null);
    }
  }

  async function quitar() {
    await guardarUbicacionDeTienda(tienda.id, null);
    setMensaje({ ok: true, texto: "Ubicación quitada. Los tramos se elegirán a mano." });
    alCambiar();
  }

  async function elegirMetodo(metodo: MetodoDeDistancia) {
    if (metodo === tienda.metodoDistancia) return;
    await guardarMetodoDeDistancia(tienda.id, metodo);
    alCambiar();
  }

  async function cambiarFactor(nuevo: number) {
    const f = Math.round(Math.min(3, Math.max(1, nuevo)) * 10) / 10;
    await guardarMetodoDeDistancia(tienda.id, "calles", f);
    alCambiar();
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Dónde está ahora */}
      <div className="flex flex-col gap-2">
        <span className="rotulo">Punto de partida</span>
        {punto ? (
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-btn bg-bien-suave px-3 py-2.5">
            <span className="flex min-w-0 flex-col text-sm">
              <b className="font-semibold text-bien">Tienda ubicada</b>
              <span className="font-mono text-xs text-tinta-2">
                {punto.lat.toFixed(5)}, {punto.lng.toFixed(5)}
              </span>
              {tienda.direccion && <span className="truncate text-xs text-tinta-2">{tienda.direccion}</span>}
            </span>
            <a href={enlaceDeMapa(punto)} target="_blank" rel="noreferrer" className="boton-sec shrink-0">
              Ver en Maps
            </a>
          </div>
        ) : (
          <p className="rounded-btn bg-aviso-suave px-3 py-2.5 text-sm text-aviso">
            Sin ubicar. Mientras no se elija, el tramo de cada pedido se pone a mano.
          </p>
        )}
      </div>

      {/* Cómo ponerla */}
      <div className="flex flex-col gap-3">
        <span className="rotulo">{punto ? "Cambiarla" : "Ubicarla"}</span>

        <button
          type="button"
          onClick={() => void usarGps()}
          disabled={trabajando !== null}
          className="boton-sec flex items-center justify-center gap-2 self-start"
        >
          <Pin className="size-4" />
          {trabajando === "gps" ? "Buscando el GPS…" : "Estoy en la tienda: usar mi ubicación"}
        </button>

        <div className="flex flex-col gap-1.5">
          <label htmlFor={`enlace-${tienda.id}`} className="text-sm font-semibold">
            Pegar un enlace o coordenadas de Google Maps
          </label>
          <div className="flex gap-2">
            <input
              id={`enlace-${tienda.id}`}
              value={enlace}
              onChange={(e) => setEnlace(e.target.value)}
              placeholder="https://maps.app.goo.gl/… o -12.0464, -77.0428"
              autoCapitalize="off"
              autoCorrect="off"
              spellCheck={false}
              className="min-h-11 min-w-0 flex-1 rounded-btn border border-linea-fuerte bg-sup px-3 font-mono text-xs outline-none"
            />
            <button
              type="button"
              className="boton-sec shrink-0"
              disabled={trabajando !== null || enlace.trim().length < 5}
              onClick={() => void usarEnlace()}
            >
              {trabajando === "enlace" ? "…" : "Usar"}
            </button>
          </div>
          <span className="text-xs text-tinta-3">
            En Google Maps: mantén pulsado el sitio, «Compartir», y pégalo aquí.
          </span>
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor={`direccion-${tienda.id}`} className="text-sm font-semibold">
            O buscar su dirección
          </label>
          <div className="flex gap-2">
            <input
              id={`direccion-${tienda.id}`}
              value={direccion}
              onChange={(e) => setDireccion(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  void buscar();
                }
              }}
              placeholder="Av. Aldabas 123, Surco"
              className="min-h-11 min-w-0 flex-1 rounded-btn border border-linea-fuerte bg-sup px-3 text-sm outline-none"
            />
            <button
              type="button"
              className="boton-sec shrink-0"
              disabled={trabajando !== null || direccion.trim().length < 4}
              onClick={() => void buscar()}
            >
              {trabajando === "buscar" ? "…" : "Buscar"}
            </button>
          </div>
        </div>

        {candidatos && candidatos.length > 0 && (
          <ul className="flex flex-col overflow-hidden rounded-btn border border-linea">
            {candidatos.map((c) => (
              <li key={`${c.lat},${c.lng}`} className="border-b border-linea last:border-b-0">
                <button
                  type="button"
                  onClick={() => void fijar(c.lat, c.lng, c.etiqueta, "desde la dirección")}
                  className="flex w-full flex-col items-start gap-0.5 px-3 py-2.5 text-left hover:bg-sup-2"
                >
                  <span className="text-sm font-medium">{c.etiqueta}</span>
                  <span className="font-mono text-[11px] text-tinta-3">
                    {c.lat.toFixed(5)}, {c.lng.toFixed(5)}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}

        {punto && (
          <button type="button" onClick={() => void quitar()} className="self-start text-sm font-semibold text-mal">
            Quitar la ubicación
          </button>
        )}

        {mensaje && (
          <p role="status" className={`text-sm font-semibold ${mensaje.ok ? "text-bien" : "text-mal"}`}>
            {mensaje.texto}
          </p>
        )}
      </div>

      {/* Cómo se mide */}
      <div className="flex flex-col gap-2 border-t border-linea pt-4">
        <span className="rotulo">Cómo mide esta tienda la distancia</span>
        <div role="radiogroup" aria-label="Cómo se mide la distancia" className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <OpcionDeMetodo
            activa={tienda.metodoDistancia === "recta"}
            titulo="Línea recta"
            detalle="La distancia de punto a punto, como vuela un pájaro."
            alElegir={() => void elegirMetodo("recta")}
          />
          <OpcionDeMetodo
            activa={tienda.metodoDistancia === "calles"}
            titulo="Por calles"
            detalle="La ruta que genera Waze o Maps. Sin señal, se estima."
            alElegir={() => void elegirMetodo("calles")}
          />
        </div>

        {tienda.metodoDistancia === "calles" && (
          <div className="flex flex-col gap-2 rounded-btn bg-sup-2 p-3">
            <div className="flex items-center justify-between gap-3">
              <span className="flex flex-col">
                <b className="text-sm font-semibold">Factor de calles</b>
                <span className="text-xs text-tinta-3">
                  Sin señal, la ruta se estima: línea recta × {tienda.factorCalles.toFixed(1)}.
                </span>
              </span>
              <span className="flex items-center gap-1">
                <button
                  type="button"
                  aria-label="Bajar el factor"
                  className="grid size-10 place-items-center rounded-btn border border-linea-fuerte bg-sup text-lg"
                  disabled={tienda.factorCalles <= 1}
                  onClick={() => void cambiarFactor(tienda.factorCalles - 0.1)}
                >
                  −
                </button>
                <span className="w-10 text-center font-mono text-sm font-semibold">{tienda.factorCalles.toFixed(1)}</span>
                <button
                  type="button"
                  aria-label="Subir el factor"
                  className="grid size-10 place-items-center rounded-btn border border-linea-fuerte bg-sup text-lg"
                  disabled={tienda.factorCalles >= 3}
                  onClick={() => void cambiarFactor(tienda.factorCalles + 0.1)}
                >
                  +
                </button>
              </span>
            </div>
            <span className="text-xs text-tinta-3">
              Con señal se pide la ruta real a un servicio público, mandando solo coordenadas. En
              Lima, entre 1.2 y 1.4 suele acercarse.
            </span>
          </div>
        )}
      </div>

      {regla && (
        <div className="flex flex-col gap-2 border-t border-linea pt-4">
          <span className="rotulo">Los tramos alrededor de la tienda</span>
          <RadarDeTramos regla={regla} km={null} tienda={punto} cliente={null} />
        </div>
      )}
    </div>
  );
}

function OpcionDeMetodo({
  activa,
  titulo,
  detalle,
  alElegir,
}: {
  activa: boolean;
  titulo: string;
  detalle: string;
  alElegir: () => void;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={activa}
      onClick={alElegir}
      className={`flex min-w-0 flex-col items-start gap-1 rounded-btn border-2 p-3 text-left ${
        activa ? "border-acento bg-acento-suave" : "border-linea bg-sup hover:bg-sup-2"
      }`}
    >
      <b className="text-sm font-semibold">{titulo}</b>
      <span className="text-xs leading-snug text-tinta-2">{detalle}</span>
    </button>
  );
}
