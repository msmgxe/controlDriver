# Contrato del prototipo v2 de Control Driver

Es un prototipo HTML (un solo archivo final) de una app de repartidor en español de Perú. El armazón ya existe:
`01-shell.js` (LÉELO ENTERO antes de escribir nada: define `App`, `UI`, `I()`, `ACC`, `DATA`, `fmt`, `CAR()`),
`00-head.html` (todo el CSS y los componentes: .btn .fila .tile .chip .seg .opt .card .pill .aviso .ac .inp .stepper .sw .kpi .barra .dots...).
Tu trabajo: escribir TU módulo JS (un archivo, indicado en tu encargo) que registra pantallas y hojas con `App.screen(id,def)` / `App.sheet(id,def)`.

## Qué buscamos (la petición del usuario)
«La versión actual me gusta pero le falta pulir y simplificar. Hay opciones que son solo texto y deben ser botones, con colores de fondo para diferenciarlos. Más animaciones, imágenes y figuras, para que se sienta fácil, amigable y rápida.»
Principios:
1. **Una acción = un color + una figura** (objeto `ACC`: comanda azul, cantidad verde, a mano naranja, fotos morado, adicional vino, taxi amarillo, apoyo turquesa, pagos verde, estadísticas violeta, buscar celeste, historial ocre, tutoriales rosa, ajustes gris azulado, licencia azul marino). Úsalo con `UI.fila`, `UI.tile`, `UI.ac`, o `style="background:var(--c-…)"`.
2. **Todo lo que se toca es un botón** relleno o con borde, nunca un enlace subrayado. Cada ⚠ del inventario (texto que hoy es solo enlace) debe quedar como botón/chip/píldora tocable.
3. **Menos texto, más figura**: títulos cortos, una frase de ayuda como mucho, íconos `I('nombre')` (solo los de ICONS), ilustraciones SVG inline pequeñas en estados vacíos y cabeceras, el carrito `CAR()`.
4. **Un solo botón principal por pantalla**, grande, abajo o al final. Lo demás secundario.
5. **Movimiento con intención**: `rise` al entrar (con `d1..d6` para escalonar), `pop` al marcar, `bob`, contadores `UI.count`, anillos/barras que crecen, `App.confetti()` + `App.toast('¡Guardado!')` al guardar. Nada que parpadee sin motivo.
6. Datos reales de la app (ver INVENTARIO.md y `DATA`): códigos `v12341686wofp-01`, rutas con hora, Entregado/Parcial/No entregado, tarifa por zona de Aurora (Miraflores, Surquillo, Surco S/ 9.50; Chorrillos S/ 13.00), Aldabas por km, Expo Vino con 21 zonas, S/ con 2 decimales (`fmt.sol(céntimos)`).
7. Toques de 44px o más; contraste legible en claro y oscuro (usa solo tokens `var(--…)`; nada de colores literales que fallen en un tema; el blanco sobre color de acción está bien).

## API (resumen; el detalle está en 01-shell.js)
- `App.screen('id',{titulo,icono,tab:'inicio|pagos|stats|null',grupo:'Principales',render(ctx),acts:{nombre(el,ev,ctx){…}},mount(el,ctx),cambios:['qué cambia respecto a la app actual', …]})`
  `render` devuelve un string HTML. `ctx.s` es el estado local persistente de la pantalla (objeto), `ctx.p` los parámetros de navegación, `ctx.data` = DATA.
- `App.sheet('id',{titulo|fn,sub,k:'clave ACC'|color:'#hex/var',icono,neutro:true,full:true,claro:true,render(ctx),pie(ctx),acts,mount})` – hoja inferior; `ctx.s` se reinicia al abrir. `pie` = barra inferior fija de botones.
- Eventos por atributos (NO escribas addEventListener salvo en `mount`):
  `data-go="id"` (cambia de pantalla raíz) · `data-push="id"` (apila, aparece botón atrás) · `data-back` · `data-sheet="id" data-p='{"i":2}'` (abre hoja con params en ctx.p) · `data-close` · `data-toast="texto"` · `data-confetti` ·
  `data-tab="clave" data-v="valor"` (pestañas: guarda ctx.s[clave]=valor y re-dibuja; genera con `UI.seg(clave,[[valor,texto,n?]],ctx.s[clave])`) ·
  `data-open` (acordeón `UI.ac`) · `data-one` (selección única entre hermanos) · `data-tog` (alternar aria-pressed) · `data-sw` (interruptor `UI.sw`) · `data-step`/`data-for` (`UI.stepper`) ·
  `data-act="nombre"` → llama `acts.nombre(el,ev,ctx)` de tu pantalla/hoja y re-dibuja (devuelve `false` para no re-dibujar).
- `App.openSheet(id,p)`, `App.closeSheet()`, `App.go/push/back`, `App.toast(t,'warn|bad')`, `App.confetti()`, `App.css('…css…')` (para estilos propios: prefija TODAS tus clases con el prefijo de tu módulo, p. ej. `.ini-…`), `App.state` (estado global: `licencia`, `pedidos`…).
- IDs que existen en el prototipo (enlázalos con confianza; los demás módulos los definen):
  Pantallas: inicio, pagos, stats, historial, buscar, ajustes, tutoriales, acerca, revision, compartir, bloqueo, legal, sinconexion, error.
  Hojas: cargar, mas, subirmas, dia, pedido, comandas, comanda-revisar, adicional, apoyo, detalle-bloque, cotejo, cargando, visor-foto, pago-registrar, rutas-hoja.
  Parámetros útiles: `pedido` recibe `{i:índice en DATA.pedidos}`; `adicional` recibe `{tipo:'Taxi'|'Expo Vino'|'Movilidad'}`; `ajustes` recibe `{abre:'licencia'|'tienda'|…}` (abre ese acordeón).
- Estado compartido que puedes leer/escribir: `App.state.pedidos` (cuántos pedidos hoy), `App.state.licencia` ('vencida'|'activa').

## Reglas de código
- Todo tu módulo va dentro de `(function(){ … })();`. Sin dependencias externas, sin fetch, sin alert/confirm/prompt, sin `window.open`.
- No toques `00-head.html`, `01-shell.js`, `05-body.html`, `99-fin.js`, ni módulos ajenos. Si te falta algo del armazón, resuélvelo en tu módulo (App.css + tus helpers) y dilo en tu informe.
- Cada pantalla/hoja lleva `cambios:[…]` (2 a 5 viñetas cortas: qué cambió respecto a la app actual y por qué es más simple).
- Interacción real: los formularios deben responder (steppers, chips seleccionables, pestañas, acordeones, interruptores, botón Guardar → confeti + toast + cierre/navegación coherente). Lo que no sea esencial puede quedar como demostración con `data-toast`.
- Sin texto de relleno tipo lorem; en español claro y breve ("Anotar", "Listo", "Guardar").

## Cómo probar (obligatorio antes de entregar)
```
cd /Users/marco/Proyectos/ControlDriver/prototipo/v2
./build.sh <SALIDA.html> <tu-modulo.js>          # arma armazón + SOLO tu módulo y revisa la sintaxis
node /private/tmp/claude-501/-Users-marco-Proyectos-ControlDriver/0d46da92-a4c5-4521-9c6c-75c0adc1ce51/scratchpad/jsd/smoke.js <SALIDA.html>
```
`<SALIDA.html>` ponla en el directorio scratchpad: `/private/tmp/claude-501/-Users-marco-Proyectos-ControlDriver/0d46da92-a4c5-4521-9c6c-75c0adc1ce51/scratchpad/` con el nombre de tu módulo (no uses la ruta ../rediseno-v2.html). La prueba de humo abre cada pantalla/hoja de tu módulo, pulsa todo lo pulsable y lista errores y enlaces rotos hacia pantallas que no son tuyas (esos "enlace roto" hacia ids de otros módulos son esperables mientras trabajas solo con tu módulo; los errores JS NO). Entrega con 0 errores JS.
Informe final: máx. 200 palabras: qué pantallas/hojas registraste (ids), qué decisiones de diseño tomaste, y qué dejaste como demostración.
