#!/bin/sh
# Serve the landing page the way GitHub Pages will: site files at /, screenshots beside them.
set -eu
ROOT=$(CDPATH= cd -- "$(dirname "$0")/.." && pwd)
DEST=$(mktemp -d)
trap 'rm -rf "$DEST"' EXIT INT TERM
mkdir -p "$DEST/screenshots"
cp "$ROOT/site/index.html" "$ROOT/site/styles.css" "$ROOT/site/main.js" "$ROOT/site/i18n.js" "$ROOT/site/mark.png" "$DEST/"
while IFS= read -r line || [ -n "$line" ]; do
  case "$line" in
    ""|\#*) continue ;;
  esac
  mkdir -p "$DEST/$(dirname "$line")"
  cp "$ROOT/$line" "$DEST/$line"
done < "$ROOT/site/pages-assets.txt"
sh "$ROOT/site/copy-releases.sh" "$DEST"
PORT=4173
while lsof -nP -iTCP:"$PORT" -sTCP:LISTEN >/dev/null 2>&1; do
  PORT=$((PORT + 1))
done
URL="http://127.0.0.1:$PORT"
python3 -m http.server "$PORT" --bind 127.0.0.1 --directory "$DEST" >/dev/null 2>&1 &
pid=$!
trap 'kill "$pid" 2>/dev/null || true; rm -rf "$DEST"' EXIT INT TERM
i=0
while [ "$i" -lt 50 ]; do
  if curl -sf -o /dev/null "$URL/"; then
    break
  fi
  i=$((i + 1))
  sleep 0.1
done
echo "Preview: $URL"
if [ "$(uname)" = "Darwin" ]; then
  open "$URL"
fi
wait "$pid"
