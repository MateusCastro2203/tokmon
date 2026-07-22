import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, copyFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { encodeProjectDir } from '../scripts/lib.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BIN = path.join(__dirname, '..', 'bin', 'tokmon.mjs');
const FIXTURE = path.join(__dirname, 'fixtures', 'sample-session.jsonl');

test('tokmon help prints usage for all subcommands', () => {
  const output = execFileSync('node', [BIN, 'help'], { encoding: 'utf8' });
  assert.ok(output.includes('tokmon snapshot'));
  assert.ok(output.includes('tokmon watch'));
  assert.ok(output.includes('tokmon statusline'));
});

test('tokmon with no arguments prints usage instead of erroring', () => {
  const output = execFileSync('node', [BIN], { encoding: 'utf8' });
  assert.ok(output.includes('tokmon snapshot'));
});

test('tokmon with an unknown subcommand exits non-zero and prints usage', () => {
  assert.throws(() => execFileSync('node', [BIN, 'bogus'], { encoding: 'utf8' }));
});

test('tokmon snapshot dispatches to the same output as scripts/snapshot.mjs', () => {
  const fakeHome = mkdtempSync(path.join(tmpdir(), 'token-monitor-home-'));
  const fakeCwd = '/Users/fixture/project';
  const projectDir = path.join(fakeHome, '.claude', 'projects', encodeProjectDir(fakeCwd));
  mkdirSync(projectDir, { recursive: true });
  copyFileSync(FIXTURE, path.join(projectDir, 'session-fixture.jsonl'));

  const output = execFileSync('node', [BIN, 'snapshot', fakeCwd], {
    env: { ...process.env, HOME: fakeHome },
    encoding: 'utf8',
  });
  assert.ok(output.includes('Total: 30.8k tok'));
  assert.ok(output.includes('Corrige o bug do cupom'));
});

test('tokmon statusline dispatches to the same output as scripts/statusline.mjs', () => {
  const stdinPayload = JSON.stringify({ transcript_path: FIXTURE, context_window: { used_percentage: 12.5 } });
  const output = execFileSync('node', [BIN, 'statusline'], { input: stdinPayload, encoding: 'utf8' });
  assert.equal(output.trim(), '🔥 sessão: 30.8k tok · contexto: 12.5% usado · prompt mais caro: 30.5k tok');
});
