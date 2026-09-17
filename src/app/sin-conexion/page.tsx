import { Alerta } from "@/components/iconos";

export const metadata = { title: "Sin conexión" };

/**
 * Pantalla que sirve el service worker cuando no hay red y la página pedida no
 * estaba en caché (§8).
 *
 * Vive fuera del layout autenticado a propósito: sin red no se puede comprobar
 * la sesión, y mandar a /acceso a alguien que ya tiene sesión solo porque está
 * en un sótano sin cobertura sería peor que esto.
 */
export default function PaginaSinConexion() {
  return (
    <div className="grid min-h-dvh place-items-center px-4">
      <div className="flex max-w-sm flex-col items-center gap-4 text-center">
        <span className="grid size-14 place-items-center rounded-full bg-aviso-suave text-aviso">
          <Alerta className="size-7" />
        </span>
        <h1 className="text-2xl">Sin conexión</h1>
        <p className="text-sm text-tinta-2">
          Esta pantalla no la habías abierto todavía, así que no está guardada en el celular. Lo que
          ya viste —tu historial y tus estadísticas— sigue disponible.
        </p>
        <p className="text-sm text-tinta-2">
          Para cargar capturas sí necesitas red: tus fotos siguen en la galería y no se pierden.
        </p>
      </div>
    </div>
  );
}
