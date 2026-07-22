---
name: token-monitor
description: Mostra consumo de token da sessão atual do Claude Code — total, ranking de prompt mais caro, quebra por skill/subagente e % de context window. Use quando o usuário perguntar "quanto gastei de token", "qual prompt custou mais", "quebra por skill" ou similar.
---

# token-monitor

Skill pra responder perguntas sobre consumo de token da sessão atual, lendo o transcript JSONL que o próprio Claude Code já grava (sem hook, sem API externa).

## Quando usar

Quando o usuário perguntar algo como:
- "quanto gastei de token nessa sessão"
- "qual prompt custou mais token"
- "quebra o consumo por skill/agente"
- "quanto da context window já usei"

## Como usar

Rode:
```bash
node ~/.claude/skills/token-monitor/scripts/snapshot.mjs "$(pwd)"
```
e mostre a saída pro usuário — ela já vem formatada, não precisa reformatar.

## Dashboard ao vivo (manual, opcional)

Pra visão contínua tipo `htop`, o usuário roda isso numa aba de terminal separada (fora do Claude Code):
```bash
node ~/.claude/skills/token-monitor/scripts/watch.mjs
```

## Statusline (visão passiva, sem rodar nada)

Se `tokmon setup` (ou `install.sh`) já rodou, `scripts/statusline.mjs` fica registrado em `~/.claude/settings.json` (`statusLine`) e mostra uma linha compacta sempre visível no terminal do Claude Code, atualizando sozinha.
