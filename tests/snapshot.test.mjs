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
