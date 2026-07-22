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

test('resolveModelLimit handles case-insensitive matching on both model id and override keys', () => {
  const events = [
    {
      role: 'assistant',
      isSidechain: false,
      model: 'claude-opus-4-1',
      usage: {
        input_tokens: 100,
        output_tokens: 50,
        cache_creation_input_tokens: 0,
        cache_read_input_tokens: 0,
      },
    },
  ];
  const turns = [
    {
      id: 'test-turn',
      ts: new Date().toISOString(),
      textPreview: 'test',
      usage: { input_tokens: 100, output_tokens: 50, cache_creation_input_tokens: 0, cache_read_input_tokens: 0, total: 150 },
      bySkill: { main: 150 },
    },
  ];
  const totals = computeTotals(events, turns, {
    modelLimits: { Opus: 500000 },
  });

  assert.equal(totals.contextWindow.contextWindowSize, 500000);
  assert.equal(totals.contextWindow.totalInputTokens, 100);
});
