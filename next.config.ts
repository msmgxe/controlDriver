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

const nextConfig: NextConfig = {
  /* Orígenes desde los que se puede abrir la app en desarrollo.

     Al probar en el celular la app no se abre en localhost sino en un túnel
     HTTPS con nombre aleatorio, y `next dev` rechaza sus recursos internos si
     el origen no está en esta lista. En producción esta opción se ignora. */
  allowedDevOrigins: ["*.trycloudflare.com"],

  async headers() {
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
