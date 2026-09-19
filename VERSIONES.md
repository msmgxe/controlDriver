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
