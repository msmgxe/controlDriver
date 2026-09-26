# Rutas-A en tu celular

## Generar el APK

```
npm run apk
```

Cada compilación sube el número de versión y deja el archivo en la carpeta del
proyecto como `Rutas-A-v<N>.apk`; el de la versión anterior se borra, para no
instalar por error uno viejo. La versión instalada se ve en **Ajustes**, arriba del
todo, y lo que cambió en cada una está en [`VERSIONES.md`](VERSIONES.md).

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

Al terminar, busca **Rutas-A** en el menú de aplicaciones.

> Si el cable solo carga y no transmite datos, no funcionará. Usa el que vino
> con el celular, o prueba otro.

---

## Instalarlo — opción B: sin cable

Si prefieres no usar el cable: sube el `Rutas-A-v<N>.apk` a tu Google Drive desde el
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
