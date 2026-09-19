#!/usr/bin/env bash
#
# Levanta Rutas-A contra un Supabase local.
#
# Es el mismo stack que en su nube —Postgres, Auth, RLS, Storage—, corriendo en
# tu Mac con Docker. Sirve para trabajar mientras la nube de Supabase está caída
# y para desarrollar sin gastar cuota.
#
#   ./scripts/local.sh
#
# Cuando su nube se recupere, subir todo a producción es:
#   supabase link --project-ref <ref>
#   supabase db push
#
set -euo pipefail

cd "$(dirname "$0")/.."

echo "▸ Comprobando Docker…"
if ! command -v docker >/dev/null 2>&1; then
  echo
  echo "  Docker no está instalado."
  echo "  Descárgalo de https://www.docker.com/products/docker-desktop/ ,"
  echo "  ábrelo una vez para que arranque, y vuelve a ejecutar este script."
  exit 1
fi
if ! docker info >/dev/null 2>&1; then
  echo
  echo "  Docker está instalado pero no está corriendo."
  echo "  Abre Docker Desktop y espera a que el icono deje de moverse."
  exit 1
fi
echo "  Docker listo."

echo
echo "▸ Arrancando Supabase local (la primera vez descarga imágenes, tarda)…"
supabase start

echo
echo "▸ Aplicando el esquema y la semilla…"
# `db reset` recrea la base desde cero con las migraciones y luego seed.sql.
supabase db reset

echo
echo "▸ Escribiendo .env.local…"

# La clave de Anthropic no la sabe Supabase: si ya estaba puesta, se conserva.
ANTHROPIC_PREVIA=""
if [ -f .env.local ]; then
  ANTHROPIC_PREVIA="$(grep -E '^ANTHROPIC_API_KEY=' .env.local || true)"
fi

{
  echo "# Generado por scripts/local.sh — entorno LOCAL, no subir a producción."
  echo "# Regenerar: ./scripts/local.sh"
  echo
  supabase status -o env \
    --override-name api.url=NEXT_PUBLIC_SUPABASE_URL \
    --override-name auth.anon_key=NEXT_PUBLIC_SUPABASE_ANON_KEY \
    --override-name auth.service_role_key=SUPABASE_SERVICE_ROLE_KEY \
    | grep -E '^(NEXT_PUBLIC_SUPABASE_URL|NEXT_PUBLIC_SUPABASE_ANON_KEY|SUPABASE_SERVICE_ROLE_KEY)='
  echo
  if [ -n "$ANTHROPIC_PREVIA" ]; then
    echo "$ANTHROPIC_PREVIA"
  else
    echo "# Sin esta clave todo funciona menos leer las capturas."
    echo "ANTHROPIC_API_KEY="
  fi
  echo "ANTHROPIC_MODELO=claude-opus-5"
} > .env.local

echo "  .env.local escrito."

echo
echo "────────────────────────────────────────────────────────────"
echo " Listo. Ahora:"
echo
echo "   npm run dev"
echo
echo " Entra en  http://localhost:3000  con  msmgxe@gmail.com"
echo
echo " El código de 6 dígitos NO llega a tu correo: el Supabase local"
echo " captura los envíos. Ábrelo en:"
echo
echo "   http://127.0.0.1:54324"
echo
echo " Para ver y editar la base a mano (el panel local, que sí funciona):"
echo
echo "   http://127.0.0.1:54323"
echo
echo " Para parar todo:  supabase stop"
echo "────────────────────────────────────────────────────────────"
