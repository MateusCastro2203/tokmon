import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseSession, groupIntoTurns, computeTotals, buildViewModel, truncatePreview } from '../scripts/lib.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURE = path.join(__dirname, 'fixtures', 'sample-session.jsonl');

test('buildViewModel produces rows ready for rendering', () => {
  const { events, warnings } = parseSession(FIXTURE);
  const turns = groupIntoTurns(events);
  const totals = computeTotals(events, turns);

  const model = buildViewModel(totals, { sessionId: 'session-fixture', projectLabel: 'meu-projeto', warnings });

  assert.equal(model.header, 'token-monitor — meu-projeto (session-fixture)');
  assert.equal(model.totalTokens, '30.8k');
  assert.equal(model.breakdown, 'in 143 · out 1.3k · cache-w 10.0k · cache-r 19.3k');
  assert.equal(model.contextPercentage, 0.1);
  assert.equal(model.contextSeverity, 'ok');
  assert.equal(model.contextDetail, '208 / 200.0k');
  assert.deepEqual(model.topRows[0], { rank: 1, tokens: '30.5k', preview: 'Corrige o bug do cupom' });
  assert.deepEqual(model.skillRows, [
    { skill: 'main', tokens: '22.3k' },
    { skill: 'Explore', tokens: '8.4k' },
  ]);
  assert.equal(model.warningsLine, '1 linha(s) ignorada(s) (log corrompido)');
});

test('buildViewModel classifies context severity by percentage thresholds', () => {
  const baseTurns = [
    { id: 't1', ts: '', textPreview: 'x', bySkill: { main: 1 }, usage: { input_tokens: 1, output_tokens: 0, cache_creation_input_tokens: 0, cache_read_input_tokens: 0, total: 1 } },
  ];
  const makeTotals = (usedPercentage) => ({
    totals: { input_tokens: 1, output_tokens: 0, cache_creation_input_tokens: 0, cache_read_input_tokens: 0, total: 1 },
    bySkill: [{ skill: 'main', total: 1 }],
    topTurns: baseTurns,
    contextWindow: { totalInputTokens: 1, contextWindowSize: 200000, usedPercentage },
  });

  assert.equal(buildViewModel(makeTotals(10), { sessionId: 's', projectLabel: 'p' }).contextSeverity, 'ok');
  assert.equal(buildViewModel(makeTotals(60), { sessionId: 's', projectLabel: 'p' }).contextSeverity, 'warn');
  assert.equal(buildViewModel(makeTotals(90), { sessionId: 's', projectLabel: 'p' }).contextSeverity, 'danger');
  assert.equal(buildViewModel({ ...makeTotals(0), contextWindow: null }, { sessionId: 's', projectLabel: 'p' }).contextSeverity, null);
});

test('truncatePreview cuts at the last whole word instead of mid-word', () => {
  assert.equal(truncatePreview('Base directory for this skill', 20), 'Base directory for…');
  assert.equal(truncatePreview('short text'), 'short text');
});
