#!/usr/bin/env bash
#
# Arranca la app para poder abrirla desde el celular, en la misma wifi.
#
#   ./scripts/movil.sh
#
# Por qué hace falta un script y no vale `npm run dev`: el navegador del celular
# habla **directamente** con Supabase, no a través del Mac. Si la dirección
# apunta a 127.0.0.1, el celular la interpreta como *él mismo* y no encuentra
# nada. Hay que cambiarla por la IP del Mac en la red.
#
# Lo que NO se puede probar así: instalar la app en el celular ni el modo sin
# conexión. Ambos exigen HTTPS con certificado de verdad, y esto va por HTTP
# plano. Para eso hace falta la nube, que sigue caída.
#
set -euo pipefail

cd "$(dirname "$0")/.."

IP="$(ipconfig getifaddr en0 2>/dev/null || ipconfig getifaddr en1 2>/dev/null || true)"
if [ -z "$IP" ]; then
  echo "No encuentro la IP de tu Mac en la wifi. ¿Estás conectado?"
  exit 1
fi

if [ ! -f .env.local ]; then
  echo "Falta .env.local. Ejecuta antes:  npm run local"
  exit 1
fi

# Un `next dev` que ya esté escuchando en el puerto 3000 se quedaría atado a
# localhost y el celular no lo alcanzaría, así que se cierra antes.
if lsof -ti:3000 >/dev/null 2>&1; then
  echo "▸ Cerrando el servidor que ya estaba en el puerto 3000…"
  lsof -ti:3000 | xargs kill 2>/dev/null || true
  sleep 2
fi

echo "▸ Apuntando la app a http://$IP:54321 para que el celular la alcance…"
# Se reescribe solo esa línea; el resto del archivo queda igual.
python3 - "$IP" <<'PY'
import re, sys
ip = sys.argv[1]
ruta = ".env.local"
texto = open(ruta, encoding="utf-8").read()
texto = re.sub(r'^NEXT_PUBLIC_SUPABASE_URL=.*$',
               f'NEXT_PUBLIC_SUPABASE_URL="http://{ip}:54321"',
               texto, flags=re.M)
open(ruta, "w", encoding="utf-8").write(texto)
PY

echo
echo "────────────────────────────────────────────────────────────"
echo " Abre esto en tu celular, conectado a la misma wifi:"
echo
echo "     http://$IP:3000"
echo
echo " Entra con  msmgxe@gmail.com"
echo " El código de 6 dígitos lo verás en tu Mac, en:"
echo
echo "     http://127.0.0.1:54324"
echo
echo " Ojo: por HTTP plano el celular no te dejará instalar la app"
echo " ni funcionará sin conexión. Todo lo demás sí."
echo "────────────────────────────────────────────────────────────"
echo

exec npx next dev --hostname 0.0.0.0
