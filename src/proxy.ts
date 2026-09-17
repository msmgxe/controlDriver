import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Protección de rutas (§7).
 *
 * En Next.js 16 el fichero `middleware.ts` se renombró a `proxy.ts` y la
 * función exportada pasa a llamarse `proxy`. El comportamiento es el mismo.
 *
 * Aquí se hacen solo dos cosas, las que exigen estar antes del render:
 *   1. Refrescar la sesión de Supabase y devolver las cookies actualizadas.
 *   2. Mandar a /acceso a quien no tenga sesión.
 *
 * La comprobación de `activo`, `vigente_hasta` y `rol` NO se hace aquí sino en
 * el layout autenticado, con `perfilActual()`. El proxy puede desplegarse en
 * el CDN y conviene que no dependa de una consulta a la base de datos en cada
 * petición; el layout la hace una sola vez por render y con RLS de por medio.
 */

const RUTAS_PUBLICAS = ["/acceso", "/auth"];

export async function proxy(request: NextRequest) {
  let respuesta = NextResponse.next({ request });

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
          respuesta = NextResponse.next({ request });
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

  const ruta = request.nextUrl.pathname;
  const esPublica = RUTAS_PUBLICAS.some((p) => ruta === p || ruta.startsWith(p + "/"));

  if (!user && !esPublica) {
    const destino = request.nextUrl.clone();
    destino.pathname = "/acceso";
    // Para volver donde estaba después de entrar.
    destino.searchParams.set("volver", ruta);
    return NextResponse.redirect(destino);
  }

  if (user && ruta === "/acceso") {
    const destino = request.nextUrl.clone();
    destino.pathname = "/";
    destino.search = "";
    return NextResponse.redirect(destino);
  }

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
