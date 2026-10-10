#!/bin/bash
# Builds the app and packs it into build/<id>_<version>_all.ipk without touching the TV.
set -e
cd "$(dirname "$0")/../app"

pnpm run build
cp webos/appinfo.json webos/*.png dist/
mkdir -p ../build
rm -f ../build/*.ipk
# --no-minify: Vite already minified; minifying again breaks the bundle
ares-package --no-minify dist -o ../build
echo "Пакет: $(ls ../build/*.ipk | head -1)"
