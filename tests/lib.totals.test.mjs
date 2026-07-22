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
