#!/usr/bin/env bash
# Une el armazón y los módulos de pantallas en un solo HTML.
set -euo pipefail
cd "$(dirname "$0")"
OUT="${1:-../rediseno-v2.html}"
shift || true
MODS=("$@")
if [ ${#MODS[@]} -eq 0 ]; then MODS=([1-8][0-9]-*.js); fi
{
  cat 00-head.html
  python3 - <<'PY'
import re
s=open('05-body.html').read()
ICONS={'home':'M3 11l9-8 9 8M5 10v10h5v-6h4v6h5V10','wallet':'M3 8a3 3 0 013-3h12a2 2 0 012 2v12a2 2 0 01-2 2H6a3 3 0 01-3-3zM3 9h17M16 14h2','cargar':'M12 16V4M7 9l5-5 5 5M4 20h16','bars':'M5 20V12M12 20V5M19 20v-5','dots':'M5 12h.01M12 12h.01M19 12h.01'}
for k,v in ICONS.items():
    s=s.replace('__I_%s__'%k,'<svg class="ic" viewBox="0 0 24 24" aria-hidden="true"><path d="%s"/></svg>'%v)
print(s,end='')
PY
  cat 01-shell.js
  for f in "${MODS[@]}"; do [ "$f" = "01-shell.js" ] || { echo; echo "/* ===== $f ===== */"; cat "$f"; }; done
  cat 99-fin.js
  echo "</script>"
} > "$OUT"
node --check <(sed -n '/^<script>$/,/^<\/script>$/p' "$OUT" | sed '1d;$d') 2>&1 && echo "SINTAXIS OK: $OUT ($(wc -c < "$OUT") bytes)"
