"use client";

import { useState, useSyncExternalStore } from "react";

import { Candado, Check, Huella } from "@/components/iconos";
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
 * Por ahora, el bloqueo del dispositivo. Es lo que protege los ingresos y los
 * códigos de pedido si el driver presta o pierde el celular con la sesión
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

      <section className="tarjeta flex flex-col gap-4">
        <div className="flex items-start gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-chip bg-acento-suave text-acento-tinta">
            <Candado className="size-5" />
          </span>
          <div>
            <h3 className="text-lg">Bloqueo del dispositivo</h3>
            <p className="text-sm text-tinta-2">
              Un PIN de 4 dígitos al abrir la app. Tus ingresos y los códigos de tus pedidos no
              quedan a la vista si prestas el celular.
            </p>
          </div>
        </div>

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
          El PIN se guarda solo en este dispositivo, cifrado, y nunca viaja al servidor. No es una
          contraseña de la cuenta: si lo olvidas, cierra sesión, vuelve a entrar con tu correo y
          pon uno nuevo.
        </p>
      </section>

      <section className="tarjeta flex flex-col gap-2">
        <h3 className="text-lg">Tus capturas</h3>
        <p className="text-sm text-tinta-2">
          Las fotos se procesan en memoria y se descartan: no se guardan en ningún servidor. Solo se
          conserva lo que leíste y confirmaste en Revisión.
        </p>
      </section>
    </div>
  );
}
