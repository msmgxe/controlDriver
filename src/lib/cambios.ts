/**
 * Avisar a las pantallas de que los datos cambiaron desde fuera de ellas.
 *
 * Cada pantalla lee la base cuando se abre y la vuelve a leer cuando ella
 * misma guarda algo. Pero hay cosas que se guardan **desde otro sitio**: la
 * hoja de comandas que se abre desde el botón «Cargar» de la barra de abajo
 * guarda pedidos mientras Inicio sigue debajo, mirando el mismo día. Sin este
 * aviso, Inicio seguiría enseñando lo de antes hasta salir y volver a entrar.
 *
 * Es un aviso, no un almacén: no lleva datos, solo dice «vuelve a mirar».
 */
const oyentes = new Set<() => void>();

/** Algo se guardó: que las pantallas abiertas vuelvan a leer. */
export function avisarDeCambios(): void {
  for (const oyente of [...oyentes]) oyente();
}

/** Escuchar los avisos; devuelve cómo dejar de hacerlo. */
export function alHaberCambios(oyente: () => void): () => void {
  oyentes.add(oyente);
  return () => {
    oyentes.delete(oyente);
  };
}
