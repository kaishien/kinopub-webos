#!/bin/bash
# Releases a version: writes it to appinfo.json, commits, tags v<version> and pushes.
# GitHub Actions then checks, builds the .ipk and publishes the release.
#   bash scripts/release.sh 1.2.2
set -e
cd "$(dirname "$0")/.."

VERSION="$1"
if ! [[ "$VERSION" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
  echo "Использование: bash scripts/release.sh <major.minor.patch>" >&2
  exit 1
fi
if [ -n "$(git status --porcelain)" ]; then
  echo "Рабочее дерево не чистое, закоммитьте или уберите изменения" >&2
  exit 1
fi
if git rev-parse -q --verify "refs/tags/v$VERSION" >/dev/null; then
  echo "Тег v$VERSION уже есть" >&2
  exit 1
fi

node -e "
  const fs = require('fs')
  const path = 'app/webos/appinfo.json'
  const info = JSON.parse(fs.readFileSync(path, 'utf8'))
  info.version = process.argv[1]
  fs.writeFileSync(path, JSON.stringify(info, null, 2) + '\n')
" "$VERSION"

git add app/webos/appinfo.json
git commit -q -m "chore: bump version to $VERSION"
git tag "v$VERSION"
git push origin HEAD "v$VERSION"
echo "Релиз v$VERSION запущен: https://github.com/kaishien/kinopub-webos/actions"
