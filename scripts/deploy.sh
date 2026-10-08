#!/bin/bash
set -e
cd "$(dirname "$0")/../app"
DEVICE="tv"
LAUNCH=1
for a in "$@"; do case "$a" in --no-launch) LAUNCH=0;; --device=*) DEVICE="${a#*=}";; esac; done

npm run build
cp webos/appinfo.json webos/*.png dist/
APP_ID=$(python3 -c "import json;print(json.load(open('webos/appinfo.json'))['id'])")
mkdir -p ../build
rm -f ../build/*.ipk
# --no-minify: Vite already minified; minifying again breaks the bundle
ares-package --no-minify dist -o ../build
IPK=$(ls ../build/*.ipk | head -1)
echo "Пакет: $IPK"
ares-install --device "$DEVICE" "$IPK"
if [ "$LAUNCH" = 1 ]; then
  ares-launch --device "$DEVICE" --close "$APP_ID" >/dev/null 2>&1 || true
  ares-launch --device "$DEVICE" "$APP_ID"
fi
