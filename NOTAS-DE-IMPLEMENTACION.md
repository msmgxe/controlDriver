# Notas de implementación

Diferencias entre `ESPECIFICACION_APP_RUTAS.md` y lo que se está construyendo, y
por qué. La especificación sigue siendo la referencia; este archivo registra
dónde y por qué nos apartamos de ella.

---

## 1. Acceso: correo + código de 6 dígitos, no usuario y contraseña

**Qué dice §12:** Supabase Auth con usuario y contraseña. El nombre de usuario se
mapea a un email sintético `usuario@rutalog.app`. El admin genera una contraseña
temporal que se muestra una sola vez, y el driver la cambia en el primer ingreso
(`debe_cambiar_clave`).

**Qué se implementa:** el driver escribe su correo, recibe un código de 6 dígitos
y entra. Sin contraseña.

**Consecuencias, que no son menores:**

- **El correo tiene que ser real.** El email sintético `usuario@rutalog.app` ya no
  sirve: nadie podría leer el código. Al dar de alta a un driver hay que pedirle
  un buzón al que llegue de verdad.
- **Se cae toda la gestión de contraseñas de §12.** No hay contraseña temporal
  que entregar, no hay "cambiar en el primer ingreso", no hay restablecer
  contraseña, y no aplican el mínimo de 10 caracteres ni la verificación contra
  contraseñas filtradas. La columna `debe_cambiar_clave` se eliminó del esquema.
- **El alta se simplifica:** el admin crea la cuenta con
  `auth.admin.createUser({ email, email_confirm: true })` desde un Server Action
  protegido por rol, y ya está. No hay secreto que entregar en mano.
- **Lo que no cambia:** el registro público sigue cerrado. `signInWithOtp` se
  llama con `shouldCreateUser: false`, así que un correo sin cuenta no crea
  ninguna. Desactivar además "Enable sign ups" en el panel.
- **Riesgo nuevo:** el acceso depende de que le llegue el correo. Si el driver
  pierde el acceso a su buzón, pierde el acceso a la app y hay que cambiarle el
  correo desde el panel de admin. Conviene registrar un correo de respaldo.
- **A favor:** es menos fricción en un celular y se acaban los "olvidé mi
  contraseña", que con 10 drivers era carga de soporte garantizada.

**Configuración necesaria en Supabase** (está también al inicio de
`supabase/schema.sql`): Authentication → Providers → Email → activar Email OTP, y
Email Templates → Magic Link → reemplazar el enlace por `{{ .Token }}`. Sin ese
último paso Supabase envía un enlace mágico y no un código, que es el error más
fácil de cometer aquí.

**Resuelto:** si un driver pierde el acceso a su buzón, el admin le corrige el
correo desde `/admin`. Es la operación de recuperación del sistema.

**Encima del acceso hay un bloqueo local** (`src/lib/bloqueo.ts`): PIN de cuatro
dígitos y, si el equipo lo permite, huella. No es un factor de sesión y el
servidor no lo comprueba —la frontera real sigue siendo la sesión de Supabase
más la RLS—, pero es lo que evita que los ingresos y los códigos de pedido
queden a la vista si alguien presta o pierde el celular con la sesión abierta.
Es el mismo patrón de las apps de banca: se entra una vez por dispositivo y el
día a día lo protege el PIN.

---

## 2. Navegación: menú hamburguesa, no barra inferior de pestañas

**Qué dice §9:** barra inferior de 4 pestañas (Hoy, Historial, Pagos,
Estadísticas), con Ajustes detrás de un icono en la cabecera.

**Qué se implementa:** botón hamburguesa en la cabecera que abre un cajón
lateral con toda la navegación. Desde 900 px de ancho el mismo cajón se queda
fijo como barra lateral permanente y el botón desaparece.

**Consecuencias:**

- **Se pierde algo de ergonomía a una mano.** §9 pedía las acciones principales
  en la mitad inferior de la pantalla, y una barra inferior queda justo bajo el
  pulgar; una hamburguesa arriba a la izquierda es la peor esquina para el pulgar
  derecho. Se compensa así: la acción diaria de verdad —"Cargar capturas"— sigue
  siendo un botón grande dentro de Hoy, y en Revisión el botón de confirmar sigue
  fijo abajo. Al menú se entra pocas veces al día; a cargar, una.
- **A favor:** caben más destinos sin apretar (Revisión y Diseño ya no entrarían
  en una barra de 4), y la misma estructura sirve para celular y escritorio sin
  duplicar componentes.

---

## 3. Responsive de verdad, no solo mobile-first

**Qué dice §9:** mobile-first, pensado para usarse con una mano.

**Qué se implementa:** sigue siendo mobile-first, pero la interfaz se adapta
hasta escritorio. Cortes:

| Ancho | Qué cambia |
|---|---|
| < 620 px | Una columna. Cifras en rejilla de 2. |
| ≥ 620 px | Cifras en rejilla de 4. Las hojas inferiores pasan a modal centrado. |
| ≥ 760 px | Bloques de dos columnas en Hoy, Pagos y Estadísticas. La tabla de pedidos deja de necesitar scroll lateral. |
| ≥ 900 px | El cajón lateral se vuelve barra fija y desaparece la hamburguesa. |

El contenido se limita a 880 px (1120 px en Historial y Estadísticas) para que
las líneas no se estiren de lado a lado en un monitor.

---

## 4. Listado de pedidos: presentación B · Tabla — decidido

De las tres presentaciones que se prototiparon se eligió **B · Tabla**: todas las
columnas de §11 siempre visibles, cabecera fija al desplazar, subtotal por día y
total del rango, con scroll lateral en el celular. Es la más densa y la que mejor
se corresponde con el Excel que se exporta.

Consecuencia para §11: se deja de implementar la variante de "filas compactas de
dos líneas" en celular que pedía ese apartado. La tabla se desplaza de lado en
pantalla angosta, dentro de su propio contenedor, sin que la página se mueva.

---

## 5. Direcciones visuales — decidido

Se prototiparon tres direcciones completas y se eligieron **dos, una por
superficie**, porque son dos públicos distintos:

- **La app del driver usa Moderna.** Contenedores teñidos sin bordes, esquinas
  muy redondeadas, aire, hojas inferiores; Plus Jakarta Sans y DM Mono. Es lo
  que hoy espera cualquiera de una app de celular, y el driver la abre cansado
  al final del turno: familiaridad y dedos gordos antes que personalidad.
- **El panel `/admin` usa Profesional.** Reglas finas, esquinas casi rectas,
  densidad alta, sin sombras; Lora, IBM Plex Sans y IBM Plex Mono. Se usa en un
  monitor para cuadrar cuentas, donde la densidad ayuda en vez de estorbar.
- **De Lúdica se conserva una sola idea**: la racha de días al 100 %, que es lo
  que de verdad empuja a cargar todos los días. El resto de esa dirección
  envejece mal y habría quedado floja al enseñársela a la tienda.

Se activan con `data-superficie="admin"` sobre los tokens de
`src/app/globals.css`; la estructura de las pantallas no cambia entre una y
otra. El prototipo conserva las tres para poder volver a compararlas.

| | Idea | Tipografía | Elígela si | Lo que arriesgas |
|---|---|---|---|---|
| **Lúdica** | Cierras el día y te llevas un premio: racha, récords, cifras grandes, formas redondas y sombra sólida tipo pegatina | Fredoka + Figtree + DM Mono | Quieres que dé gusto abrirla y que la racha empuje a cargar todos los días | Es la que peor envejece y la que peor queda si la enseñas a la tienda para reclamar un pago |
| **Profesional** | Un documento de liquidación: reglas finas en vez de tarjetas, esquinas casi rectas, densidad alta, sin sombras | Lora + IBM Plex Sans + IBM Plex Mono | El uso fuerte es revisar, cuadrar y sustentar un reclamo | En un celular al final del turno puede sentirse seca y apretada |
| **Moderna** | Lo que hoy espera cualquiera de una app de celular: contenedores teñidos sin bordes, esquinas muy redondeadas, aire, hojas inferiores | Plus Jakarta Sans + DM Mono | Quieres que se sienta actual y familiar sin llamar la atención | Es la más segura y la menos memorable |

Las seis paletas de gráfico (tres direcciones × claro y oscuro) pasan la
validación de monotonía de luminosidad, salto entre pasos y contraste contra la
superficie. Los estados de entrega siempre llevan icono y etiqueta.

La aplicación carga cinco familias, las de las dos direcciones elegidas. El
prototipo sigue cargando siete porque mantiene las tres para comparar.

---

## 6. Panel de administración, solo web

Pantalla `/admin`, fuera de la PWA: lista de cuentas, estado, última carga, uso
de los últimos 14 días, costo de API por driver y vigencia de la suscripción.

**Dos advertencias:**

- **No hay claves que cambiar.** Con acceso por correo y código, la gestión de
  contraseñas de §12 desaparece. Lo que el admin sí hace: reenviar un código,
  corregir el correo de alguien que cambió de buzón, desactivar una cuenta sin
  borrar su historial y ampliar la vigencia.
- **Ver los montos de los demás choca con §12**, así que **no se implementó**.
  Ese apartado dice que el administrador *no* ve las jornadas ni los montos de
  los otros drivers, y lo vende como argumento comercial: los ingresos de cada
  uno son privados. `listarUsuarios()` trae solo métricas de uso —última carga,
  cargas del mes, costo de API— y las políticas RLS de `jornadas`, `rutas` y
  `ordenes` lo hacen cumplir aunque alguien llame a la API directamente.
  Si algún día se decide lo contrario hay que cambiarlo en los dos sitios y
  avisar a los drivers antes.

---

## 7. Cosas de §17 que siguen abiertas

1. **Pedidos de más de 12 km.** La tabla de tarifas no los cubre. Implementado
   como `tramo = 6` con monto manual obligatorio; `calcularLiquidacion` los deja
   fuera del total y los devuelve en `pedidosSinTarifa` para que se resuelvan
   antes de cerrar la semana.
2. **Límites entre tramos.** Implementado como `km <= hasta`, así que 3.0 km paga
   S/ 10.00 y 3.1 km paga S/ 11.50. Hay pruebas que lo fijan; si la tienda lo
   confirma al revés, se cambia `tramoDeKm` y se corren las pruebas.
3. **Retención de capturas.** Por defecto se descartan
   (`DIAS_RETENCION_IMAGENES=0`).
4. **El admin no ve datos de otros drivers.** Implementado así en las políticas
   RLS: `perfiles` es lo único que el admin puede listar de terceros.

---

## 8. Notas técnicas

- **Next.js 16 renombró `middleware.ts` a `proxy.ts`** y la función exportada a
  `proxy`. §7 habla de "middleware"; el archivo es `src/proxy.ts`.
- **El dinero va en céntimos enteros** en todo el cálculo
  (`src/lib/pagos/reglas.ts`). Los decimales aparecen solo al formatear para
  pantalla o al escribir en una columna `numeric`. Hay una prueba que lo fija.
- **El editor puede marcar errores de sintaxis en `supabase/schema.sql`.** Son
  falsos positivos de un analizador de T-SQL (SQL Server) leyendo PostgreSQL:
  `create extension`, `create table if not exists` y `create policy` son válidos
  en Postgres.
