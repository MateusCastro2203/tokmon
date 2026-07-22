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
