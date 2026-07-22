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
