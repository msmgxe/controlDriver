import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import { revisarConfiguracion } from "@/lib/configuracion";

/**
 * Protección de rutas y cabeceras de seguridad (§7).
 *
 * En Next.js 16 el fichero `middleware.ts` se renombró a `proxy.ts` y la
 * función exportada pasa a llamarse `proxy`. El comportamiento es el mismo.
 *
 * Aquí se hacen las tres cosas que exigen estar antes del render:
 *   1. Generar el nonce de la CSP y ponerlo en la petición, para que Next se lo
 *      aplique a sus propios scripts.
 *   2. Refrescar la sesión de Supabase y devolver las cookies actualizadas.
 *   3. Mandar a /acceso a quien no tenga sesión.
 *
 * La comprobación de `activo`, `vigente_hasta` y `rol` NO se hace aquí sino en
 * el layout autenticado, con `perfilActual()`. El proxy puede desplegarse en el
 * CDN y conviene que no dependa de una consulta a la base en cada petición.
 */

const RUTAS_PUBLICAS = ["/acceso", "/auth", "/configuracion", "/sin-conexion"];

/**
 * Orígenes a los que el navegador puede hablar para llegar a Supabase.
 *
 * Se incluye el de la API y su equivalente en websocket, que es por donde va
 * realtime. Si la URL no es válida no se añade nada: mejor una CSP estricta que
 * una permisiva por accidente.
 */
function origenesDeSupabase(): string[] {
  try {
    const url = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "");
    const ws = url.protocol === "https:" ? "wss:" : "ws:";
    return [url.origin, `${ws}//${url.host}`];
  } catch {
    return [];
  }
}

export async function proxy(request: NextRequest) {
  /* --- 1. CSP con nonce (§7) ---
     Un nonce nuevo por petición: si fuera predecible no serviría de nada.
     `strict-dynamic` deja que los scripts que sí llevan nonce carguen los
     suyos, que es como Next arranca la hidratación. */
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const enDesarrollo = process.env.NODE_ENV === "development";

  const csp = [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${enDesarrollo ? " 'unsafe-eval'" : ""}`,
    // Los estilos en línea se permiten a propósito: el gráfico de Estadísticas
    // calcula la altura de cada barra con un atributo `style`, y un atributo de
    // estilo no ejecuta código.
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' blob: data:",
    "font-src 'self' data:",
    // El navegador habla directamente con Supabase: auth, consultas y realtime.
    // El origen se deriva de la URL configurada en vez de dejarlo a fuego,
    // porque no siempre es la nube: en local es 127.0.0.1:54321 y, al probar
    // desde el celular, la IP del Mac en la red. Con un dominio fijo aquí, el
    // navegador bloquearía la petición antes de que saliera y el login fallaría
    // con un "no se pudo enviar el código" que no dice nada de la causa.
    `connect-src 'self' ${origenesDeSupabase().join(" ")}`,
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "upgrade-insecure-requests",
  ].join("; ");

  const cabecerasPeticion = new Headers(request.headers);
  cabecerasPeticion.set("x-nonce", nonce);
  cabecerasPeticion.set("Content-Security-Policy", csp);

  let respuesta = NextResponse.next({ request: { headers: cabecerasPeticion } });

  /* --- 1b. ¿Está configurado el entorno? ---
     Sin las claves de Supabase el cliente lanza al construirse y todo acabaría
     en un 500 sin explicación. Mejor una pantalla que diga qué falta: así se
     puede desplegar y abrir la app en el celular antes de tener la base. */
  const configuracion = revisarConfiguracion();
  if (!configuracion.completa) {
    if (request.nextUrl.pathname === "/configuracion") return conCabeceras(respuesta, csp);
    const destino = request.nextUrl.clone();
    destino.pathname = "/configuracion";
    destino.search = "";
    return conCabeceras(NextResponse.redirect(destino), csp);
  }

  /* --- 2. Sesión de Supabase --- */
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesPorEscribir) {
          for (const { name, value } of cookiesPorEscribir) {
            request.cookies.set(name, value);
          }
          respuesta = NextResponse.next({ request: { headers: cabecerasPeticion } });
          for (const { name, value, options } of cookiesPorEscribir) {
            respuesta.cookies.set(name, value, options);
          }
        },
      },
    },
  );

  // No meter nada entre createServerClient y getUser: getUser refresca el token
  // y cualquier cosa en medio puede dejar la sesión a medio escribir.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  /* --- 3. Puerta de acceso --- */
  const ruta = request.nextUrl.pathname;
  const esPublica = RUTAS_PUBLICAS.some((p) => ruta === p || ruta.startsWith(p + "/"));

  if (!user && !esPublica) {
    const destino = request.nextUrl.clone();
    destino.pathname = "/acceso";
    destino.searchParams.set("volver", ruta);
    return conCabeceras(NextResponse.redirect(destino), csp);
  }

  if (user && ruta === "/acceso") {
    const destino = request.nextUrl.clone();
    destino.pathname = "/";
    destino.search = "";
    return conCabeceras(NextResponse.redirect(destino), csp);
  }

  return conCabeceras(respuesta, csp);
}

/**
 * Cabeceras que van en toda respuesta (§7).
 *
 * La CSP se pone aquí y no en `next.config.ts` porque lleva el nonce, que
 * cambia en cada petición. Las demás son fijas y viven en la configuración.
 */
function conCabeceras(respuesta: NextResponse, csp: string): NextResponse {
  respuesta.headers.set("Content-Security-Policy", csp);
  return respuesta;
}

export const config = {
  matcher: [
    /*
     * Todo menos los estáticos de Next, los iconos, el manifest y el service
     * worker. Las rutas /api/* sí pasan: también hay que protegerlas.
     */
    "/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest|sw.js|.*\\.(?:png|jpg|jpeg|gif|svg|webp|ico)$).*)",
  ],
};
