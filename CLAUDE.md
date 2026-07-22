# CLAUDE.md — claude-token-monitor

## O que é

Skill global do Claude Code que lê o transcript JSONL que o próprio Claude Code já grava por sessão (`~/.claude/projects/<cwd-encoded>/<sessionId>.jsonl`) e expõe: total de tokens da sessão, ranking de qual prompt custou mais, quebra por skill/subagente (`attributionSkill`), e % de context window usado. Sem hook, sem API externa, sem auth.

Spec completo: `docs/superpowers/specs/2026-07-22-token-monitor-design.md`.

Fora de escopo (decidido em brainstorm): custo em $ e cota/limite de plano (5h/semanal/mensal) — isso é coberto pelo [CodexBar](https://github.com/steipete/CodexBar), não reinventar aqui.

## Stack

- Node.js ESM, sem build step (JS puro, sem TypeScript/JSX)
- `ink` + `react` pro TUI ao vivo (`watch.mjs`), usando `React.createElement` direto (sem JSX)
- Integração com a `statusLine` nativa do Claude Code (campo `statusLine` em `~/.claude/settings.json`)

## Estrutura

```
scripts/
├─ lib.mjs          # parsing do JSONL + agregação (encode de path, turns, totais, ranking)
├─ snapshot.mjs      # CLI one-shot — usado pelo slash command /tokens
├─ watch.mjs         # TUI ao vivo (Ink), rodado manualmente pelo usuário
└─ statusline.mjs    # linha compacta pra statusLine do Claude Code
SKILL.md             # instruções pro Claude sobre quando/como usar os scripts
package.json         # deps: ink, react
```

## Comandos úteis

```bash
node scripts/snapshot.mjs [cwd]   # snapshot de texto, default cwd atual
node scripts/watch.mjs             # dashboard ao vivo, roda numa aba separada
```

## Instalação (na máquina do usuário)

1. Copiar/symlinkar esta pasta pra `~/.claude/skills/token-monitor`.
2. `npm install` dentro da pasta instalada.
3. Registrar `~/.claude/commands/tokens.md` (slash command `/tokens`).
4. Adicionar `statusLine` em `~/.claude/settings.json` apontando pro `statusline.mjs` instalado.

## Armadilhas conhecidas

(nenhuma ainda — projeto em fase de spec, implementação não começou)
