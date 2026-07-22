import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURE = path.join(__dirname, 'fixtures', 'sample-session.jsonl');

// install.sh symlinks this whole repo into ~/.claude/skills/token-monitor, so every
// script MUST still run correctly when invoked through a symlinked path — not just
// when run directly from the repo (a real regression shipped once because every
// other test only exercised the direct path).

test('statusline.mjs still runs its CLI body when invoked through a symlink', () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'token-monitor-symlink-'));
  const link = path.join(dir, 'statusline-link.mjs');
  symlinkSync(path.join(__dirname, '..', 'scripts', 'statusline.mjs'), link);

  const stdinPayload = JSON.stringify({ transcript_path: FIXTURE, context_window: { used_percentage: 12.5 } });
  const output = execFileSync('node', [link], { input: stdinPayload, encoding: 'utf8' });
  assert.equal(output.trim(), '🔥 sessão: 30.8k tok · contexto: 12.5% usado · prompt mais caro: 30.5k tok');
});

test('snapshot.mjs still runs its CLI body when invoked through a symlink', () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'token-monitor-symlink-'));
  const link = path.join(dir, 'snapshot-link.mjs');
  symlinkSync(path.join(__dirname, '..', 'scripts', 'snapshot.mjs'), link);

  const output = execFileSync('node', [link], { encoding: 'utf8' });
  assert.ok(output.includes('nenhuma sessão encontrada'));
});
