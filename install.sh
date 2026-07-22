#!/usr/bin/env bash
set -euo pipefail

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CLAUDE_HOME="${TOKEN_MONITOR_HOME:-$HOME/.claude}"
SKILL_LINK="$CLAUDE_HOME/skills/token-monitor"
COMMAND_FILE="$CLAUDE_HOME/commands/tokens.md"

mkdir -p "$CLAUDE_HOME/skills" "$CLAUDE_HOME/commands"

if [ -e "$SKILL_LINK" ] && [ ! -L "$SKILL_LINK" ]; then
  echo "error: $SKILL_LINK existe e não é um symlink — remova manualmente antes de instalar." >&2
  exit 1
fi
ln -sfn "$REPO_DIR" "$SKILL_LINK"
echo "✓ skill linkada em $SKILL_LINK"

cp "$REPO_DIR/commands/tokens.md" "$COMMAND_FILE"
echo "✓ comando /tokens copiado pra $COMMAND_FILE"

if [ ! -d "$REPO_DIR/node_modules" ]; then
  echo "Instalando dependências (ink, react)..."
  (cd "$REPO_DIR" && npm install --no-audit --no-fund)
fi
echo "✓ dependências prontas"

echo ""
echo "Falta um passo manual: registrar a statusline no seu ~/.claude/settings.json."
echo "Adicione o bloco abaixo (ou peça pra rodar via skill update-config):"
echo ""
echo "{"
echo "  \"statusLine\": {"
echo "    \"type\": \"command\","
echo "    \"command\": \"node $SKILL_LINK/scripts/statusline.mjs\""
echo "  }"
echo "}"
