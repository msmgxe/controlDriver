# Versiones de Rutas-A

Cada compilación sube el número y deja el archivo como `Rutas-A-v<N>.apk`. El
anterior se borra, para que no haya forma de instalar por error el de hace tres
cambios. La versión instalada se ve en **Ajustes**, arriba del todo.

---

## ¿Cuántas versiones hacen falta para ajustar una app?

No hay un número fijo, pero sí un patrón, y conviene conocerlo antes de
impacientarse:

**Las primeras versiones caen rápido y arreglan mucho.** Cada vez que la app se
usa de verdad aparecen entre tres y cinco problemas, casi todos evidentes en
cuanto se ven —y casi ninguno visible desde el código—. Esa fase dura unas 10 o
15 versiones.

**Luego se estabiliza.** Las siguientes veinte arreglan cosas cada vez más
pequeñas y cada vez más difíciles de encontrar. Aquí el ritmo lo marca el uso:
si la usan veinte personas en vez de una, salen veinte veces más casos raros.

**Y después ya no son arreglos, son cambios.** Lo que se pide deja de ser "esto
está mal" y pasa a ser "sería mejor si…". Eso no se acaba nunca, y es buena
señal.

Un dato de este proyecto: **las seis primeras versiones salieron en un solo
día**, y las tres primeras veces que la app tocó un teléfono de verdad
aparecieron once problemas que no se veían de ninguna otra forma.

La conclusión práctica: **probarla en el celular es lo que hace avanzar esto**,
más que cualquier rato añadiendo código. Cada tanda de comentarios tuyos vale
más que una tarde de trabajo a ciegas.

---

## Historial

### v15 — 19/09/2026
- **Nuevo:** se pueden crear, editar y borrar rutas a mano, en Revisión y en
  el detalle de un día guardado. Sin esto no había dónde asignarle una ruta a
  un pedido cuando la captura de Rutas salía cortada o el día se escribía
  entero a mano: el selector de ruta aparecía vacío.
- Borrar una ruta no borra sus pedidos: se quedan sin ruta, y se ven para
  asignarles otra.

### v14 — 19/09/2026
- **Arreglado:** «No se pudo abrir la base de datos ·
  *Connection rutas-a already exists*». Al recargarse la pantalla —lo hacía al
  pasar de un día al siguiente en una carga de varios—, Android seguía con la
  base abierta y la app intentaba abrirla otra vez. Ya no se recarga, se
  reutiliza la conexión, y el botón «Volver a intentar» ahora funciona de
  verdad.
- **Arreglado:** el resumen de la captura se leía al revés. Los tres rótulos
  salen seguidos y luego las tres cifras, y se emparejaban mal: «14» acababa en
  «No entregado». Ese era el origen de los pedidos en rojo.
- **Arreglado:** el estado no se reconocía porque el ✓ se lee como `|`, `•` o
  `V` delante de la palabra.
- **Nuevo:** en un día guardado se puede corregir el código, la ruta y el
  estado de un pedido, no solo el tramo.
- **Nuevo:** un pedido vive en el día más antiguo en que aparece. Si cargas el
  17 después del 18, los pedidos que el 18 tenía como arrastre se pasan al 17 y
  se le quitan al 18.

### v13 — 19/09/2026
- **Nuevo: firma propia.** La app se firma con una clave tuya, guardada en
  `~/.rutas-a`, en vez de la de pruebas. Sin esto, perder la clave de pruebas
  habría obligado a todos a desinstalar —y perder sus datos— para actualizar.
  **Esta versión no se instala encima de las anteriores**: hay que
  desinstalar una vez.
- **Nuevo: licencias de verdad.** 30 días de prueba automáticos al instalar;
  después, licencia por teléfono. Se emiten con `npm run licencia` (ver
  LICENCIAS.md).
- **Nuevo:** Ajustes → Tu licencia: el código del teléfono para copiar, y dónde
  pegar la licencia.
- **Nuevo:** aviso suave cuando quedan 5 días o menos.

### v12 — 19/09/2026
- **Arreglado:** las capturas se reducían a 1600 px antes de leerlas, un tope
  que venía de cuando se mandaban a un modelo en la nube. Una captura de
  2712 px se leía al 59 %, y las etiquetas pequeñas de «Ruta 1» se perdían.
  Ahora se leen a su tamaño real (hasta 3200 px). Las pruebas se siguen
  guardando reducidas, para no llenar el teléfono.
- **Cambiado:** hasta 24 capturas por carga (antes 12).
- **Nuevo:** botón **Inicio** arriba a la derecha, en todas las pantallas.
- **Nuevo:** el error de una carga se puede copiar con un botón.

### v11 — 19/09/2026
- **Arreglado:** la carga podía quedarse trabada en «Leyendo capturas…» para
  siempre. Una parte del proceso estaba fuera de toda red: si fallaba, nadie
  recogía el error.
- **Nuevo:** si una pantalla falla, en vez de quedarse en blanco sale un aviso
  con botón para reintentar o ir al inicio, y el detalle del error **en texto**
  para copiarlo y mandarlo.
- **Arreglado:** un dato imposible en una captura —una hora 25:10, una
  «Ruta 0»— tiraba la captura entera. Ahora se pierde solo ese dato.
- **Arreglado:** abrir la base de datos ya no depende de que todas las
  instrucciones del esquema salgan bien.
- **Cambiado:** la lista de pedidos es plana, un pedido por fila: el código, y
  al lado su ruta con la hora y el estado. El monto, tenue.
- **Cambiado:** «No entregado» ya no sale en rojo: se paga igual.
- **Arreglado:** en el detalle de un día guardado, un pedido sin ruta no se
  veía en ningún sitio.
- **Cambiado:** tipografías y formas de la infografía: Bricolage para títulos,
  Figtree para texto, rutas en píldoras turquesa.

### v10 — 19/09/2026
- **Arreglado:** el mismo día salía S/ 20 en Inicio y S/ 130 en el detalle.
  Cada pantalla calculaba el monto a su manera; ahora todas usan la misma
  función, que cobra el mayor entre los pedidos y el piso de permanencia. En
  el Historial, el día pagado por piso lo dice.
- **Arreglado:** un día de 14 pedidos se quedaba en 2. La regla del arrastre de
  la v9 era demasiado agresiva: un solo pedido mal leído como «Ruta 1»
  arrastraba al descarte a todos los sin ruta de encima. Ahora solo se
  descarta un pedido sin ruta si está encajado en el bloque de arriba.
- **Arreglado:** la regla de la hora ya no se aplica con números de ruta
  deducidos, y «ya guardado» solo cuenta si el otro día es anterior.
- **Nuevo:** tope de seguridad. Si el descarte fuera a quitar más de medio día,
  no se quita nada y se avisa.
- **Nuevo:** lo descartado como arrastre se puede recuperar con un toque en
  Revisión: «Contarlos igual en este día».
- **Arreglado:** un fallo en la migración de la base ya no impide abrir la app.

### v9 — 19/09/2026
Hecha a partir de las capturas reales de la app de reparto, que por fin
llegaron.
- **Arreglado:** contaba de más. La lista de un día abre con una o dos rutas
  de la noche anterior (20:21, 21:24) que ya se cuentan ese día. Se reconocen
  porque la hora retrocede al pasar a la mañana, y porque un pedido no puede
  estar guardado en dos días. Así salían 16 pedidos en un día de 12.
- **Arreglado:** las rutas se numeraban por hora; ahora por el orden de la
  lista de la app, que es el que usan los pedidos con su «Ruta 1».
- **Arreglado:** el lector confundía el `14` del contador de órdenes con el
  número de una ruta, y no entendía los iconos del resumen.
- **Arreglado:** la etiqueta de ruta de cada pedido va en su misma fila; ahora
  se busca ahí primero.
- **Nuevo:** en Revisión cada pedido se puede corregir —código, ruta, estado,
  tramo— o borrar, con confirmación. Los pedidos sin ruta son filas tocables.
- **Nuevo:** en un día guardado también se puede borrar un pedido.
- **Nuevo:** las capturas guardadas se pasan deslizando, como un carrusel.
- **Arreglado:** se guardaban repetidas —33 de un día de 11—. Ya no, y las que
  había se limpian solas al abrir el día.
- **Arreglado:** los pedidos se ordenan por la hora de su ruta.
- **Arreglado:** tras editar un día guardado, el cambio no se veía hasta salir.
- **Arreglado:** una base de una versión anterior no recibía las columnas
  nuevas. Ahora se migra sola al abrir la app.

### v8 — 19/09/2026
Tercera tanda del uso real. La lectura se reescribió a partir de cómo son de
verdad las capturas: rutas por un lado, **pedidos agrupados por ruta** por
otro, y las dos se repiten por el scroll.
- **Arreglado:** solo el primer pedido de cada ruta encontraba su ruta. En la
  pantalla de pedidos, `Ruta 4` sale una vez arriba y vale para todos los de
  debajo; se buscaba junto a cada pedido.
- **Arreglado:** una captura que empieza a mitad de una ruta hereda esa ruta de
  la captura anterior.
- **Arreglado:** las rutas repetidas por el scroll se pisaban y salían con el
  horario de otra. Ahora se emparejan por horario, no por número.
- **Arreglado:** los pedidos seguían en rojo. Si la tarjeta de resumen dice
  cero no entregados, ningún pedido puede estarlo.
- **Arreglado:** no dejaba guardar si un pedido apuntaba a una ruta que no
  estaba. Ahora se guarda sin ruta y se avisa.
- **Arreglado:** las capturas se ordenan por la hora en que se tomaron, no por
  cómo las devuelve la galería.

### v7 — 19/09/2026
- El APK lleva el número de versión en el nombre, y la app lo enseña en Ajustes.
- Registro de versiones (este archivo).

### v6 — 19/09/2026
Segunda tanda del uso real.
- **Arreglado:** los pedidos salían como «No entregado» en rojo. La tarjeta de
  resumen se leía como si fuera el estado de los pedidos.
- **Arreglado:** los pedidos no encontraban su ruta —mismo origen—.
- **Arreglado:** no dejaba guardar. Ahora solo bloquea lo que haría guardar un
  dato incorrecto; lo demás avisa.
- **Nuevo:** las capturas se guardan como prueba de cada día.
- **Nuevo:** pedidos a mano, con foto opcional.

### v5 — 19/09/2026
Primera tanda del uso real.
- **Nuevo:** se pueden subir capturas de varios días de una vez.
- **Arreglado:** el botón de atrás cerraba la aplicación.
- **Cambiado:** el inicio se reorganizó con selector de fecha y secciones
  plegables.
- **Arreglado:** las rutas legibles salían marcadas como «cortadas».

### v4 — 19/09/2026
- **Nuevo:** las capturas se leen en el propio teléfono, sin Anthropic y sin
  internet. Gratis y sin señal.
- El APK baja de 56 a 29 MB al dejar fuera las arquitecturas de Intel.

### v3 — 19/09/2026
- **Nuevo:** la aplicación entera entra en el APK. Diez pantallas sobre la base
  local, sin login ni servidor.
- **Nuevo:** licencias mensuales firmadas, verificables sin señal.

### v2 — 19/09/2026
- Cambio de nombre a Rutas-A. El identificador pasa a `pe.rutasa.app`.
- **Nuevo:** base de datos local (SQLite) en el teléfono.
- **Nuevo:** tarifas por vehículo, para las motos.

### v1 — 19/09/2026
- Prueba de que la cadena Next → Capacitor → Gradle → APK funciona.

---

## Cómo anotar una versión nueva

Al terminar `npm run apk`, añadir arriba del historial:

```
### v<N> — <fecha>
- **Arreglado:** …
- **Nuevo:** …
- **Cambiado:** …
```

Escrito para quien lo va a leer dentro de seis meses sin acordarse de nada:
qué cambió y por qué importaba, no qué archivo se tocó.
