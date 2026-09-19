# RutaLog en tu celular

## Qué es este primer APK

Una **prueba de humo**: comprueba que el APK se instala y abre en tu celular.
Todavía no lleva la aplicación dentro, solo una pantalla que lo confirma. Se
hace así a propósito: si instalar da problemas, es mucho mejor descubrirlo hoy
que después de reescribir la aplicación entera.

Si al abrirla ves **RutaLog** sobre fondo oscuro, la cadena completa funciona y
ya solo queda meter la aplicación de verdad dentro.

---

## Generar el APK

```
npm run apk
```

Deja el archivo en `RutaLog.apk`, en la carpeta del proyecto.

---

## Instalarlo — opción A: por cable (recomendada)

Es la fiable, y no depende de la wifi —que es justo lo que nos ha estado dando
guerra.

**1. Activa las opciones de desarrollador en el celular** (solo la primera vez)

- Ajustes → *Acerca del teléfono*
- Busca **Número de compilación** y tócalo **siete veces** seguidas
- Te pedirá el PIN y dirá "Ya eres desarrollador"

**2. Activa la depuración por USB**

- Ajustes → *Sistema* → *Opciones de desarrollador*
- Enciende **Depuración por USB**

**3. Conecta el celular al Mac con el cable y ejecuta**

```
npm run apk:instalar
```

En el celular saldrá *¿Permitir la depuración USB?* → **Permitir**.

Al terminar, busca **RutaLog** en el menú de aplicaciones.

> Si el cable solo carga y no transmite datos, no funcionará. Usa el que vino
> con el celular, o prueba otro.

---

## Instalarlo — opción B: sin cable

Si prefieres no usar el cable: sube `RutaLog.apk` a tu Google Drive desde el
Mac, ábrelo en el celular desde la app de Drive y tócalo.

Android te dirá que la aplicación no viene de la tienda y bloqueará la
instalación. En ese aviso toca **Ajustes** y activa el permiso para esa app
(*Instalar aplicaciones desconocidas*). Vuelve atrás y ya deja instalar.

Es un aviso normal: solo significa que el APK no viene de Google Play. Lo has
compilado tú en tu propia máquina hace un minuto.

---

## Por qué hace falta un Java aparte

Tu Mac trae el JDK 26. El plugin de Gradle para Android no lo soporta y falla
con `Unsupported class file major version 70` —que es como se ve un JDK 26
desde dentro. Por eso `scripts/apk.sh` usa el JDK 21 que se instaló con
Homebrew. **No reemplaza al del sistema**: solo se usa para compilar el APK.

Si alguna vez falta:

```
brew install openjdk@21
```
