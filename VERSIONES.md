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

### v28 — 24/09/2026
- **Nuevo: anotar cuántos pedidos se hicieron, sin necesitar el código de
  ninguno todavía.** Para el día en que la captura se perdió, la app de
  reparto falló, o no hay cómo leerla: se anota el número ahora —"hice
  14 pedidos"— y cada uno se completa después, a su ritmo, con su código, su
  ruta y su estado, igual que se corrige cualquier otro pedido ya guardado.
  Mientras tanto cuentan para el pago de la semana con la tarifa de hoy:
  tramo 1 siempre —S/10 para el auto de siempre, la tarifa única para la
  moto eléctrica—, porque es lo único que se puede saber de un pedido sin
  más datos. En la lista se ven marcados como "Pedido sin código · toca para
  completar" hasta que se les pone el suyo de verdad.
- **Nuevo: foto de respaldo por pedido, no solo por día.** Al corregir un
  pedido ya guardado —venga de una captura, a mano, o solo por cantidad— se
  le puede adjuntar la foto de su comanda, aparte de las capturas del día
  entero. Es opcional, y sirve para lo mismo: si la tienda discute justo
  ese pedido, queda su respaldo.
- **Arreglado: no había forma de llegar a "añadir un pedido a mano" en un día
  sin nada guardado.** La pantalla de la jornada exigía que ya existiera un
  día guardado y, si no, se rendía entera a un "no hay nada aquí" sin
  ningún botón —había que subir una captura primero, aunque fuera
  justamente la captura la que faltaba—. Ahora la pantalla se abre igual,
  con las mismas puertas de siempre para añadir pedidos, y el día se crea
  solo con el primero. También se agregó el mismo atajo desde Inicio, en la
  tarjeta de un día sin nada cargado.
- **Arreglado (de fondo): una transacción con varias escrituras podía
  quedar a medias, sin avisar por qué.** Cada escritura volcaba la base
  entera a disco antes de terminar la transacción que la contenía; si esa
  transacción tenía más de una escritura —como agregar varios pedidos de
  golpe—, el vuelco a mitad de camino le rompía el estado a la base y la
  escritura siguiente fallaba con un error que no tenía nada que ver, y ni
  siquiera se podía deshacer lo ya hecho. Ahora el vuelco espera a que la
  transacción entera termine, como tenía que ser desde el principio.

### v26 — 22/09/2026
- **Arreglado: la cabina de la moto eléctrica iba al revés.** Quedaba junto a
  la rueda de atrás, detrás de la caja —como si el camión manejara para
  atrás—. Ahora va junto a la rueda de adelante, con la caja detrás, como
  cualquier camión de reparto de verdad y como en la imagen de referencia.

### v25 — 22/09/2026
- **Nuevo: más de una tienda, desde el teléfono.** En Ajustes → Tienda,
  modalidad y tarifa se agregan las tiendas que hagan falta y se elige para
  cuál es la carga de hoy —antes solo existía la que se creaba sola al
  instalar, y no había forma de cambiarla—. Cada tienda tiene su propia
  modalidad y su propia tarifa, completamente aparte de las demás: cambiar la
  de una no toca la de otra. Una tienda nueva empieza con la tabla por tramos
  del código hasta que se edite.
- **Aclarado: elegir "tarifa única" es opcional y por tienda.** No cambia
  nada por su cuenta: las tiendas que ya tenían su tabla por tramos —como
  Wong - Aldabas— la conservan tal cual hasta que alguien decida lo contrario
  a mano, tienda por tienda.
- **Arreglado: la lista de tiendas podía salir vacía en el primerísimo
  arranque**, por la misma carrera de la v23 —esta pantalla la leía sin
  esperar a que la tienda del código terminara de crearse—. Ya espera.

### v24 — 22/09/2026
- **Cambiado: nuevo ícono para la moto eléctrica.** Pasa de ser un auto con
  otra carrocería a un camión de caja —cabina chica y baja, caja de reparto
  grande y recta detrás—, al estilo de los íconos de reparto de siempre. Es lo
  que de verdad se distingue de un auto en un ícono chico: una silueta que
  solo se inclina un poco no se nota a 36 px, una con un salto de altura claro
  sí.
- **Nuevo: tarifa única también para el auto.** Había tiendas que no encajaban
  en ninguna de las dos: pagan un monto fijo por pedido —S/ 8.50, S/ 10— **con
  auto**, no solo con moto. El editor de tarifas de Ajustes ya no está atado a
  la modalidad: es un interruptor **Única / Por tramo** que se aplica a la
  modalidad activa, sea cual sea. Cambiarlo no toca la tarifa anterior —queda
  guardada, con la fecha en que dejó de usarse— ni lo ya cobrado con ella.

### v23 — 22/09/2026
- **Nuevo: modalidad moto eléctrica, con tarifa única.** En **Ajustes →
  Modalidad y tarifas** se elige con qué se reparte —Auto o Moto eléctrica— y
  se edita la tarifa de la que esté activa. El auto sigue cobrando por tramo de
  distancia, como siempre; la moto eléctrica cobra **un monto único por
  pedido** (S/ 6.00 hasta que se cambie), sin tabla de tramos. Cambiar de
  modalidad no toca lo ya cargado: cada jornada guarda la tarifa con la que se
  leyó, así que un cambio a mitad de semana no reescribe lo que ya se cobró. Al
  pasar a moto eléctrica por primera vez, su tarifa se crea sola con el monto
  por defecto —si no, habría caído en la tabla de tramos del auto, que la moto
  no tiene—.
- **Nuevo: ícono propio para la moto eléctrica.** El auto de la marca
  (cabecera, menú y botón de cargar) dibuja ahora un vehículo de caja —cabina
  baja, caja de reparto alta y recta— cuando la modalidad es moto eléctrica, en
  vez del auto. Cambia de ícono en cuanto se cambia la modalidad, sin recargar
  la app.
- **Nuevo: dos caras más en Apariencia.** Turbo (propuesta A: violeta, bordes
  gruesos, Fredoka) y Menta (propuesta C: el verde de siempre, afinado,
  Bricolage Grotesque) se suman a Mapa y Asfalto. Las cuatro están en el
  selector de Ajustes; Turbo y Menta se eligen a mano y se quedan fijas —a
  diferencia de Mapa/Asfalto, no seguían al reloj del teléfono desde antes—.
- **Cambiado: la prueba gratis pasa de 30 a 14 días.** Vencida, sigue en solo
  lectura tal como ya funcionaba: se ve y se exporta todo, pero no se cargan
  días nuevos. Sirve para dar de probar la app a un compañero sin regalar tanto
  como para que nunca llegue a pagar (ver LICENCIAS.md para emitirle su
  licencia después).
- **Arreglado: la app podía quedarse sin tienda para siempre en el
  primerísimo arranque.** Dos pantallas pueden llamar a la siembra inicial
  casi a la vez —la base está vacía, cada una ve que falta la tienda y trata
  de crearla—, y como el nombre de la tienda es único, la segunda en escribir
  reventaba contra esa restricción. La pantalla que perdía la carrera se
  quedaba sin datos y **no lo reintentaba nunca**: parecía que la app no
  terminaba de configurarse. Ahora, si crear la tienda falla por eso, se relee
  la que ya existe en vez de fallar.
- **Arreglado: el ícono del vehículo no se enteraba de un cambio de
  modalidad** hasta recargar la app entera —el menú y la barra de abajo viven
  fuera de las pantallas y no se vuelven a montar al navegar—. Ahora se
  refresca en cada cambio de pantalla.

### v22 — 21/09/2026
- **Nuevo diseño: «Mapa» (claro) y «Asfalto» (oscuro).** Salen de las
  propuestas D y B (`prototipo/propuestas-diseno.html`). En **Ajustes →
  Apariencia** se elige entre *Claro* (Mapa), *Oscuro* (Asfalto) y
  *Automático* (sigue al teléfono, como hasta ahora). La elección se guarda y
  se aplica antes de pintar, para que no haya un fogonazo del tema equivocado
  al abrir la app. Claro usa Unbounded y DM Sans; oscuro, Barlow Condensed en
  mayúsculas y Barlow. Los códigos de pedido siguen en JetBrains Mono.
- **El auto de la marca**, en la cabecera, en el menú y en el botón del centro
  de la barra de abajo. Cambia de traje con el modo: amarillo y con estela de
  puntos en claro, ámbar y con estela de rayas en oscuro.
- **La cifra del día en Inicio** («Hoy cargaste 21 pedidos · 11 rutas · S/ …»,
  con el auto y su estela), el gadget de la propuesta Turbo con los colores de
  cada modo. Debajo, **el recorrido**: cada ruta del día como una parada, con
  su horario y sus pedidos.
- **Barra de abajo** con cinco puertas: Inicio, Buscar, el auto (cargar
  capturas **desde cualquier pantalla**), *Sem.* y Más. «Más» abre el menú de
  siempre (Historial, Estadísticas, Ajustes). La palabra «Semana» se abrevia a
  **Sem.** donde no cabía: la barra, la tarjeta de la semana, Pagos y los
  filtros de Historial.
- **Nuevo: Buscar pedidos en un rango de días.** Parte del código, un rango, o
  las dos cosas. El rango se elige con un atajo (Hoy, 7, 14, 30 días), tocando
  el primer y el último día sobre la línea de los últimos 30, o escribiendo las
  dos fechas. Los resultados salen agrupados por día y llevan a su detalle.
- **Nuevo: días de descanso.** Donde Pagos preguntaba «¿No trabajaste o falta la
  carga?» ahora hay un botón **«No trabajé esos días»**: se eligen los días (por
  defecto todos) y quedan marcados como descanso. Un descanso deja de ser un
  hueco —no cuenta en «faltan días por subir» ni en Estadísticas—, se ve en la
  tira de la semana (barra amarilla en claro, azul en oscuro, y una luna) y en
  el gráfico, no cambia lo que se cobra, se puede deshacer al momento y se puede
  quitar día a día. En Inicio, un día sin cargar tiene su propio «No trabajé
  este día». Si más tarde se carga ese día, el descanso se quita solo. Viaja en
  el respaldo.
- **Ojo:** el APK sigue sin probarse en teléfono. El diseño sí se revisó en
  pantalla (claro y oscuro) con la misma compilación que va dentro del APK.

### v21 — 21/09/2026
- **Arreglado: la ruta y el estado de los pedidos.** El lector de texto del
  teléfono entregaba solo líneas, en el orden que le saliera, y el intérprete
  adivinaba a qué pedido pertenecía cada «Ruta 4» y cada «Entregado» por
  la línea que iba antes o después. Con las capturas reales del 20/09, **la
  mitad de los pedidos salían con la ruta del vecino** y la Ruta 1 se leía como
  la 2. Ahora hay un lector propio (`LectorTexto`, en `android/`) que devuelve
  también **dónde** está cada texto, y `geometria.ts` asigna la ruta que está
  *en la fila* del código y el estado que está *debajo* de él. El rabo de una
  tarjeta cortada por arriba o por abajo se descarta en vez de pegárselo a un
  vecino.
- **Arreglado: pedidos que se perdían sin aviso.** Un código con un dígito de
  más o de menos, la «o» de «wofp» leída como cero, o un guion raro, no casaba
  con el patrón y el pedido desaparecía. Ahora se conserva y se marca como
  dudoso. Además, una `B` se leía como 6 (es un 8), y `(O Entregado)` no se
  reconocía como estado porque el borde de la píldora sale como paréntesis.
  El «De:» de una ruta ya no es obligatorio, y admite `19.31` además de `19:31`.
- **Más rápido.** El lector antiguo creaba un reconocedor nuevo en *cada*
  captura y no lo cerraba nunca; el nuevo se crea una vez y trabaja de dos en
  dos. La copia reducida que se guarda como prueba se prepara mientras se lee,
  en vez de antes de empezar. Y la pantalla dice «7 de 12 leídas» en vez de un
  «tarda unos segundos» fijo.
- **Avisa mejor cuántos faltan.** «Faltan 2 pedidos: la app marca 21 y se
  leyeron 19», con la causa habitual y qué hacer. Si el contador de la pestaña
  no se leyó, se usa la suma del resumen.
- **Ojo, esto no se ha probado en un teléfono.** Se probó con lecturas reales de
  las capturas del 20/09 (hechas con el lector de macOS, no con el de Android) y
  con 359 pruebas; el código nativo compila. Si el lector nuevo falla, la app
  cae al de antes. En **Ajustes → última lectura** cada captura dice con cuál
  se leyó (`posiciones` es el bueno) y cuántos ms tardó, y al final va el texto
  tal como lo devolvió el lector, con sus cajas: con eso se ve qué pasó.

### v20 — 20/09/2026
- **Nuevo:** "Leer pedidos de una foto", en el detalle de un día guardado,
  dentro de "Añadir un pedido", junto a "Añadir un pedido a mano". Una o más
  capturas de la pestaña Órdenes, para la fecha que se elija (por defecto la
  del día abierto). Antes de guardar se enseñan los pedidos nuevos, con cada
  uno quitable de la lista, y aparte los que ya estaban registrados.
- **Solo entran los nuevos.** Un pedido cuyo código ya está guardado —en ese
  día o en cualquier otro— no se añade: un pedido no se cobra dos veces. Se
  dice cuántos eran y en qué día está cada uno, y subir dos veces la misma
  foto no duplica nada.
- Los pedidos entran en tramo 1 con el monto de la tarifa de esa fecha, y con
  su ruta si ese día la tiene; si no, sin ruta, para asignarla después. Una
  fecha de una semana cerrada se rechaza, como el resto de ediciones. Si la
  foto trae una fecha distinta a la elegida, se avisa, pero no se cambia sola.

### v19 — 20/09/2026
- **Nuevo:** "Leer rutas de una foto", en Revisión y en el detalle de un día
  guardado. Una o más capturas de la pestaña Rutas, se leen con el mismo
  lector de siempre, se enseñan antes de guardar, y se pueden quitar de la
  lista una por una antes de confirmar.
- En el detalle de un día guardado, la fecha de esas rutas se puede elegir:
  puede llegar la foto de la ruta de *otro* día que faltó cargar, sin salir de
  donde se está. En Revisión queda fija al día que se está revisando, porque
  ahí ya hay un selector de fecha para todo el día.

### v18 — 20/09/2026
- **Nuevo:** botón opcional para reordenar las rutas del 1 en adelante por
  hora de salida, en Revisión y en el detalle de un día guardado, con
  confirmación antes de aplicarlo. Los pedidos siguen su ruta —están
  enlazados por su id, no por el número— así que nada se desordena por
  debajo.
- **Nuevo: respaldo y restauración.** En Ajustes, "Crear y compartir" genera
  un archivo con tus jornadas, rutas, pedidos y liquidaciones, y lo entrega al
  selector de Android para guardarlo en Drive o mandártelo por WhatsApp o
  correo. "Restaurar" lee ese archivo, enseña qué trae antes de tocar nada, y
  pide confirmar porque reemplaza todo lo que haya en el teléfono.
- Aclaración importante: una actualización normal —instalar una versión
  encima de la anterior, como se hace desde la v13— **nunca borra datos**.
  El respaldo es para lo que sí borra: desinstalar, perder el teléfono o
  cambiar de aparato.
- Inicio recuerda hacer un respaldo si nunca se hizo uno, o si el último ya
  tiene más de dos semanas.

### v17 — 19/09/2026
- **Nuevo:** Inicio enseña al pie qué versión está corriendo. Antes solo vivía
  en Ajustes, y nadie va a mirarlo si no sospecha que algo está
  desactualizado. Nace de que alguien probó una versión de varios cambios
  atrás sin saberlo, porque nada se lo decía en la pantalla que se abre
  siempre primero.

### v16 — 19/09/2026
- **Nuevo:** las barras de "pedidos contra permanencia" y la línea de tiempo
  de la licencia, traídas de la infografía a la app real. Sustituyen a una
  lista con tachado que decía lo mismo en texto.
- Si ves el mensaje viejo de "Cierra la aplicación del todo y vuelve a
  entrar" en el error de base de datos, o no ves el botón Inicio arriba:
  **no tienes esta versión instalada.** Desinstala (`adb uninstall
  pe.rutasa.app`) y vuelve a instalar — es la firma nueva desde la v13,
  y no se instala encima de una v12 o anterior.

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
