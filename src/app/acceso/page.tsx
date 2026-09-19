"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { Alerta } from "@/components/iconos";
import { pedirCodigo, verificarCodigo } from "@/lib/supabase/navegador";
import { marcarAbierto } from "@/lib/bloqueo";

/**
 * Acceso: correo + código de 6 dígitos.
 *
 * Sustituye el usuario y contraseña de §12 — ver NOTAS-DE-IMPLEMENTACION.md.
 * El registro público está cerrado: `pedirCodigo` llama a Supabase con
 * `shouldCreateUser: false`, así que un correo sin cuenta no crea ninguna.
 *
 * Una vez dentro, la sesión dura: el código se pide **una vez por
 * dispositivo**, no cada día. Lo que protege el día a día es el PIN local.
 */
export default function PaginaAcceso() {
  return (
    <Suspense fallback={<div className="min-h-dvh bg-papel" />}>
      <FormularioAcceso />
    </Suspense>
  );
}

/**
 * ¿Dónde hay que ir a buscar el código, si no llega al correo?
 *
 * Devuelve la dirección del buzón local, o null si esto es producción y el
 * correo sale de verdad.
 *
 * Hay dos formas de estar en local y las dos tienen que funcionar:
 *
 *   · `npm run local` y `npm run movil` apuntan a una dirección de red
 *     privada, así que se reconocen por la URL de Supabase.
 *   · `npm run tunel` apunta a un dominio público de verdad (el túnel HTTPS),
 *     que por fuera no se distingue de producción. Ahí el script escribe
 *     NEXT_PUBLIC_BUZON_URL, y esa variable manda.
 *
 * Sin esto uno se queda mirando su bandeja de entrada esperando un correo que
 * nunca va a llegar.
 */
function urlDelBuzon(): string | null {
  const declarada = process.env.NEXT_PUBLIC_BUZON_URL;
  if (declarada) return declarada;

  const supabase = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const esRedPrivada =
    /^https?:\/\/(127\.0\.0\.1|localhost|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(supabase);
  return esRedPrivada ? "http://127.0.0.1:54324" : null;
}

function FormularioAcceso() {
  const router = useRouter();
  const params = useSearchParams();
  const volver = params.get("volver") ?? "/";

  const [paso, setPaso] = useState<"correo" | "codigo">("correo");
  const [correo, setCorreo] = useState("");
  const [digitos, setDigitos] = useState(["", "", "", "", "", ""]);
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [segundos, setSegundos] = useState(0);
  const campos = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    if (segundos <= 0) return;
    const t = setTimeout(() => setSegundos((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [segundos]);

  const codigo = digitos.join("");
  const buzon = urlDelBuzon();

  async function enviarCodigo(e?: React.FormEvent) {
    e?.preventDefault();
    const limpio = correo.trim().toLowerCase();
    if (!limpio.includes("@")) {
      setError("Escribe un correo válido.");
      return;
    }
    setEnviando(true);
    setError(null);
    const { error: fallo } = await pedirCodigo(limpio);
    setEnviando(false);

    if (fallo) {
      // Supabase distingue "no existe" de "demasiados intentos"; el resto se
      // resume para no dar pistas sobre qué correos están registrados.
      setError(
        fallo.status === 429
          ? "Demasiados intentos. Espera un momento antes de volver a pedirlo."
          : "No se pudo enviar el código. Revisa el correo o pídele acceso al administrador.",
      );
      return;
    }
    setPaso("codigo");
    setSegundos(45);
    setTimeout(() => campos.current[0]?.focus(), 50);
  }

  async function entrar(valor: string) {
    setEnviando(true);
    setError(null);
    const { error: fallo } = await verificarCodigo(correo, valor);
    setEnviando(false);

    if (fallo) {
      setError("Ese código no es correcto o ya venció.");
      setDigitos(["", "", "", "", "", ""]);
      campos.current[0]?.focus();
      return;
    }
    // Sesión nueva: se considera desbloqueada hasta que el PIN diga otra cosa.
    marcarAbierto();
    router.replace(volver);
    router.refresh();
  }

  function escribirDigito(i: number, valor: string) {
    const limpio = valor.replace(/\D/g, "");
    setError(null);

    if (limpio.length > 1) {
      // Pegar el código completo: se reparte por las seis casillas.
      const nuevos = [...digitos];
      limpio
        .slice(0, 6)
        .split("")
        .forEach((c, k) => {
          if (i + k < 6) nuevos[i + k] = c;
        });
      setDigitos(nuevos);
      const siguiente = Math.min(i + limpio.length, 5);
      campos.current[siguiente]?.focus();
      if (nuevos.join("").length === 6) void entrar(nuevos.join(""));
      return;
    }

    const nuevos = [...digitos];
    nuevos[i] = limpio;
    setDigitos(nuevos);
    if (limpio && i < 5) campos.current[i + 1]?.focus();
    if (nuevos.join("").length === 6) void entrar(nuevos.join(""));
  }

  function teclaDigito(i: number, e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Backspace" && !digitos[i] && i > 0) {
      e.preventDefault();
      campos.current[i - 1]?.focus();
    }
    if (e.key === "ArrowLeft" && i > 0) {
      e.preventDefault();
      campos.current[i - 1]?.focus();
    }
    if (e.key === "ArrowRight" && i < 5) {
      e.preventDefault();
      campos.current[i + 1]?.focus();
    }
  }

  return (
    <div className="grid min-h-dvh place-items-center px-4 py-5">
      <div className="flex w-full max-w-sm flex-col gap-6">
        <div className="flex flex-col gap-1">
          <strong className="font-display text-[44px] leading-none font-extrabold tracking-tight">
            Rutas-A
          </strong>
          <span className="text-sm text-tinta-2">Tu registro de rutas, pedidos y pagos.</span>
        </div>

        {paso === "correo" ? (
          <form className="flex flex-col gap-4" onSubmit={(e) => void enviarCodigo(e)} noValidate>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="correo" className="text-sm font-semibold">
                Tu correo
              </label>
              <input
                id="correo"
                name="correo"
                type="email"
                autoComplete="email"
                inputMode="email"
                placeholder="nombre@correo.com"
                value={correo}
                onChange={(e) => setCorreo(e.target.value)}
                required
                className="min-h-[52px] rounded-btn border border-linea-fuerte bg-sup px-4 text-base"
              />
              <span className="text-xs text-tinta-3">
                Te enviamos un código de 6 dígitos. No hay contraseña que recordar.
              </span>
            </div>

            {error && <Error texto={error} />}

            <button type="submit" className="boton-principal" disabled={enviando}>
              {enviando ? "Enviando…" : "Enviarme el código"}
            </button>

            <p className="text-xs text-tinta-3">
              Las cuentas las crea el administrador. Si tu correo no está registrado, pídele acceso.
            </p>
          </form>
        ) : (
          <form
            className="flex flex-col gap-4"
            onSubmit={(e) => {
              e.preventDefault();
              if (codigo.length === 6) void entrar(codigo);
            }}
            noValidate
          >
            <div className="flex flex-col gap-1.5">
              <label htmlFor="d0" className="text-sm font-semibold">
                Código de 6 dígitos
              </label>
              <div className="flex justify-between gap-2">
                {digitos.map((d, i) => (
                  <input
                    key={i}
                    id={`d${i}`}
                    ref={(el) => {
                      campos.current[i] = el;
                    }}
                    type="text"
                    inputMode="numeric"
                    autoComplete={i === 0 ? "one-time-code" : "off"}
                    maxLength={6}
                    aria-label={`Dígito ${i + 1}`}
                    value={d}
                    disabled={enviando}
                    onChange={(e) => escribirDigito(i, e.target.value)}
                    onKeyDown={(e) => teclaDigito(i, e)}
                    className={`min-h-[58px] w-full max-w-[54px] rounded-btn border bg-sup text-center font-mono text-2xl font-medium ${
                      d ? "border-acento" : "border-linea-fuerte"
                    }`}
                  />
                ))}
              </div>
              <span className="text-xs text-tinta-3">
                Lo enviamos a <b>{correo}</b>. Vence en 10 minutos.
              </span>

              {/* En local, Supabase no manda correos de verdad: los atrapa en un
                  buzón. El enlace se abre en otra pestaña porque desde el
                  celular es la única forma de leer el código. */}
              {buzon && (
                <span className="rounded-btn bg-aviso-suave px-3 py-2 text-xs text-aviso">
                  <b>Estás en local:</b> el código no llega a tu correo. Ábrelo en{" "}
                  <a href={buzon} target="_blank" rel="noreferrer" className="font-bold underline">
                    el buzón de prueba
                  </a>
                </span>
              )}
            </div>

            {error && <Error texto={error} />}

            <button
              type="submit"
              className="boton-principal"
              disabled={enviando || codigo.length !== 6}
            >
              {enviando ? "Comprobando…" : "Entrar"}
            </button>

            <div className="flex flex-wrap items-center justify-between gap-2">
              <button
                type="button"
                className="min-h-11 px-2 text-sm font-semibold text-acento"
                onClick={() => {
                  setPaso("correo");
                  setDigitos(["", "", "", "", "", ""]);
                  setError(null);
                }}
              >
                Usar otro correo
              </button>
              <button
                type="button"
                disabled={segundos > 0 || enviando}
                onClick={() => void enviarCodigo()}
                className="min-h-11 px-2 text-sm font-semibold text-acento disabled:text-tinta-3"
              >
                {segundos > 0
                  ? `Reenviar en 0:${String(segundos).padStart(2, "0")}`
                  : "Reenviar código"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

function Error({ texto }: { texto: string }) {
  return (
    <div role="alert" className="flex gap-3 rounded-btn bg-mal-suave px-4 py-3 text-sm text-mal">
      <Alerta className="mt-0.5 size-[18px] shrink-0" />
      <p>{texto}</p>
    </div>
  );
}
