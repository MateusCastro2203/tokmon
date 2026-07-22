# token-monitor — design

Data: 2026-07-22

## Problema

Usuário quer visibilidade de consumo de token das sessões do Claude Code: total gasto na sessão, qual prompt (mensagem do usuário) custou mais tokens, quebra de consumo por skill/subagente, e percentual de context window usado — tudo no terminal, sem precisar sair pra um app externo.

## Fora de escopo (decidido no brainstorm)

- **Custo em $**: não incluído nesta versão.
- **Cota/limite de plano (5h/semanal/mensal, reset countdown)**: já resolvido pelo [CodexBar](https://github.com/steipete/CodexBar) (app nativo macOS, mantido por terceiros, cobre 20+ providers via OAuth/cookies/API key). Não vale reinventar — instalar CodexBar separadamente pra essa necessidade. Este projeto foca no nicho que o CodexBar não cobre: introspecção *dentro* de uma sessão (qual prompt, qual skill).
- **App nativo de menu bar (Swift/SwiftUI)**: fica como possível projeto futuro separado, não faz parte deste escopo.

## Fonte de dado

Claude Code já grava transcript JSONL por sessão em:
```
~/.claude/projects/<cwd-encoded>/<sessionId>.jsonl
```
`<cwd-encoded>` = `cwd.replace(/[\/._]/g, '-')`.

Cada mensagem assistant tem bloco `usage` real:
```json
"usage": {
  "input_tokens": N,
  "output_tokens": N,
  "cache_creation_input_tokens": N,
  "cache_read_input_tokens": N
}
```
mais `timestamp`, `uuid`, `parentUuid`, `isSidechain`, `attributionSkill`, `model`.

Não é necessário hookar nada — só ler o arquivo que já existe.

## Instalação

Projeto vive em `~/Documents/claude-token-monitor` (repo git próprio). Instala-se copiando/symlinkando para `~/.claude/skills/token-monitor` (script `install.sh` do próprio projeto faz isso). `npm install` roda uma vez dentro da pasta instalada (dependências: `ink`, `react`).

## Componentes

### `scripts/lib.mjs`
Núcleo compartilhado, sem UI:
- `encodeProjectDir(cwd)` — replica o encoding do Claude Code.
- `findActiveSession(projectDir)` — `.jsonl` com mtime mais recente.
- `parseSession(path)` — lê linha a linha, retorna lista de eventos normalizados `{role, ts, usage, isSidechain, attributionSkill, uuid, parentUuid}`. Linha corrompida (JSON.parse falha) é ignorada e contada em `warnings`.
- `groupIntoTurns(events)` — agrupa em "turns": cada turn começa numa mensagem `role:user` real (texto de humano — `isSidechain:false`, `content` não é só `tool_result`) e acumula o `usage` de tudo que vem depois (assistant + sidechains) até o próximo turn real. Cada sidechain é etiquetada com `attributionSkill` pra permitir a quebra por skill.
- `computeTotals(turns)` — soma geral (input/output/cache write/cache read), ranking de turns por custo total, breakdown por `attributionSkill`, e % de context window (último turn da main chain: `input+cache_read+cache_creation` dividido pelo limite do modelo — mapa fixo `{sonnet: 200000, opus: 200000, haiku: 200000}`, ajustável).

### `scripts/snapshot.mjs`
CLI one-shot. Uso: `node snapshot.mjs [cwd]` (default `process.cwd()`). Imprime texto formatado:
```
Sessão ativa: <sessionId> (<projeto>)
Total: 128.4k tok  (in 12.1k / out 8.3k / cache-w 60.7k / cache-r 47.3k)
Context window: 34% (68.2k / 200k)

Top prompts:
 1. 42.1k  "refatora o cart.store pra..."
 2. 18.7k  "roda os testes de novo"
 ...

Por skill/agente:
 main loop     71.2k
 Explore       31.0k
 evaluator     26.2k
```
Se não houver sessão, imprime aviso claro (não crasha). Se `node_modules` faltando, instrui `npm install`.

### `scripts/watch.mjs`
TUI ao vivo com Ink (React via `createElement`, sem JSX/build step). `fs.watch` no arquivo da sessão ativa + poll de segurança (ex.: 2s) pra pegar writes que o watch de FS perca. Redesenha a tela tipo `htop`. Rodado manualmente pelo usuário numa aba de terminal separada: `node ~/.claude/skills/token-monitor/scripts/watch.mjs`. `Ctrl+C` sai.

### `scripts/statusline.mjs`
Integração com a **statusline nativa do Claude Code** (`settings.json` → campo `statusLine`). Claude Code invoca o script passando JSON no stdin com `transcript_path` já resolvido (não precisa re-derivar cwd). Script imprime uma linha compacta, ex.:
```
🔥 42.3k tok · ctx 18% · top 12.1k
```
Fica sempre visível no próprio terminal do Claude Code, sem processo manual — resolve o "não quero rodar watch na mão" pro caso de uso comum (visão passiva contínua). `watch.mjs` continua existindo pra quando quiser o dashboard completo (ranking, breakdown).

### `~/.claude/commands/tokens.md`
Slash command `/tokens`: instrui Claude a rodar `node ~/.claude/skills/token-monitor/scripts/snapshot.mjs "$(pwd)"` via Bash e mostrar a saída no chat.

### `SKILL.md`
Front-matter + instruções pro Claude: quando usuário pedir "quanto gastei de token", "ranking de prompt", "quebra por skill", etc., usar `snapshot.mjs`. Documenta `watch.mjs` (manual) e a wiring de `statusLine` (feita uma vez, na instalação).

## Wiring em settings.json

Adicionar em `~/.claude/settings.json`:
```json
{
  "statusLine": {
    "type": "command",
    "command": "node ~/.claude/skills/token-monitor/scripts/statusline.mjs"
  }
}
```
Essa etapa (mexer em `settings.json`) segue a skill `update-config` na hora da implementação, em vez de edição manual solta.

## Erros

- Pasta de projeto sem sessão ainda → mensagem clara, sem crash.
- Linha de JSONL corrompida → pula, conta em `warnings`, reporta no fim.
- `node_modules` ausente → instrução de `npm install` em vez de stack trace cru.
- `statusLine` chamado fora de um projeto com sessão ativa → imprime algo neutro (ex. `token-monitor: sem sessão`), nunca deixa a statusline quebrada/vazia.

## Teste

Sem app pra rodar (não é feature de UI mobile). Validação:
1. Rodar `snapshot.mjs` contra o `.jsonl` real de uma sessão (ex. desta conversa) e conferir os totais contra soma manual via `jq` (`.message.usage.input_tokens` etc. somados linha a linha).
2. Rodar `watch.mjs` ao vivo numa sessão ativa e confirmar que atualiza sozinho ao chegar mensagem nova.
3. Configurar `statusLine` e confirmar que a linha aparece e atualiza no terminal do Claude Code.
