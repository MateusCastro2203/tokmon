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
