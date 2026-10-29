# Rediseño 2.0 de Control Driver: encargo para el código real

Pedido del dueño: «la versión actual me gusta pero hay que pulir y simplificar; las opciones que son solo texto deben ser botones con colores de fondo para diferenciarlas; más animaciones, imágenes y figuras; que se sienta fácil, amigable y rápida». Implementar **todo** el rediseño aprobado en el prototipo.

## Fuente visual (qué construir)
El prototipo navegable está en `prototipo/rediseno-v2.html`, armado con los módulos de `prototipo/v2/`:
`10-inicio.js` (Inicio, Cargar, Más, Subir más, Día, Pedido, visor de foto, rutas) · `20-captura.js` (Comandas, revisión de comanda, Adicionales/Expo Vino, Apoyo, detalle de registro, Revisión, Compartir) · `30-pagos.js` (Pagos, Estadísticas, Historial, Buscar, Cotejo, registrar pago) · `40-ajustes.js` (Ajustes, Tutoriales, Acerca de, Bloqueo, Aviso legal, Sin conexión, Error). Cada pantalla trae un campo `cambios:[…]` que resume qué cambia. Léelo antes de tocar la tuya, y también `prototipo/v2/CONTRATO.md` (principios) e `INVENTARIO.md`.
El prototipo es una **guía de diseño y de comportamiento, no código a pegar**: la app real es Next.js + Tailwind y tiene lógica, base de datos y pruebas que hay que conservar.

## Lo que ya existe (cimientos; NO lo cambies, úsalo)
- `src/components/Acciones.tsx`: `ACCION` (clave → color + icono), `TileDeAccion`, `FilaDeColor`, `FiguraDeAccion`, `BotonDeAccion`. **Una acción = un color + una figura**: comanda azul, cantidad verde, a mano naranja, fotos morado, adicional vino, taxi amarillo, apoyo turquesa, pagos verde, estadísticas violeta, buscar celeste, historial ocre, tutoriales rosa, ajustes gris azulado, licencia azul marino.
- `src/components/iconos.tsx`: iconos nuevos `Cantidad, Lapiz, Galeria, Copa, Engranaje, Historial, Llave, Escudo, Basura` (además de los de antes). Puedes añadir más al FINAL del archivo (un solo cambio pequeño y al final, para no pisarte con otros).
- `src/app/globals.css` (final del archivo): tokens `--c-*`, `--toque`, `--escala`, clases `.tile-accion`, `.fila-color`, `.boton-accion`, `.fig-color`, animaciones `.rise-v2 .pop-v2 .bob-v2` (úsalas con `style={{animationDelay}}` para escalonar). Los botones existentes (`boton-principal`, `boton-segundo`, `boton-sec`, `boton-fila`) ya tienen relieve y respetan `--toque`. **Si necesitas CSS nuevo, ponlo con prefijo propio (`.ini-`, `.reg-`, `.com-`, `.pag-`, `.aju-`) en un bloque nuevo AL FINAL de globals.css dentro de `/* === módulo X === */`.** No edites lo existente.
- Ajustes visuales del usuario (`src/lib/apariencia.ts`, atributos `data-letra/tamano/botones/toques/anim` en <html>): el texto debe usar `rem`/clases de Tailwind (`text-sm`…), no px fijos, para que el tamaño de letra funcione; los toques mínimos con `min-h-[var(--toque)]`.
- Arranque: el splash ya dura 1 s menos. No lo alargues.

## Principios
1. Todo lo que se toca es un **botón** (relleno o con borde), nunca un enlace subrayado ni texto suelto. Cada ⚠ del inventario debe terminar siendo botón/chip/píldora.
2. **Menos texto, más figura**: títulos cortos, una frase de ayuda como mucho, iconos, ilustraciones SVG pequeñas en estados vacíos, el auto animado (`Auto`).
3. **Un solo botón principal** por pantalla, grande. Lo demás, secundario.
4. **Movimiento con intención**: entrada escalonada, contadores (`useCifraAnimada`), anillos y barras que crecen, confeti/aviso al guardar si el proyecto ya tiene sonido/aviso (`sonar`), nada que parpadee.
5. Claro y oscuro: solo tokens (`bg-sup`, `text-tinta`, `var(--c-…)`), nunca colores literales que fallen en un tema. Blanco sobre el color de acción está bien.
6. Toques ≥ 44 px. Textos en español peruano sencillo.

## SEGURIDAD AL ELIMINAR (obligatorio)
Toda acción destructiva (borrar pedido, día, ruta, foto, registro de apoyo/adicional, tipo de adicional, zona de tarifa, ubicación de la tienda, datos del cliente, respaldo restaurado, borrar datos de ejemplo, quitar bloqueo/PIN, salir) **debe pedir confirmación** con `DialogoConfirmar` o la confirmación en línea de dos pasos que ya existe, con el nombre de lo que se borra y su consecuencia, botón rojo «Sí, …» y «Cancelar». No confirmar al apagar una casilla o filtro (reversible). Si en tu zona encuentras una acción destructiva SIN confirmación, **añádela**. Al rediseñar, no pierdas ninguna confirmación existente.

## Reglas de trabajo
- Conserva TODA la lógica de negocio, la base de datos y las acciones: este encargo es de presentación e interacción. Ningún cambio en `src/lib/**` salvo que tu encargo lo diga.
- Edita SOLO los archivos de tu encargo (puedes crear componentes nuevos con nombre propio). Hay otros agentes trabajando a la vez en otros archivos del mismo repositorio.
- Sin dependencias nuevas, sin `alert/confirm/prompt`.
- NO ejecutes `next build`, `next dev` ni `npm run apk` (rompen la carpeta .next de los demás). Verifica con `npx tsc --noEmit -p .` (si fallan archivos de OTROS agentes en curso, ignóralos y repite después), `npx eslint <tus archivos>` y `npx vitest run` (todas las pruebas deben seguir pasando).
- El Next.js de este proyecto no es el que conoces (ver AGENTS.md): en archivos que ya son componentes de cliente, modifica solo JSX/clases. No cambies rutas ni la estructura de archivos de `src/app`.
- No hagas commits: yo integro.
- Informe final (≤200 palabras): archivos tocados, qué quedó hecho, qué quedó pendiente o demostrativo, y cualquier acción destructiva que encontraste sin confirmar.
