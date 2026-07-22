# tokmon

Skill do [Claude Code](https://claude.com/claude-code) que lê o transcript JSONL que o próprio Claude Code já grava por sessão e mostra: total de tokens gasto, ranking de qual prompt custou mais, quebra por skill/subagente, e % de context window usado. Sem hook, sem API externa, sem auth — só lê o arquivo que já existe em `~/.claude/projects/<projeto>/<sessão>.jsonl`.

Fora de escopo: custo em $, e cota/limite de plano (5h/semanal/mensal) — isso já é resolvido pelo [CodexBar](https://github.com/steipete/CodexBar).

## Instalar

```bash
npm install -g tokmon-app
```

Isso expõe o comando `tokmon` no seu terminal.

## Usar

```bash
tokmon snapshot        # snapshot de texto da sessão ativa no diretório atual
tokmon watch           # dashboard ao vivo, atualiza sozinho (Ctrl+C sai)
tokmon help            # ajuda
```

`tokmon watch` mostra algo assim, com cor de contexto mudando (verde/amarelo/vermelho) conforme o uso sobe:

```
╭─ token-monitor — meu-projeto (sessão) ───────────╮
│ 🔥 Total: 7.7M tok                                │
│    in 47.5k · out 103.5k · cache-w 419.3k · ...   │
│ 🧠 Contexto: 70.1% usado (140.2k / 200.0k)         │
╰────────────────────────────────────────────────────╯
╭─ 🏆 Top prompts ──────────────────────────────────╮
│  1.    6.0M  "Base directory for this skill..."    │
│  2.    1.5M  "coloque a experiencia em mobile..."  │
╰────────────────────────────────────────────────────╯
╭─ 🧩 Por skill/agente ─────────────────────────────╮
│  main            7.7M                             │
╰────────────────────────────────────────────────────╯
```

## Integração com o Claude Code

Pra ter a skill disponível dentro do próprio Claude Code (slash command `/tokens` + statusline nativa sempre visível), rode o instalador depois de instalar o pacote:

```bash
$(npm root -g)/tokmon-app/install.sh
```

Isso:
1. Symlinka o pacote pra `~/.claude/skills/token-monitor` (a skill em si, com `SKILL.md`).
2. Copia o comando `/tokens` pra `~/.claude/commands/tokens.md`.
3. Imprime o bloco `statusLine` pra você adicionar em `~/.claude/settings.json` (mostra um resumo compacto sempre visível no rodapé do terminal do Claude Code, atualizando sozinho).

## Desenvolvimento

```bash
git clone git@github.com:MateusCastro2203/tokmon.git
cd tokmon
npm install
npm link        # expõe `tokmon` local pra testar sem publicar
npm test        # node:test — sem dependência extra de test runner
```

## Licença

MIT — veja [LICENSE](LICENSE).
