/**
 * Clave pública de las licencias. La genera `npm run licencia -- claves`.
 *
 * Es pública por diseño: sirve para **comprobar** firmas, no para crearlas.
 * Que alguien la lea no le permite fabricarse una licencia. La que firma vive
 * solo en ~/.rutas-a, en la Mac de quien administra.
 */
export const CLAVE_PUBLICA: JsonWebKey | null = {"key_ops":["verify"],"ext":true,"kty":"EC","x":"BPBS_V3bADJq3bZAML62naW8mQhz3QLb7ywJPGrz0RM","y":"3KHUZvtkZJIQTkd9O3RP4ZduXPxN0_F7F7YV-5JSc-c","crv":"P-256"};
