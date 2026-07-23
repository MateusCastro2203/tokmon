# tokmon

[![test](https://github.com/MateusCastro2203/tokmon/actions/workflows/test.yml/badge.svg)](https://github.com/MateusCastro2203/tokmon/actions/workflows/test.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

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
│  1.    6.0M  "refatora o módulo de autenticação..." │
│  2.    1.5M  "explica por que esse teste falha..." │
╰────────────────────────────────────────────────────╯
╭─ 🧩 Por skill/agente ─────────────────────────────╮
│  main            7.7M                             │
╰────────────────────────────────────────────────────╯
```

## Integração com o Claude Code

Pra ter a skill disponível dentro do próprio Claude Code (slash command `/tokens` + statusline nativa sempre visível), rode:

```bash
tokmon setup
```

Isso:
1. Symlinka o pacote pra `~/.claude/skills/token-monitor` (a skill em si, com `SKILL.md`).
2. Copia o comando `/tokens` pra `~/.claude/commands/tokens.md`.
3. Registra a `statusLine` em `~/.claude/settings.json` automaticamente — preserva todo o resto do arquivo, e nunca sobrescreve uma `statusLine` diferente que você já tenha configurado (a menos que rode `tokmon setup --force`).

Depois disso, uma linha compacta (`🔥 sessão: ... · contexto: ...% usado · prompt mais caro: ...`) aparece sozinha no rodapé do terminal do Claude Code, sem precisar rodar nada manualmente.

## Privacidade

Roda 100% local. Não faz nenhuma chamada de rede, não envia telemetria, não tem chave de API. A única coisa que lê é o `.jsonl` que o próprio Claude Code já grava no seu disco (`~/.claude/projects/**/*.jsonl`) — nada sai da sua máquina.

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
