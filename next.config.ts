import type { NextConfig } from "next";

/**
 * Cabeceras de seguridad fijas (§7).
 *
 * La `Content-Security-Policy` no está aquí: lleva un nonce distinto en cada
 * petición, así que se pone en `src/proxy.ts`. Estas son las que no cambian.
 */
const cabecerasDeSeguridad = [
  {
    // Sin esto, un archivo servido con el tipo equivocado puede acabar
    // ejecutándose como script.
    key: "X-Content-Type-Options",
    value: "nosniff",
  },
  {
    // No se filtra la ruta completa —que puede llevar una fecha de jornada— a
    // sitios de terceros.
    key: "Referrer-Policy",
    value: "strict-origin-when-cross-origin",
  },
  {
    // Solo lo que la app usa de verdad. `publickey-credentials-get` tiene que
    // quedar permitido: es el desbloqueo por huella (§ bloqueo local).
    key: "Permissions-Policy",
    value: [
      "accelerometer=()",
      "camera=()",
      "geolocation=()",
      "gyroscope=()",
      "magnetometer=()",
      "microphone=()",
      "payment=()",
      "usb=()",
      "publickey-credentials-get=(self)",
    ].join(", "),
  },
  {
    // Redundante con `frame-ancestors 'none'` de la CSP, pero cubre navegadores
    // viejos que no la aplican.
    key: "X-Frame-Options",
    value: "DENY",
  },
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
];

/**
 * ¿Se está compilando lo que va dentro del APK?
 *
 * La misma base de código produce dos cosas distintas:
 *
 *   · **el APK** — páginas estáticas que se meten dentro de la aplicación
 *     Android y se abren sin servidor. Los datos salen de SQLite, en el propio
 *     teléfono.
 *   · **la web** — el panel del administrador, que sí corre en un servidor,
 *     consulta la base compartida y emite las licencias.
 *
 * No son dos aplicaciones: son dos salidas del mismo código. Lo que cambia es
 * qué pantallas entran y de dónde vienen los datos.
 */
const paraMovil = process.env.DESTINO === "movil";

const nextConfig: NextConfig = {
  /* Exportación estática: sin servidor, todo son archivos. Es la única forma
     de que Capacitor pueda empaquetarlo. */
  ...(paraMovil
    ? { output: "export" as const, images: { unoptimized: true }, trailingSlash: true }
    : {}),

  /* Orígenes desde los que se puede abrir la app en desarrollo.

     Al probar en el celular la app no se abre en localhost sino en un túnel
     HTTPS con nombre aleatorio, y `next dev` rechaza sus recursos internos si
     el origen no está en esta lista. En producción esta opción se ignora. */
  allowedDevOrigins: ["*.trycloudflare.com"],

  /* Las cabeceras las pone un servidor al responder, y en el APK no hay
     servidor: las páginas se leen del propio aparato. Dentro de la aplicación
     esa protección la da Android, no una cabecera HTTP. */
  async headers() {
    if (paraMovil) return [];
    return [
      {
        source: "/:ruta*",
        headers: cabecerasDeSeguridad,
      },
      {
        // La app es privada: nada debe indexarse, ni siquiera si alguien
        // adivina una URL.
        source: "/:ruta*",
        headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }],
      },
    ];
  },
};

export default nextConfig;
