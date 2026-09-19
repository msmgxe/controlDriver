"use client";

import { PantallaDeFallo } from "@/components/PantallaDeFallo";
import "./globals.css";

/**
 * El último recurso: cuando falla el propio armazón de la aplicación.
 *
 * Sustituye a todo, así que tiene que traer su `<html>` y su `<body>`, y
 * cargar los estilos por su cuenta.
 */
export default function ErrorGlobal({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  return (
    <html lang="es">
      <body className="bg-papel text-tinta">
        <PantallaDeFallo error={error} alReintentar={retry} />
      </body>
    </html>
  );
}
