#!/bin/bash
set -e
cd "$(dirname "$0")"
DEVICE="tv"
LAUNCH=1
for a in "$@"; do case "$a" in --no-launch) LAUNCH=0;; --device=*) DEVICE="${a#*=}";; esac; done

bash package.sh
APP_ID=$(python3 -c "import json;print(json.load(open('../app/webos/appinfo.json'))['id'])")
IPK=$(ls ../build/*.ipk | head -1)
ares-install --device "$DEVICE" "$IPK"
if [ "$LAUNCH" = 1 ]; then
  ares-launch --device "$DEVICE" --close "$APP_ID" >/dev/null 2>&1 || true
  ares-launch --device "$DEVICE" "$APP_ID"
fi
