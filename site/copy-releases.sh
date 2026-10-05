#!/bin/sh
# Copy screenshots/releases into DEST and write releases-manifest.json (latest first).
# Usage: sh site/copy-releases.sh /path/to/_site
set -eu
ROOT=$(CDPATH= cd -- "$(dirname "$0")/.." && pwd)
DEST=${1:?destination directory required}
SRC="$ROOT/screenshots/releases"

if [ ! -d "$SRC" ]; then
  echo "[]" >"$DEST/releases-manifest.json"
  exit 0
fi

mkdir -p "$DEST/screenshots/releases"
cp -R "$SRC/." "$DEST/screenshots/releases/"

python3 - "$SRC" "$DEST/releases-manifest.json" <<'PY'
import json, os, re, sys

src, out = sys.argv[1], sys.argv[2]
semver = re.compile(r"^(\d+)\.(\d+)\.(\d+)$")

def parse_version(name):
    m = semver.match(name)
    if not m:
        return None
    return tuple(int(p) for p in m.groups())

def image_key(name):
    stem, ext = os.path.splitext(name)
    if ext.lower() not in (".png", ".jpg", ".jpeg", ".webp"):
        return None
    if stem.isdigit():
        return (0, int(stem), name.lower())
    return (1, stem.lower(), name.lower())

releases = []
for entry in os.listdir(src):
    path = os.path.join(src, entry)
    if not os.path.isdir(path):
        continue
    version = parse_version(entry)
    if version is None:
        continue
    images = []
    for file_name in os.listdir(path):
        key = image_key(file_name)
        if key is None:
            continue
        images.append((key, file_name))
    images.sort(key=lambda item: item[0])
    if not images:
        continue
    releases.append({
        "version": entry,
        "images": [name for _, name in images],
    })

releases.sort(key=lambda item: parse_version(item["version"]), reverse=True)
payload = {
    "latest": releases[0]["version"] if releases else None,
    "releases": releases,
}
with open(out, "w", encoding="utf-8") as handle:
    json.dump(payload, handle, indent=2)
    handle.write("\n")
PY
