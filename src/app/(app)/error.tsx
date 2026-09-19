"use client";

import { PantallaDeFallo } from "@/components/PantallaDeFallo";

/**
 * Frontera de errores de las pantallas del repartidor.
 *
 * Sin ella, un fallo al pintar cualquier pantalla dejaba la aplicación entera
 * en blanco con un "Application error" en inglés y ninguna salida: la app no
 * se había cerrado, pero estaba muerta. Ahora falla solo esa pantalla, dentro
 * del armazón —el menú sigue ahí—, con un botón para reintentar.
 *
 * En esta versión de Next la función para reintentar se llama `retry`.
 */
export default function ErrorDePantalla({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  return <PantallaDeFallo error={error} alReintentar={retry} />;
}
