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
