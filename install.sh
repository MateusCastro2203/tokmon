#!/usr/bin/env bash
set -euo pipefail

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

if [ ! -d "$REPO_DIR/node_modules" ]; then
  echo "Instalando dependências (ink, react)..."
  (cd "$REPO_DIR" && npm install --no-audit --no-fund)
fi

node "$REPO_DIR/bin/tokmon.mjs" setup "$@"
