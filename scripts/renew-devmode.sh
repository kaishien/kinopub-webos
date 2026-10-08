#!/bin/bash
# Renews the LG webOS Developer Mode session (resets its 1000-hour timer) using the token read from the TV over SSH.
# Settings live in the gitignored scripts/tv.conf so launchd/cron can run this without env vars.
CONF="$(dirname "$0")/tv.conf"
[ -f "$CONF" ] && . "$CONF"
: "${TV_HOST:?set TV_HOST in scripts/tv.conf (see tv.conf.example)}"
TV_PORT="${TV_PORT:-9922}"
KEY="${KEY:-$HOME/.ssh/tv_webos_nopass}"
LOG="$HOME/Library/Logs/webos-devmode-renew.log"
ts() { date '+%Y-%m-%d %H:%M:%S'; }
TOKEN=$(ssh -i "$KEY" -p "$TV_PORT" -o StrictHostKeyChecking=no -o ConnectTimeout=10 \
  -o HostKeyAlgorithms=+ssh-rsa -o PubkeyAcceptedAlgorithms=+ssh-rsa \
  "prisoner@$TV_HOST" 'cat /var/luna/preferences/devmode_enabled' 2>/dev/null | tr -d '\r\n')
if [ ${#TOKEN} -lt 32 ]; then echo "$(ts) FAIL: не удалось прочитать токен с телевизора (выключен?)" >> "$LOG"; exit 1; fi
RESP=$(curl -s -m 20 "https://developer.lge.com/secure/ResetDevModeSession.dev?sessionToken=$TOKEN")
echo "$(ts) response: $(echo "$RESP" | tr -d '\n' | head -c 200)" >> "$LOG"
echo "$RESP" | grep -qi '"result" *: *"success"\|success' && exit 0 || exit 2
