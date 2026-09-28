/**
 * Si ya se vio el recorrido guiado de «Cómo registrar tus pedidos por día».
 *
 * Se dispara solo, una vez, la primera vez que se abre la app —después de la
 * marca, el aviso legal y el PIN, con Inicio ya a la vista—, porque es el
 * paso que más se pregunta y el que más ayuda señalar sobre el botón real.
 * Después queda disponible para repetirlo desde Tutoriales, pero no vuelve a
 * saltar solo: una vez visto, se guarda, y no se pregunta más.
 */
const CLAVE = "rutas-a.recorrido-registrar-visto";

export function recorridoYaVisto(): boolean {
  try {
    return localStorage.getItem(CLAVE) === "1";
  } catch {
    return true; // Sin almacenamiento no se puede recordar: mejor no interrumpir cada vez.
  }
}

export function marcarRecorridoVisto(): void {
  try {
    localStorage.setItem(CLAVE, "1");
  } catch {
    /* Sin almacenamiento no queda guardado: se ofrecerá de nuevo la próxima vez, no es grave. */
  }
}
