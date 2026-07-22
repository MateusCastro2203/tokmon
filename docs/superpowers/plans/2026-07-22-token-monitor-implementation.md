# Token Monitor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the `token-monitor` Claude Code skill — reads the JSONL transcript Claude Code already writes per session and exposes session token totals, a ranking of the most expensive prompts, a per-skill/subagent breakdown, and context-window usage, via a one-shot CLI (`/tokens`), a live terminal dashboard (`watch.mjs`), and a native Claude Code statusline.

**Architecture:** A single shared parsing/aggregation module (`scripts/lib.mjs`) is consumed by three thin entry points: `snapshot.mjs` (one-shot text CLI, backs `/tokens`), `watch.mjs` (Ink TUI, polls + `fs.watch`s the active session file), and `statusline.mjs` (reads Claude Code's own stdin JSON, backs the native `statusLine` setting). `install.sh` symlinks the repo into `~/.claude/skills/token-monitor`, copies the `/tokens` command file, and prints the manual `settings.json` snippet for `statusLine`.

**Tech Stack:** Node.js ESM (no build step), `ink` + `react` (TUI, via `React.createElement` — no JSX), `node:test` for tests (no extra test-runner dependency).

## Global Constraints

- Node.js ESM only (`"type": "module"` in `package.json`); no build step, no JSX — Ink components use `React.createElement`.
- npm runtime dependencies limited to exactly `ink` and `react`. No other runtime dependency (test runner is Node's built-in `node:test`/`node:assert`).
- Single data source: `~/.claude/projects/<cwd-encoded>/<sessionId>.jsonl`, where `cwd-encoded = cwd.replace(/[\/._]/g, '-')`. Never invent a new hook to capture usage — only read what Claude Code already writes.
- Context-window model-limit map defaults to `{ sonnet: 200000, opus: 200000, haiku: 200000 }`, overridable via an `opts.modelLimits` parameter.
- Out of scope: dollar-cost estimation, and plan/quota limits (5h/weekly/monthly) — that need is already covered by CodexBar; do not duplicate it here.
- Errors never surface a raw stack trace to the user: missing session, corrupted JSONL line, missing `node_modules` all produce a clear, friendly message instead.
- Any change to the user's real `~/.claude/settings.json` (the `statusLine` wiring) follows the `update-config` skill's guidance and requires explicit user confirmation before being applied — it is global state outside this repo, not to be edited silently.
- Tests use only `node:test` / `node:assert/strict` — no Jest, no Mocha, no extra test-runner dependency.

---

### Task 1: Project scaffolding

**Files:**
- Create: `package.json`
- Create: `.gitignore`
- Create: `scripts/` (empty dir, populated in later tasks)
- Create: `tests/fixtures/` (empty dir, populated in Task 3)

**Interfaces:**
- Produces: an installable Node ESM project with `ink` + `react` resolvable from `node_modules`, and `npm test` wired to `node --test tests/`.

- [ ] **Step 1: Create `package.json`**

```json
{
  "name": "claude-token-monitor",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "description": "Skill do Claude Code para monitorar consumo de token por sessao (ranking de prompt, breakdown por skill, context window).",
  "scripts": {
    "test": "node --test tests/"
  },
  "dependencies": {
    "ink": "^5.0.1",
    "react": "^18.3.1"
  }
}
```

- [ ] **Step 2: Create `.gitignore`**

```
node_modules/
```

- [ ] **Step 3: Create empty directories**

```bash
mkdir -p scripts tests/fixtures
```

- [ ] **Step 4: Install dependencies**

Run: `npm install`
Expected: exits 0, creates `node_modules/`, `package-lock.json`.

- [ ] **Step 5: Verify `ink` resolves**

Run: `node --input-type=module -e "import('ink').then(() => console.log('ink OK'))"`
Expected output: `ink OK`

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json .gitignore scripts tests
git commit -m "$(cat <<'EOF'
chore: scaffold project (package.json, ink/react deps)

Co-Authored-By: Claude <noreply@anthropic.com>
AI-Assisted: yes
AI-Tool: claude-code
EOF
)"
```

---

### Task 2: `lib.mjs` — session file discovery

**Files:**
- Create: `scripts/lib.mjs`
- Test: `tests/lib.discovery.test.mjs`

**Interfaces:**
- Produces:
  - `encodeProjectDir(cwd: string): string`
  - `listSessionFiles(projectDir: string): string[]` — absolute paths, sorted by mtime descending
  - `findActiveSession(projectDir: string): string | null`

- [ ] **Step 1: Write the failing test**

```js
// tests/lib.discovery.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, utimesSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { encodeProjectDir, findActiveSession, listSessionFiles } from '../scripts/lib.mjs';

test('encodeProjectDir replaces slashes, dots and underscores with dashes', () => {
  const result = encodeProjectDir('/Users/mateus.castro/Documents/React-Native_Harness');
  assert.equal(result, '-Users-mateus-castro-Documents-React-Native-Harness');
});

test('listSessionFiles returns .jsonl files sorted by mtime descending', () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'token-monitor-'));
  const older = path.join(dir, 'session-a.jsonl');
  const newer = path.join(dir, 'session-b.jsonl');
  writeFileSync(older, '{}\n');
  writeFileSync(newer, '{}\n');
  const past = new Date('2026-01-01T00:00:00Z');
  const recent = new Date('2026-06-01T00:00:00Z');
  utimesSync(older, past, past);
  utimesSync(newer, recent, recent);
  assert.deepEqual(listSessionFiles(dir), [newer, older]);
});

test('findActiveSession returns the most recently modified session, null when none exist', () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'token-monitor-'));
  assert.equal(findActiveSession(dir), null);
  const file = path.join(dir, 'session-a.jsonl');
  writeFileSync(file, '{}\n');
  assert.equal(findActiveSession(dir), file);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/lib.discovery.test.mjs`
Expected: FAIL — `scripts/lib.mjs` does not exist / exports undefined.

- [ ] **Step 3: Write minimal implementation**

```js
// scripts/lib.mjs
import { readdirSync, statSync, existsSync } from 'node:fs';
import path from 'node:path';

export function encodeProjectDir(cwd) {
  return cwd.replace(/[\/._]/g, '-');
}

export function listSessionFiles(projectDir) {
  if (!existsSync(projectDir)) return [];
  return readdirSync(projectDir)
    .filter((name) => name.endsWith('.jsonl'))
    .map((name) => path.join(projectDir, name))
    .sort((a, b) => statSync(b).mtimeMs - statSync(a).mtimeMs);
}

export function findActiveSession(projectDir) {
  const files = listSessionFiles(projectDir);
  return files[0] ?? null;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/lib.discovery.test.mjs`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add scripts/lib.mjs tests/lib.discovery.test.mjs
git commit -m "$(cat <<'EOF'
feat: add session file discovery to lib.mjs

Co-Authored-By: Claude <noreply@anthropic.com>
AI-Assisted: yes
AI-Tool: claude-code
EOF
)"
```

---

### Task 3: `lib.mjs` — parse session JSONL into normalized events

**Files:**
- Modify: `scripts/lib.mjs`
- Create: `tests/fixtures/sample-session.jsonl`
- Test: `tests/lib.parse.test.mjs`

**Interfaces:**
- Consumes: nothing from Task 2 directly (independent functions in the same file).
- Produces:
  - `parseSession(filePath: string): { events: NormalizedEvent[], warnings: number }`
  - `NormalizedEvent = { role: 'user'|'assistant', ts: string|null, uuid: string|null, parentUuid: string|null, isSidechain: boolean, attributionSkill: string|null, model: string|null, isRealUserText: boolean, textPreview: string|null, usage: { input_tokens, output_tokens, cache_creation_input_tokens, cache_read_input_tokens } | null }`
  - The fixture file created here (`tests/fixtures/sample-session.jsonl`) is reused by Tasks 4, 5, 6, 7, 10.

- [ ] **Step 1: Create the fixture file**

This fixture models one real user turn (with a sidechain subagent call and a tool-result round-trip in the middle), a second real user turn, and one corrupted line — used by every later task's tests.

```
{"uuid":"u1","parentUuid":null,"isSidechain":false,"timestamp":"2026-07-22T10:00:00.000Z","message":{"role":"user","content":"Corrige o bug do cupom"}}
{"uuid":"a1","parentUuid":"u1","isSidechain":false,"timestamp":"2026-07-22T10:00:05.000Z","message":{"role":"assistant","model":"claude-sonnet-5","content":[{"type":"text","text":"Vendo o bug..."}],"usage":{"input_tokens":100,"output_tokens":50,"cache_creation_input_tokens":2000,"cache_read_input_tokens":500}}}
{"uuid":"s1","parentUuid":null,"isSidechain":true,"attributionSkill":"Explore","timestamp":"2026-07-22T10:00:10.000Z","message":{"role":"assistant","model":"claude-sonnet-5","content":[{"type":"text","text":"Achei o arquivo"}],"usage":{"input_tokens":20,"output_tokens":300,"cache_creation_input_tokens":8000,"cache_read_input_tokens":100}}}
{"uuid":"a2","parentUuid":"a1","isSidechain":false,"timestamp":"2026-07-22T10:00:20.000Z","message":{"role":"assistant","model":"claude-sonnet-5","content":[{"type":"text","text":"Aplicando fix"}],"usage":{"input_tokens":10,"output_tokens":900,"cache_creation_input_tokens":0,"cache_read_input_tokens":9000}}}
{"uuid":"tr1","parentUuid":"a2","isSidechain":false,"timestamp":"2026-07-22T10:00:25.000Z","toolUseResult":{"stdout":"ok"},"message":{"role":"user","content":[{"type":"tool_result","tool_use_id":"toolu_1","content":"ok"}]}}
{"uuid":"a3","parentUuid":"tr1","isSidechain":false,"timestamp":"2026-07-22T10:00:30.000Z","message":{"role":"assistant","model":"claude-sonnet-5","content":[{"type":"text","text":"Pronto, corrigido"}],"usage":{"input_tokens":5,"output_tokens":40,"cache_creation_input_tokens":0,"cache_read_input_tokens":9500}}}
{"uuid":"u2","parentUuid":"a3","isSidechain":false,"timestamp":"2026-07-22T10:01:00.000Z","message":{"role":"user","content":"roda os testes de novo"}}
{"uuid":"a4","parentUuid":"u2","isSidechain":false,"timestamp":"2026-07-22T10:01:05.000Z","message":{"role":"assistant","model":"claude-sonnet-5","content":[{"type":"text","text":"Testes passaram"}],"usage":{"input_tokens":8,"output_tokens":20,"cache_creation_input_tokens":0,"cache_read_input_tokens":200}}}
this is not valid json {{{
```

Hand-computed reference numbers for later tasks (keep for test assertions):
- Turn 1 (`u1`) total = 2650 (`a1`) + 8420 (`s1`, skill `Explore`) + 9910 (`a2`) + 9545 (`a3`) = **30525**; `bySkill` = `{ main: 22105, Explore: 8420 }`
- Turn 2 (`u2`) total = 228 (`a4`); `bySkill` = `{ main: 228 }`
- Session totals: `input_tokens=143`, `output_tokens=1310`, `cache_creation_input_tokens=10000`, `cache_read_input_tokens=19300`, `total=30753`
- `bySkill` session-wide: `main=22333`, `Explore=8420`
- Context window: last main-chain assistant event is `a4` → `totalInputTokens = 8+200+0 = 208`, model `claude-sonnet-5` → limit `200000` → `usedPercentage = 0.1`
- `warnings = 1` (the corrupted last line)

- [ ] **Step 2: Write the failing test**

```js
// tests/lib.parse.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseSession } from '../scripts/lib.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURE = path.join(__dirname, 'fixtures', 'sample-session.jsonl');

test('parseSession normalizes events and counts corrupted lines as warnings', () => {
  const { events, warnings } = parseSession(FIXTURE);
  assert.equal(warnings, 1);
  assert.equal(events.length, 8);

  const u1 = events.find((e) => e.uuid === 'u1');
  assert.equal(u1.role, 'user');
  assert.equal(u1.isRealUserText, true);
  assert.equal(u1.textPreview, 'Corrige o bug do cupom');

  const tr1 = events.find((e) => e.uuid === 'tr1');
  assert.equal(tr1.role, 'user');
  assert.equal(tr1.isRealUserText, false);

  const a1 = events.find((e) => e.uuid === 'a1');
  assert.deepEqual(a1.usage, {
    input_tokens: 100,
    output_tokens: 50,
    cache_creation_input_tokens: 2000,
    cache_read_input_tokens: 500,
  });

  const s1 = events.find((e) => e.uuid === 's1');
  assert.equal(s1.isSidechain, true);
  assert.equal(s1.attributionSkill, 'Explore');
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `node --test tests/lib.parse.test.mjs`
Expected: FAIL — `parseSession` is not exported.

- [ ] **Step 4: Write minimal implementation**

Append to `scripts/lib.mjs`:

```js
import { readFileSync } from 'node:fs';

function isRealUserMessage(entry) {
  if (entry.message?.role !== 'user') return false;
  if (entry.toolUseResult) return false;
  const content = entry.message.content;
  if (typeof content === 'string') return content.trim().length > 0;
  if (Array.isArray(content)) {
    const hasToolResult = content.some((block) => block.type === 'tool_result');
    if (hasToolResult) return false;
    return content.some((block) => block.type === 'text' && block.text.trim().length > 0);
  }
  return false;
}

function extractTextPreview(entry) {
  const content = entry.message?.content;
  let text = null;
  if (typeof content === 'string') text = content;
  else if (Array.isArray(content)) {
    const block = content.find((b) => b.type === 'text' && typeof b.text === 'string');
    text = block?.text ?? null;
  }
  if (!text) return null;
  const trimmed = text.trim().replace(/\s+/g, ' ');
  return trimmed.length > 60 ? `${trimmed.slice(0, 60)}…` : trimmed;
}

function normalizeEvent(entry) {
  const role = entry.message?.role;
  if (role !== 'user' && role !== 'assistant') return null;
  const usageRaw = entry.message?.usage;
  const usage = usageRaw
    ? {
        input_tokens: usageRaw.input_tokens ?? 0,
        output_tokens: usageRaw.output_tokens ?? 0,
        cache_creation_input_tokens: usageRaw.cache_creation_input_tokens ?? 0,
        cache_read_input_tokens: usageRaw.cache_read_input_tokens ?? 0,
      }
    : null;
  return {
    role,
    ts: entry.timestamp ?? null,
    uuid: entry.uuid ?? null,
    parentUuid: entry.parentUuid ?? null,
    isSidechain: entry.isSidechain === true,
    attributionSkill: entry.attributionSkill ?? null,
    model: entry.message?.model ?? null,
    isRealUserText: isRealUserMessage(entry),
    textPreview: extractTextPreview(entry),
    usage,
  };
}

export function parseSession(filePath) {
  const raw = readFileSync(filePath, 'utf8');
  const lines = raw.split('\n').filter((l) => l.trim().length > 0);
  const events = [];
  let warnings = 0;
  for (const line of lines) {
    let entry;
    try {
      entry = JSON.parse(line);
    } catch {
      warnings += 1;
      continue;
    }
    const normalized = normalizeEvent(entry);
    if (normalized) events.push(normalized);
  }
  return { events, warnings };
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `node --test tests/lib.parse.test.mjs`
Expected: PASS (1 test, 6 assertions)

- [ ] **Step 6: Commit**

```bash
git add scripts/lib.mjs tests/lib.parse.test.mjs tests/fixtures/sample-session.jsonl
git commit -m "$(cat <<'EOF'
feat: parse session JSONL into normalized events

Co-Authored-By: Claude <noreply@anthropic.com>
AI-Assisted: yes
AI-Tool: claude-code
EOF
)"
```

---

### Task 4: `lib.mjs` — group events into turns

**Files:**
- Modify: `scripts/lib.mjs`
- Test: `tests/lib.turns.test.mjs`

**Interfaces:**
- Consumes: `parseSession` (Task 3) output shape (`NormalizedEvent[]`).
- Produces: `groupIntoTurns(events: NormalizedEvent[]): Turn[]`, where `Turn = { id: string, ts: string, textPreview: string, usage: { input_tokens, output_tokens, cache_creation_input_tokens, cache_read_input_tokens, total }, bySkill: Record<string, number> }`.

- [ ] **Step 1: Write the failing test**

```js
// tests/lib.turns.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseSession, groupIntoTurns } from '../scripts/lib.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURE = path.join(__dirname, 'fixtures', 'sample-session.jsonl');

test('groupIntoTurns attributes sidechain and post-tool-result usage to the right turn', () => {
  const { events } = parseSession(FIXTURE);
  const turns = groupIntoTurns(events);

  assert.equal(turns.length, 2);

  const [turn1, turn2] = turns;
  assert.equal(turn1.id, 'u1');
  assert.equal(turn1.textPreview, 'Corrige o bug do cupom');
  assert.equal(turn1.usage.total, 30525);
  assert.deepEqual(turn1.bySkill, { main: 22105, Explore: 8420 });

  assert.equal(turn2.id, 'u2');
  assert.equal(turn2.usage.total, 228);
  assert.deepEqual(turn2.bySkill, { main: 228 });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/lib.turns.test.mjs`
Expected: FAIL — `groupIntoTurns` is not exported.

- [ ] **Step 3: Write minimal implementation**

Append to `scripts/lib.mjs`:

```js
export function groupIntoTurns(events) {
  const turns = [];
  let current = null;
  for (const event of events) {
    if (event.role === 'user' && event.isRealUserText && !event.isSidechain) {
      current = {
        id: event.uuid,
        ts: event.ts,
        textPreview: event.textPreview ?? '',
        usage: { input_tokens: 0, output_tokens: 0, cache_creation_input_tokens: 0, cache_read_input_tokens: 0, total: 0 },
        bySkill: {},
      };
      turns.push(current);
      continue;
    }
    if (!current || !event.usage) continue;
    const bucket = event.isSidechain ? (event.attributionSkill ?? 'subagent') : 'main';
    const turnTotal =
      event.usage.input_tokens +
      event.usage.output_tokens +
      event.usage.cache_creation_input_tokens +
      event.usage.cache_read_input_tokens;
    current.usage.input_tokens += event.usage.input_tokens;
    current.usage.output_tokens += event.usage.output_tokens;
    current.usage.cache_creation_input_tokens += event.usage.cache_creation_input_tokens;
    current.usage.cache_read_input_tokens += event.usage.cache_read_input_tokens;
    current.usage.total += turnTotal;
    current.bySkill[bucket] = (current.bySkill[bucket] ?? 0) + turnTotal;
  }
  return turns;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/lib.turns.test.mjs`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add scripts/lib.mjs tests/lib.turns.test.mjs
git commit -m "$(cat <<'EOF'
feat: group session events into per-prompt turns

Co-Authored-By: Claude <noreply@anthropic.com>
AI-Assisted: yes
AI-Tool: claude-code
EOF
)"
```

---

### Task 5: `lib.mjs` — compute totals, ranking, skill breakdown, context window

**Files:**
- Modify: `scripts/lib.mjs`
- Test: `tests/lib.totals.test.mjs`

**Interfaces:**
- Consumes: `NormalizedEvent[]` (Task 3) and `Turn[]` (Task 4).
- Produces:
  - `DEFAULT_MODEL_LIMITS: Record<string, number>`
  - `formatTokenCount(n: number): string`
  - `computeTotals(events: NormalizedEvent[], turns: Turn[], opts?: { modelLimits?: Record<string, number> }): Totals`, where `Totals = { totals: {input_tokens, output_tokens, cache_creation_input_tokens, cache_read_input_tokens, total}, bySkill: Array<{skill, total}> (desc), topTurns: Turn[] (desc by usage.total), contextWindow: {totalInputTokens, contextWindowSize, usedPercentage} | null }`

- [ ] **Step 1: Write the failing test**

```js
// tests/lib.totals.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseSession, groupIntoTurns, computeTotals, formatTokenCount } from '../scripts/lib.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURE = path.join(__dirname, 'fixtures', 'sample-session.jsonl');

test('formatTokenCount formats sub-1000 counts raw and larger counts with a k suffix', () => {
  assert.equal(formatTokenCount(208), '208');
  assert.equal(formatTokenCount(30753), '30.8k');
  assert.equal(formatTokenCount(200000), '200.0k');
});

test('computeTotals aggregates totals, ranks turns, breaks down by skill, and computes context window', () => {
  const { events } = parseSession(FIXTURE);
  const turns = groupIntoTurns(events);
  const totals = computeTotals(events, turns);

  assert.deepEqual(totals.totals, {
    input_tokens: 143,
    output_tokens: 1310,
    cache_creation_input_tokens: 10000,
    cache_read_input_tokens: 19300,
    total: 30753,
  });

  assert.deepEqual(totals.bySkill, [
    { skill: 'main', total: 22333 },
    { skill: 'Explore', total: 8420 },
  ]);

  assert.equal(totals.topTurns[0].id, 'u1');
  assert.equal(totals.topTurns[0].usage.total, 30525);
  assert.equal(totals.topTurns[1].id, 'u2');

  assert.deepEqual(totals.contextWindow, {
    totalInputTokens: 208,
    contextWindowSize: 200000,
    usedPercentage: 0.1,
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/lib.totals.test.mjs`
Expected: FAIL — `computeTotals`/`formatTokenCount` not exported.

- [ ] **Step 3: Write minimal implementation**

Append to `scripts/lib.mjs`:

```js
export const DEFAULT_MODEL_LIMITS = { sonnet: 200000, opus: 200000, haiku: 200000 };

export function formatTokenCount(n) {
  if (n < 1000) return String(Math.round(n));
  return `${(n / 1000).toFixed(1)}k`;
}

function resolveModelLimit(modelId, modelLimits) {
  if (!modelId) return 200000;
  const lower = modelId.toLowerCase();
  for (const [key, limit] of Object.entries(modelLimits)) {
    if (lower.includes(key)) return limit;
  }
  return 200000;
}

export function computeTotals(events, turns, opts = {}) {
  const modelLimits = opts.modelLimits ?? DEFAULT_MODEL_LIMITS;

  const totals = { input_tokens: 0, output_tokens: 0, cache_creation_input_tokens: 0, cache_read_input_tokens: 0, total: 0 };
  const bySkillMap = {};
  for (const turn of turns) {
    totals.input_tokens += turn.usage.input_tokens;
    totals.output_tokens += turn.usage.output_tokens;
    totals.cache_creation_input_tokens += turn.usage.cache_creation_input_tokens;
    totals.cache_read_input_tokens += turn.usage.cache_read_input_tokens;
    totals.total += turn.usage.total;
    for (const [skill, tokens] of Object.entries(turn.bySkill)) {
      bySkillMap[skill] = (bySkillMap[skill] ?? 0) + tokens;
    }
  }
  const bySkill = Object.entries(bySkillMap)
    .map(([skill, total]) => ({ skill, total }))
    .sort((a, b) => b.total - a.total);
  const topTurns = [...turns].sort((a, b) => b.usage.total - a.usage.total);

  let contextWindow = null;
  const lastMainAssistant = [...events].reverse().find((e) => e.role === 'assistant' && !e.isSidechain && e.usage);
  if (lastMainAssistant) {
    const totalInputTokens =
      lastMainAssistant.usage.input_tokens +
      lastMainAssistant.usage.cache_read_input_tokens +
      lastMainAssistant.usage.cache_creation_input_tokens;
    const contextWindowSize = resolveModelLimit(lastMainAssistant.model, modelLimits);
    contextWindow = {
      totalInputTokens,
      contextWindowSize,
      usedPercentage: Math.round((totalInputTokens / contextWindowSize) * 1000) / 10,
    };
  }

  return { totals, bySkill, topTurns, contextWindow };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/lib.totals.test.mjs`
Expected: PASS (2 tests)

- [ ] **Step 5: Run the full test suite so far**

Run: `npm test`
Expected: all tests across Tasks 2–5 PASS.

- [ ] **Step 6: Commit**

```bash
git add scripts/lib.mjs tests/lib.totals.test.mjs
git commit -m "$(cat <<'EOF'
feat: compute session totals, ranking, skill breakdown, context window

Co-Authored-By: Claude <noreply@anthropic.com>
AI-Assisted: yes
AI-Tool: claude-code
EOF
)"
```

---

### Task 6: `scripts/snapshot.mjs` — one-shot text CLI

**Files:**
- Create: `scripts/snapshot.mjs`
- Modify: `scripts/lib.mjs` (add `formatSnapshot`)
- Test: `tests/snapshot.test.mjs`

**Interfaces:**
- Consumes: `encodeProjectDir`, `findActiveSession`, `parseSession`, `groupIntoTurns`, `computeTotals`, `formatTokenCount` (Tasks 2–5).
- Produces: `formatSnapshot(totals: Totals, meta: { sessionId: string, projectLabel: string, warnings?: number, topN?: number }): string`; `scripts/snapshot.mjs` CLI (`node scripts/snapshot.mjs [cwd]`).

- [ ] **Step 1: Write the failing test (pure formatter)**

```js
// tests/snapshot.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, copyFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { parseSession, groupIntoTurns, computeTotals, formatSnapshot, encodeProjectDir } from '../scripts/lib.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURE = path.join(__dirname, 'fixtures', 'sample-session.jsonl');

test('formatSnapshot renders totals, context window, top prompts and skill breakdown', () => {
  const { events } = parseSession(FIXTURE);
  const turns = groupIntoTurns(events);
  const totals = computeTotals(events, turns);

  const output = formatSnapshot(totals, { sessionId: 'session-fixture', projectLabel: 'meu-projeto', warnings: 1 });

  assert.match(output, /Sessão ativa: session-fixture \(meu-projeto\)/);
  assert.ok(output.includes('Total: 30.8k tok'));
  assert.ok(output.includes('Context window: 0.1% (208 / 200.0k)'));
  assert.ok(output.includes('30.5k'));
  assert.ok(output.includes('Corrige o bug do cupom'));
  assert.ok(output.includes('Explore'));
  assert.ok(output.includes('1 linha(s) de log ignorada(s)'));
});

test('snapshot.mjs CLI prints a friendly message and formatted output end to end', () => {
  const fakeHome = mkdtempSync(path.join(tmpdir(), 'token-monitor-home-'));
  const fakeCwd = '/Users/fixture/project';
  const projectDir = path.join(fakeHome, '.claude', 'projects', encodeProjectDir(fakeCwd));
  mkdirSync(projectDir, { recursive: true });
  copyFileSync(FIXTURE, path.join(projectDir, 'session-fixture.jsonl'));

  const output = execFileSync('node', [path.join(__dirname, '..', 'scripts', 'snapshot.mjs'), fakeCwd], {
    env: { ...process.env, HOME: fakeHome },
    encoding: 'utf8',
  });
  assert.ok(output.includes('Total: 30.8k tok'));
  assert.ok(output.includes('Corrige o bug do cupom'));

  const emptyHome = mkdtempSync(path.join(tmpdir(), 'token-monitor-home-empty-'));
  const emptyOutput = execFileSync('node', [path.join(__dirname, '..', 'scripts', 'snapshot.mjs'), fakeCwd], {
    env: { ...process.env, HOME: emptyHome },
    encoding: 'utf8',
  });
  assert.ok(emptyOutput.includes('nenhuma sessão encontrada'));
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/snapshot.test.mjs`
Expected: FAIL — `formatSnapshot` not exported, `scripts/snapshot.mjs` does not exist.

- [ ] **Step 3: Write minimal implementation**

Append to `scripts/lib.mjs`:

```js
export function formatSnapshot(totals, meta) {
  const { sessionId, projectLabel, warnings = 0, topN = 5 } = meta;
  const lines = [];
  lines.push(`Sessão ativa: ${sessionId} (${projectLabel})`);
  const t = totals.totals;
  lines.push(
    `Total: ${formatTokenCount(t.total)} tok  (in ${formatTokenCount(t.input_tokens)} / out ${formatTokenCount(
      t.output_tokens
    )} / cache-w ${formatTokenCount(t.cache_creation_input_tokens)} / cache-r ${formatTokenCount(
      t.cache_read_input_tokens
    )})`
  );
  if (totals.contextWindow) {
    lines.push(
      `Context window: ${totals.contextWindow.usedPercentage}% (${formatTokenCount(
        totals.contextWindow.totalInputTokens
      )} / ${formatTokenCount(totals.contextWindow.contextWindowSize)})`
    );
  }
  lines.push('');
  lines.push('Top prompts:');
  const top = totals.topTurns.slice(0, topN);
  if (top.length === 0) {
    lines.push(' (nenhum prompt registrado ainda)');
  } else {
    top.forEach((turn, i) => {
      lines.push(` ${i + 1}. ${formatTokenCount(turn.usage.total)}  "${turn.textPreview}"`);
    });
  }
  lines.push('');
  lines.push('Por skill/agente:');
  if (totals.bySkill.length === 0) {
    lines.push(' (sem dados)');
  } else {
    totals.bySkill.forEach(({ skill, total }) => {
      lines.push(` ${skill.padEnd(12)} ${formatTokenCount(total)}`);
    });
  }
  if (warnings > 0) {
    lines.push('');
    lines.push(`(${warnings} linha(s) de log ignorada(s) por estarem corrompidas)`);
  }
  return lines.join('\n');
}
```

Create `scripts/snapshot.mjs`:

```js
#!/usr/bin/env node
import path from 'node:path';
import {
  encodeProjectDir,
  findActiveSession,
  parseSession,
  groupIntoTurns,
  computeTotals,
  formatSnapshot,
} from './lib.mjs';

function main() {
  const cwd = process.argv[2] ?? process.cwd();
  const home = process.env.HOME ?? '';
  const projectDir = path.join(home, '.claude', 'projects', encodeProjectDir(cwd));
  const sessionFile = findActiveSession(projectDir);
  if (!sessionFile) {
    console.log(`token-monitor: nenhuma sessão encontrada em ${projectDir}`);
    console.log('Rode este comando de dentro de um projeto com uma sessão ativa do Claude Code.');
    return;
  }
  const { events, warnings } = parseSession(sessionFile);
  const turns = groupIntoTurns(events);
  const totals = computeTotals(events, turns);
  const sessionId = path.basename(sessionFile, '.jsonl');
  console.log(formatSnapshot(totals, { sessionId, projectLabel: path.basename(cwd), warnings }));
}

main();
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/snapshot.test.mjs`
Expected: PASS (2 tests)

- [ ] **Step 5: Commit**

```bash
git add scripts/lib.mjs scripts/snapshot.mjs tests/snapshot.test.mjs
git commit -m "$(cat <<'EOF'
feat: add snapshot.mjs one-shot token report CLI

Co-Authored-By: Claude <noreply@anthropic.com>
AI-Assisted: yes
AI-Tool: claude-code
EOF
)"
```

---

### Task 7: `scripts/statusline.mjs` — native Claude Code statusline integration

**Files:**
- Create: `scripts/statusline.mjs`
- Modify: `scripts/lib.mjs` (add `formatStatusLine`)
- Test: `tests/statusline.test.mjs`

**Interfaces:**
- Consumes: `parseSession`, `groupIntoTurns`, `computeTotals`, `formatTokenCount` (Tasks 3–5). Also consumes Claude Code's own statusline stdin JSON shape: `{ transcript_path: string, context_window?: { used_percentage: number | null } }`.
- Produces: `formatStatusLine({ totals: Totals, contextWindowOverride: number | null }): string`; `scripts/statusline.mjs` CLI (reads JSON from stdin, prints one line).

- [ ] **Step 1: Write the failing test**

```js
// tests/statusline.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { formatStatusLine } from '../scripts/lib.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURE = path.join(__dirname, 'fixtures', 'sample-session.jsonl');

test('formatStatusLine prefers the stdin-provided context percentage over the computed one', () => {
  const totals = {
    totals: { total: 30753, input_tokens: 143, output_tokens: 1310, cache_creation_input_tokens: 10000, cache_read_input_tokens: 19300 },
    contextWindow: { totalInputTokens: 208, contextWindowSize: 200000, usedPercentage: 0.1 },
    topTurns: [{ id: 'u1', ts: '', textPreview: 'x', bySkill: {}, usage: { total: 30525, input_tokens: 0, output_tokens: 0, cache_creation_input_tokens: 0, cache_read_input_tokens: 0 } }],
    bySkill: [],
  };
  assert.equal(formatStatusLine({ totals, contextWindowOverride: 42 }), '🔥 30.8k tok · ctx 42% · top 30.5k');
});

test('statusline.mjs prints a compact line for a valid transcript_path on stdin', () => {
  const stdinPayload = JSON.stringify({
    transcript_path: FIXTURE,
    context_window: { used_percentage: 12.5 },
  });
  const output = execFileSync('node', [path.join(__dirname, '..', 'scripts', 'statusline.mjs')], {
    input: stdinPayload,
    encoding: 'utf8',
  });
  assert.equal(output.trim(), '🔥 30.8k tok · ctx 12.5% · top 30.5k');
});

test('statusline.mjs falls back to a neutral message on invalid stdin', () => {
  const output = execFileSync('node', [path.join(__dirname, '..', 'scripts', 'statusline.mjs')], {
    input: 'not json',
    encoding: 'utf8',
  });
  assert.equal(output.trim(), 'token-monitor: sem sessão');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/statusline.test.mjs`
Expected: FAIL — `formatStatusLine` not exported, `scripts/statusline.mjs` does not exist.

- [ ] **Step 3: Write minimal implementation**

Append to `scripts/lib.mjs`:

```js
export function formatStatusLine({ totals, contextWindowOverride }) {
  const top = totals.topTurns[0];
  const parts = [`🔥 ${formatTokenCount(totals.totals.total)} tok`];
  const pct = contextWindowOverride ?? totals.contextWindow?.usedPercentage ?? null;
  if (pct !== null) parts.push(`ctx ${pct}%`);
  if (top) parts.push(`top ${formatTokenCount(top.usage.total)}`);
  return parts.join(' · ');
}
```

Create `scripts/statusline.mjs`:

```js
#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { parseSession, groupIntoTurns, computeTotals, formatStatusLine } from './lib.mjs';

function main() {
  let input;
  try {
    input = JSON.parse(readFileSync(0, 'utf8'));
  } catch {
    console.log('token-monitor: sem sessão');
    return;
  }
  const transcriptPath = input?.transcript_path;
  if (!transcriptPath) {
    console.log('token-monitor: sem sessão');
    return;
  }
  let totals;
  try {
    const { events } = parseSession(transcriptPath);
    const turns = groupIntoTurns(events);
    totals = computeTotals(events, turns);
  } catch {
    console.log('token-monitor: sem sessão');
    return;
  }
  const contextWindowOverride = input?.context_window?.used_percentage ?? null;
  console.log(formatStatusLine({ totals, contextWindowOverride }));
}

main();
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/statusline.test.mjs`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add scripts/lib.mjs scripts/statusline.mjs tests/statusline.test.mjs
git commit -m "$(cat <<'EOF'
feat: add statusline.mjs for native Claude Code statusLine

Co-Authored-By: Claude <noreply@anthropic.com>
AI-Assisted: yes
AI-Tool: claude-code
EOF
)"
```

---

### Task 8: `SKILL.md` + `commands/tokens.md`

**Files:**
- Create: `SKILL.md`
- Create: `commands/tokens.md`
- Test: `tests/docs.test.mjs`

**Interfaces:**
- Consumes: nothing (static documentation, referencing `scripts/snapshot.mjs` and `scripts/watch.mjs` by their installed path).
- Produces: the two files Claude Code reads directly (`SKILL.md` at the skill root, `commands/tokens.md` as the source template `install.sh` copies to `~/.claude/commands/tokens.md` in Task 9).

- [ ] **Step 1: Write the failing test**

```js
// tests/docs.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');

test('SKILL.md has frontmatter with name and description', () => {
  const content = readFileSync(path.join(root, 'SKILL.md'), 'utf8');
  assert.match(content, /^---\nname: token-monitor\ndescription: .+\n---/s);
  assert.ok(content.includes('scripts/snapshot.mjs'));
});

test('commands/tokens.md invokes snapshot.mjs', () => {
  const content = readFileSync(path.join(root, 'commands', 'tokens.md'), 'utf8');
  assert.ok(content.includes('scripts/snapshot.mjs'));
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/docs.test.mjs`
Expected: FAIL — `SKILL.md` / `commands/tokens.md` do not exist.

- [ ] **Step 3: Create `SKILL.md`**

```markdown
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

Se instalado (ver `install.sh`), `scripts/statusline.mjs` fica registrado em `~/.claude/settings.json` (`statusLine`) e mostra uma linha compacta sempre visível no terminal do Claude Code, atualizando sozinha.
```

- [ ] **Step 4: Create `commands/tokens.md`**

```markdown
---
description: Mostra snapshot de consumo de token da sessão atual (total, ranking de prompt, quebra por skill, % context window).
---

Rode:
```bash
node ~/.claude/skills/token-monitor/scripts/snapshot.mjs "$(pwd)"
```
Mostre a saída do comando pro usuário tal como veio (já formatada), sem resumir ou reformatar.
```

- [ ] **Step 5: Run test to verify it passes**

Run: `node --test tests/docs.test.mjs`
Expected: PASS (2 tests)

- [ ] **Step 6: Commit**

```bash
git add SKILL.md commands/tokens.md tests/docs.test.mjs
git commit -m "$(cat <<'EOF'
docs: add SKILL.md and /tokens command template

Co-Authored-By: Claude <noreply@anthropic.com>
AI-Assisted: yes
AI-Tool: claude-code
EOF
)"
```

---

### Task 9: `install.sh`

**Files:**
- Create: `install.sh`
- Test: `tests/install.test.mjs`

**Interfaces:**
- Consumes: `commands/tokens.md` (Task 8), repo root as the skill source directory.
- Produces: a script that symlinks the repo into `$TOKEN_MONITOR_HOME/skills/token-monitor` (default `$HOME/.claude`), copies `commands/tokens.md` into `$TOKEN_MONITOR_HOME/commands/tokens.md`, runs `npm install` if `node_modules` is missing, and prints the manual `statusLine` JSON snippet.

- [ ] **Step 1: Write the failing test**

```js
// tests/install.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, existsSync, lstatSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');

test('install.sh symlinks the skill and copies the /tokens command into a fake CLAUDE_HOME', () => {
  const fakeHome = mkdtempSync(path.join(tmpdir(), 'token-monitor-claude-home-'));
  const output = execFileSync('bash', [path.join(root, 'install.sh')], {
    env: { ...process.env, TOKEN_MONITOR_HOME: fakeHome },
    encoding: 'utf8',
  });

  const skillLink = path.join(fakeHome, 'skills', 'token-monitor');
  const commandFile = path.join(fakeHome, 'commands', 'tokens.md');
  assert.equal(lstatSync(skillLink).isSymbolicLink(), true);
  assert.equal(existsSync(commandFile), true);
  assert.ok(output.includes('statusLine'));
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/install.test.mjs`
Expected: FAIL — `install.sh` does not exist.

- [ ] **Step 3: Write minimal implementation**

Create `install.sh`:

```bash
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
```

- [ ] **Step 4: Make it executable and run test to verify it passes**

Run: `chmod +x install.sh && node --test tests/install.test.mjs`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add install.sh tests/install.test.mjs
git commit -m "$(cat <<'EOF'
feat: add install.sh to symlink the skill and wire the /tokens command

Co-Authored-By: Claude <noreply@anthropic.com>
AI-Assisted: yes
AI-Tool: claude-code
EOF
)"
```

---

### Task 10: `scripts/watch.mjs` — live Ink dashboard

**Files:**
- Create: `scripts/watch.mjs`
- Modify: `scripts/lib.mjs` (add `buildViewModel`)
- Test: `tests/watch.viewmodel.test.mjs`

**Interfaces:**
- Consumes: `encodeProjectDir`, `findActiveSession`, `parseSession`, `groupIntoTurns`, `computeTotals`, `formatTokenCount` (Tasks 2–5).
- Produces: `buildViewModel(totals: Totals, meta: { sessionId: string, projectLabel: string, warnings?: number }): ViewModel`, where `ViewModel = { header, totalsLine, contextLine, topRows: Array<{rank, tokens, preview}>, skillRows: Array<{skill, tokens}>, warningsLine: string|null }`; `scripts/watch.mjs` CLI (Ink TUI).

- [ ] **Step 1: Write the failing test (pure view model)**

```js
// tests/watch.viewmodel.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseSession, groupIntoTurns, computeTotals, buildViewModel } from '../scripts/lib.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURE = path.join(__dirname, 'fixtures', 'sample-session.jsonl');

test('buildViewModel produces rows ready for rendering', () => {
  const { events, warnings } = parseSession(FIXTURE);
  const turns = groupIntoTurns(events);
  const totals = computeTotals(events, turns);

  const model = buildViewModel(totals, { sessionId: 'session-fixture', projectLabel: 'meu-projeto', warnings });

  assert.equal(model.header, 'token-monitor — meu-projeto (session-fixture)');
  assert.ok(model.totalsLine.includes('30.8k tok'));
  assert.equal(model.contextLine, 'Context window: 0.1% (208 / 200.0k)');
  assert.deepEqual(model.topRows[0], { rank: 1, tokens: '30.5k', preview: 'Corrige o bug do cupom' });
  assert.deepEqual(model.skillRows, [
    { skill: 'main', tokens: '22.3k' },
    { skill: 'Explore', tokens: '8.4k' },
  ]);
  assert.equal(model.warningsLine, '1 linha(s) ignorada(s) (log corrompido)');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/watch.viewmodel.test.mjs`
Expected: FAIL — `buildViewModel` not exported.

- [ ] **Step 3: Write minimal implementation**

Append to `scripts/lib.mjs`:

```js
export function buildViewModel(totals, meta) {
  const { sessionId, projectLabel, warnings = 0 } = meta;
  return {
    header: `token-monitor — ${projectLabel} (${sessionId})`,
    totalsLine: `Total: ${formatTokenCount(totals.totals.total)} tok  (in ${formatTokenCount(
      totals.totals.input_tokens
    )} / out ${formatTokenCount(totals.totals.output_tokens)} / cache-w ${formatTokenCount(
      totals.totals.cache_creation_input_tokens
    )} / cache-r ${formatTokenCount(totals.totals.cache_read_input_tokens)})`,
    contextLine: totals.contextWindow
      ? `Context window: ${totals.contextWindow.usedPercentage}% (${formatTokenCount(
          totals.contextWindow.totalInputTokens
        )} / ${formatTokenCount(totals.contextWindow.contextWindowSize)})`
      : 'Context window: sem dados ainda',
    topRows: totals.topTurns.slice(0, 8).map((turn, i) => ({
      rank: i + 1,
      tokens: formatTokenCount(turn.usage.total),
      preview: turn.textPreview,
    })),
    skillRows: totals.bySkill.map(({ skill, total }) => ({ skill, tokens: formatTokenCount(total) })),
    warningsLine: warnings > 0 ? `${warnings} linha(s) ignorada(s) (log corrompido)` : null,
  };
}
```

Create `scripts/watch.mjs`:

```js
#!/usr/bin/env node
import React, { useState, useEffect } from 'react';
import { watch } from 'node:fs';
import path from 'node:path';
import {
  encodeProjectDir,
  findActiveSession,
  parseSession,
  groupIntoTurns,
  computeTotals,
  buildViewModel,
} from './lib.mjs';

const h = React.createElement;

function loadViewModel(cwd) {
  const home = process.env.HOME ?? '';
  const projectDir = path.join(home, '.claude', 'projects', encodeProjectDir(cwd));
  const sessionFile = findActiveSession(projectDir);
  if (!sessionFile) return { error: `sem sessão ativa em ${projectDir}`, sessionFile: null };
  const { events, warnings } = parseSession(sessionFile);
  const turns = groupIntoTurns(events);
  const totals = computeTotals(events, turns);
  const sessionId = path.basename(sessionFile, '.jsonl');
  return {
    model: buildViewModel(totals, { sessionId, projectLabel: path.basename(cwd), warnings }),
    sessionFile,
  };
}

function createApp({ Box, Text }) {
  return function App({ cwd }) {
    const [state, setState] = useState(() => loadViewModel(cwd));

    useEffect(() => {
      const reload = () => setState(loadViewModel(cwd));
      const interval = setInterval(reload, 2000);
      const watcher = state.sessionFile ? watch(state.sessionFile, { persistent: false }, reload) : null;
      return () => {
        clearInterval(interval);
        watcher?.close();
      };
    }, [cwd, state.sessionFile]);

    if (state.error) return h(Text, { color: 'yellow' }, `token-monitor: ${state.error}`);
    const { model } = state;
    return h(
      Box,
      { flexDirection: 'column', paddingX: 1 },
      h(Text, { bold: true }, model.header),
      h(Text, null, model.totalsLine),
      h(Text, null, model.contextLine),
      h(Text, null, ' '),
      h(Text, { bold: true }, 'Top prompts:'),
      ...model.topRows.map((row) => h(Text, { key: String(row.rank) }, ` ${row.rank}. ${row.tokens}  "${row.preview}"`)),
      h(Text, null, ' '),
      h(Text, { bold: true }, 'Por skill/agente:'),
      ...model.skillRows.map((row) => h(Text, { key: row.skill }, ` ${row.skill.padEnd(12)} ${row.tokens}`)),
      model.warningsLine ? h(Text, { color: 'red' }, model.warningsLine) : null
    );
  };
}

async function main() {
  let ink;
  try {
    ink = await import('ink');
  } catch {
    console.error('token-monitor: dependências não instaladas. Rode `npm install` na pasta da skill (~/.claude/skills/token-monitor).');
    process.exitCode = 1;
    return;
  }
  const App = createApp(ink);
  const cwd = process.argv[2] ?? process.cwd();
  ink.render(h(App, { cwd }));
}

main();
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/watch.viewmodel.test.mjs`
Expected: PASS

- [ ] **Step 5: Manual validation (Ink rendering is not unit-tested — no `ink-testing-library` dependency per the "ink + react only" constraint)**

Run: `node scripts/watch.mjs` from inside a project directory that has an active Claude Code session (e.g. `~/Documents/React-Native_Harness`).
Expected: a redrawn terminal screen showing header/totals/context/top-prompts/skill rows; sending a new message in that Claude Code session updates the dashboard within ~2 seconds; `Ctrl+C` exits cleanly.

- [ ] **Step 6: Run the full test suite**

Run: `npm test`
Expected: all tests across Tasks 2–10 PASS.

- [ ] **Step 7: Commit**

```bash
git add scripts/lib.mjs scripts/watch.mjs tests/watch.viewmodel.test.mjs
git commit -m "$(cat <<'EOF'
feat: add watch.mjs live Ink dashboard

Co-Authored-By: Claude <noreply@anthropic.com>
AI-Assisted: yes
AI-Tool: claude-code
EOF
)"
```

---

### Task 11: Real install and end-to-end validation

**Files:** none created — this task installs into the user's real `~/.claude` and validates against a real session.

**Interfaces:** none new — exercises Tasks 1–10 as a whole.

This task touches global state outside the repo (`~/.claude/skills/token-monitor`, `~/.claude/commands/tokens.md`, `~/.claude/settings.json`). **Ask the user for explicit confirmation before running Steps 1 and 3** — do not run them automatically as part of a batch.

- [ ] **Step 1: Confirm with the user, then run the real install**

Ask: "Posso rodar `install.sh` de verdade contra `~/.claude` (symlink em `~/.claude/skills/token-monitor` e cópia de `~/.claude/commands/tokens.md`)?" Wait for a yes.

Run: `bash install.sh` (no `TOKEN_MONITOR_HOME` override — uses the real `$HOME/.claude`)
Expected: prints `✓ skill linkada em /Users/<user>/.claude/skills/token-monitor`, `✓ comando /tokens copiado...`, `✓ dependências prontas`, and the `statusLine` JSON snippet.

- [ ] **Step 2: Validate `snapshot.mjs` against a real session**

Run, from inside a project directory with prior Claude Code activity (e.g. `~/Documents/React-Native_Harness`):
```bash
node ~/.claude/skills/token-monitor/scripts/snapshot.mjs
```
Expected: real totals print. Cross-check the "Total" line against a manual sum, e.g.:
```bash
LATEST=$(ls -t ~/.claude/projects/-Users-*-Documents-React-Native-Harness/*.jsonl | head -1)
jq -s '[.[] | .message.usage | select(. != null) | (.input_tokens + .output_tokens + .cache_creation_input_tokens + .cache_read_input_tokens)] | add' "$LATEST"
```
Expected: the `jq` sum matches the snapshot's "Total" line (within rounding from `formatTokenCount`).

- [ ] **Step 3: Confirm with the user, then wire the statusline**

Ask: "Posso adicionar o bloco `statusLine` no seu `~/.claude/settings.json` de verdade?" Wait for a yes. Apply the change following the `update-config` skill rather than a raw edit.

After applying, open a new Claude Code terminal session and confirm the compact status line (`🔥 ... tok · ctx ...% · top ...`) appears at the bottom and updates after sending a message.

- [ ] **Step 4: Validate `watch.mjs` live update**

Run `node ~/.claude/skills/token-monitor/scripts/watch.mjs` in one terminal tab, send a message in the corresponding Claude Code session in another tab, and confirm the dashboard updates within ~2 seconds without restarting `watch.mjs`.

- [ ] **Step 5: Update the Obsidian project note**

In `~/Documents/ObsidianVault/Projetos/Claude-Token-Monitor/Claude-Token-Monitor.md`, check off the completed items under "O que estamos fazendo" and add a `Histórico` entry noting the implementation is done and validated end to end.
