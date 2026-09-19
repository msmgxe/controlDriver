#!/usr/bin/env bash
#
# Genera el APK de Rutas-A y lo deja en la raíz del proyecto.
#
#   ./scripts/apk.sh            genera el APK
#   ./scripts/apk.sh --instalar genera y lo instala en el celular por USB
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

# --- SDK de Android -------------------------------------------------------
export ANDROID_HOME="${ANDROID_HOME:-$HOME/Library/Android/sdk}"
if [ ! -d "$ANDROID_HOME" ]; then
  echo "No encuentro el SDK de Android en $ANDROID_HOME."
  exit 1
fi
echo "sdk.dir=$ANDROID_HOME" > android/local.properties

# --- 1. La web que va dentro del APK --------------------------------------
# Capacitor no ejecuta Next: mete dentro del APK una carpeta de archivos
# estáticos y la abre en un navegador sin barra. Por eso hace falta
# `output: "export"`, que es lo que produce `out/`.
if grep -q '"export"' next.config.ts 2>/dev/null; then
  echo "▸ Generando la web estática…"
  npx next build
else
  echo "▸ (aún sin exportación estática: se usa el out/ que ya existe)"
fi

# --- 2. Copiar la web al proyecto Android ---------------------------------
echo "▸ Sincronizando con Android…"
npx cap sync android >/dev/null

# --- 3. Compilar ----------------------------------------------------------
echo "▸ Compilando el APK…"
( cd android && ./gradlew --quiet assembleDebug )

cp android/app/build/outputs/apk/debug/app-debug.apk Rutas-A.apk
echo
echo "────────────────────────────────────────────────────────────"
echo " APK listo:  $(pwd)/Rutas-A.apk  ($(du -h Rutas-A.apk | cut -f1))"
echo "────────────────────────────────────────────────────────────"

# --- 4. Instalar por cable, si se pidió -----------------------------------
if [ "${1:-}" = "--instalar" ]; then
  echo
  if ! "$ANDROID_HOME/platform-tools/adb" devices | tail -n +2 | grep -q "device$"; then
    echo "No veo ningún celular conectado."
    echo "Conéctalo por USB y activa la depuración USB (ver README-ANDROID.md)."
    exit 1
  fi
  echo "▸ Instalando en el celular…"
  "$ANDROID_HOME/platform-tools/adb" install -r Rutas-A.apk
  echo "Listo: busca Rutas-A en el menú de aplicaciones."
fi
