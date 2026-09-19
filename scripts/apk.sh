#!/usr/bin/env bash
#
# Genera el APK de Rutas-A y lo deja en la raíz del proyecto.
#
#   ./scripts/apk.sh            genera el APK
#   ./scripts/apk.sh --instalar genera y lo instala en el celular por USB
#
# Cada compilación sube el número de versión y deja el archivo como
# Rutas-A-v<N>.apk, borrando el anterior: así se sabe siempre cuál se está
# copiando, y no hay forma de instalar por error el de hace tres cambios.
#
# Por qué hace falta un JDK aparte: el Mac trae el 26, y el plugin de Gradle
# para Android no lo soporta —falla con "Unsupported class file major version
# 70", que es como se ve un JDK 26 desde dentro. El 21 se instaló con Homebrew
# y NO reemplaza al del sistema: solo se usa aquí.
#
set -euo pipefail
cd "$(dirname "$0")/.."

# --- JDK 21 ---------------------------------------------------------------
for candidato in /opt/homebrew/opt/openjdk@21 /usr/local/opt/openjdk@21; do
  [ -d "$candidato" ] && { export JAVA_HOME="$candidato"; break; }
done
if [ -z "${JAVA_HOME:-}" ]; then
  echo "Falta el JDK 21. Instálalo con:  brew install openjdk@21"
  exit 1
fi

# --- Número de versión ----------------------------------------------------
# Sube uno en cada compilación. Así el archivo que copias al celular dice qué
# versión es, y Android reconoce que una instalación es más nueva que la
# anterior —sin subirlo se niega a actualizar.
VERSION_FILE="android/version.properties"
ANTERIOR="$(grep -E '^build=' "$VERSION_FILE" | cut -d= -f2)"
VERSION=$(( ANTERIOR + 1 ))
sed -i '' "s/^build=.*/build=$VERSION/" "$VERSION_FILE"

# --- SDK de Android -------------------------------------------------------
export ANDROID_HOME="${ANDROID_HOME:-$HOME/Library/Android/sdk}"
if [ ! -d "$ANDROID_HOME" ]; then
  echo "No encuentro el SDK de Android en $ANDROID_HOME."
  exit 1
fi
echo "sdk.dir=$ANDROID_HOME" > android/local.properties

# --- 1. La web que va dentro del APK --------------------------------------
# Capacitor no ejecuta Next: mete dentro del APK una carpeta de archivos
# estáticos y la abre en un navegador sin barra.
#
# Lo que es solo del panel web —el administrador, la API de extracción, el
# acceso por correo y el proxy— se aparta durante la compilación. No es que
# sobre: es que exige un servidor, y dentro del APK no hay ninguno. Se
# devuelve a su sitio al terminar, pase lo que pase.
SOLO_WEB=("src/app/admin" "src/app/api" "src/app/acceso" "src/app/configuracion" "src/proxy.ts")
APARTADO=".solo-web"

restaurar() {
  if [ -d "$APARTADO" ]; then
    for ruta in "${SOLO_WEB[@]}"; do
      guardado="$APARTADO/$(echo "$ruta" | tr / _)"
      [ -e "$guardado" ] && { mkdir -p "$(dirname "$ruta")"; rm -rf "$ruta"; mv "$guardado" "$ruta"; }
    done
    rmdir "$APARTADO" 2>/dev/null || true
  fi
}
# Si algo falla a mitad, el código no se queda mutilado.
trap restaurar EXIT

echo "▸ Apartando lo que solo existe en la web…"
mkdir -p "$APARTADO"
for ruta in "${SOLO_WEB[@]}"; do
  [ -e "$ruta" ] && mv "$ruta" "$APARTADO/$(echo "$ruta" | tr / _)"
done

echo "▸ Generando la web estática…"
DESTINO=movil npx next build

restaurar
trap - EXIT

# --- 2. Copiar la web al proyecto Android ---------------------------------
echo "▸ Sincronizando con Android…"
npx cap sync android >/dev/null

# --- 3. Compilar ----------------------------------------------------------
echo "▸ Compilando el APK…"
( cd android && ./gradlew --quiet assembleDebug )

# El anterior se borra: tener seis APK viejos en la carpeta solo sirve para
# instalar el equivocado.
rm -f Rutas-A-v*.apk
APK="Rutas-A-v$VERSION.apk"
cp android/app/build/outputs/apk/debug/app-debug.apk "$APK"

echo
echo "────────────────────────────────────────────────────────────"
echo " Versión $VERSION lista"
echo
echo "     $(pwd)/$APK   ($(du -h "$APK" | cut -f1))"
echo
echo " Anota qué cambió en VERSIONES.md"
echo "────────────────────────────────────────────────────────────"

# --- 4. Instalar por cable, si se pidió -----------------------------------
if [ "${1:-}" = "--instalar" ]; then
  echo
  if ! "$ANDROID_HOME/platform-tools/adb" devices | tail -n +2 | grep -q "device$"; then
    echo "No veo ningún celular conectado."
    echo "Conéctalo por USB y activa la depuración USB (ver README-ANDROID.md)."
    exit 1
  fi
  echo "▸ Instalando la versión $VERSION en el celular…"
  "$ANDROID_HOME/platform-tools/adb" install -r "$APK"
  echo "Listo: busca Rutas-A en el menú de aplicaciones."
fi
