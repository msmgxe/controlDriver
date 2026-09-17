/*
 * Service worker de RutaLog (§8).
 *
 * Escrito a mano y servido tal cual, sin paso de build: Serwist todavía no
 * funciona con Turbopack, que es el bundler por defecto de Next 16, y forzar el
 * build a webpack por esto ataría el proyecto a un bundler que ya quedó atrás.
 * Lo que la app necesita cachear es modesto y cabe aquí.
 *
 * Tres reglas que no hay que relajar:
 *
 *  1. **`/api/*` no se cachea nunca.** Lo dice §8: ahí va la extracción, que
 *     cuesta dinero por llamada, y sus respuestas llevan códigos de pedido.
 *  2. **Supabase tampoco.** Son datos autenticados y con RLS; guardarlos en el
 *     disco del navegador saltaría esa frontera.
 *  3. **No se impone la versión nueva.** Recargar a la fuerza a alguien que
 *     está a mitad de una revisión le perdería el trabajo: la app avisa y él
 *     decide cuándo.
 *
 * Al cambiar algo aquí hay que subir VERSION, o los navegadores que ya tengan
 * el worker instalado no se enterarán.
 */

const VERSION = "rutalog-v1";
const CACHE_APP = `${VERSION}-app`;
const CACHE_ESTATICOS = `${VERSION}-estaticos`;
const CACHE_COMPARTIDO = "rutalog-compartido";
const SIN_CONEXION = "/sin-conexion";

/* El mínimo para que la app abra sin red. El resto se va cacheando conforme se
   visita, que es justo lo que pide §8: "historial y estadísticas ya vistos
   siguen disponibles". */
const APP_SHELL = [SIN_CONEXION, "/manifest.webmanifest", "/icono-192.png", "/icono-512.png"];

self.addEventListener("install", (evento) => {
  evento.waitUntil(
    caches.open(CACHE_APP).then((cache) => cache.addAll(APP_SHELL)),
    // Sin skipWaiting: la versión nueva espera a que el driver la acepte.
  );
});

self.addEventListener("activate", (evento) => {
  evento.waitUntil(
    (async () => {
      const nombres = await caches.keys();
      await Promise.all(
        nombres
          .filter((n) => n !== CACHE_APP && n !== CACHE_ESTATICOS && n !== CACHE_COMPARTIDO)
          .map((n) => caches.delete(n)),
      );
      await self.clients.claim();
    })(),
  );
});

/**
 * La app pide activar la versión nueva cuando el driver toca "Actualizar".
 */
self.addEventListener("message", (evento) => {
  if (evento.data && evento.data.tipo === "ACTIVAR_ACTUALIZACION") {
    self.skipWaiting();
  }
});

self.addEventListener("fetch", (evento) => {
  const peticion = evento.request;
  const url = new URL(peticion.url);

  /* --- Web Share Target (§8) ---
     Galería → Compartir → RutaLog. Android manda un POST con los archivos, y un
     POST no puede llevarlos a una página por la URL: se guardan aquí y la
     página los recoge. */
  if (peticion.method === "POST" && url.pathname === "/compartir") {
    evento.respondWith(recibirCompartido(peticion));
    return;
  }

  if (peticion.method !== "GET") return;

  // Nunca se cachea: la extracción cuesta dinero y lleva códigos de pedido.
  if (url.origin === self.location.origin && url.pathname.startsWith("/api/")) return;

  // Datos autenticados con RLS detrás: siempre de la red.
  if (url.hostname.endsWith(".supabase.co")) return;

  // Otros orígenes (tipografías, etc.): que decida el navegador.
  if (url.origin !== self.location.origin) return;

  /* Navegaciones: red primero, y si no hay, lo último que se vio de esa página.
     Si tampoco hay, la pantalla de sin conexión. */
  if (peticion.mode === "navigate") {
    evento.respondWith(redPrimero(peticion));
    return;
  }

  /* Estáticos de Next: el nombre lleva un hash, así que si está en caché es
     exactamente el mismo archivo. Se sirve de disco sin preguntar. */
  if (url.pathname.startsWith("/_next/static/")) {
    evento.respondWith(cachePrimero(peticion, CACHE_ESTATICOS));
    return;
  }

  // El resto (iconos, manifest): de caché al instante y se refresca por detrás.
  evento.respondWith(revalidando(peticion, CACHE_APP));
});

async function redPrimero(peticion) {
  const cache = await caches.open(CACHE_APP);
  try {
    const respuesta = await fetch(peticion);
    if (respuesta.ok) cache.put(peticion, respuesta.clone());
    return respuesta;
  } catch {
    const guardada = await cache.match(peticion);
    if (guardada) return guardada;
    const sinConexion = await cache.match(SIN_CONEXION);
    if (sinConexion) return sinConexion;
    return new Response("Sin conexión", { status: 503, headers: { "Content-Type": "text/plain" } });
  }
}

async function cachePrimero(peticion, nombreCache) {
  const cache = await caches.open(nombreCache);
  const guardada = await cache.match(peticion);
  if (guardada) return guardada;
  const respuesta = await fetch(peticion);
  if (respuesta.ok) cache.put(peticion, respuesta.clone());
  return respuesta;
}

async function revalidando(peticion, nombreCache) {
  const cache = await caches.open(nombreCache);
  const guardada = await cache.match(peticion);
  const enRed = fetch(peticion)
    .then((respuesta) => {
      if (respuesta.ok) cache.put(peticion, respuesta.clone());
      return respuesta;
    })
    .catch(() => null);
  return guardada || (await enRed) || new Response("", { status: 504 });
}

async function recibirCompartido(peticion) {
  try {
    const formulario = await peticion.formData();
    const archivos = formulario.getAll("imagenes").filter((v) => v instanceof File);

    const cache = await caches.open(CACHE_COMPARTIDO);
    // Se limpia lo anterior: si quedó algo de una vez que no se completó, no
    // queremos mezclarlo con las capturas de hoy.
    for (const clave of await cache.keys()) await cache.delete(clave);

    await Promise.all(
      archivos.map((archivo, i) =>
        cache.put(
          new Request(`/__compartido/${i}`),
          new Response(archivo, {
            headers: {
              "Content-Type": archivo.type || "image/jpeg",
              "X-Nombre": encodeURIComponent(archivo.name || `captura-${i}.jpg`),
            },
          }),
        ),
      ),
    );

    return Response.redirect(`/compartir?recibidas=${archivos.length}`, 303);
  } catch {
    return Response.redirect("/compartir?error=1", 303);
  }
}
