import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DRAGON_SPRITE_ROWS, DRAGON_PALETTE, hpBarSegments } from '../scripts/dragon-sprite.mjs';

test('DRAGON_SPRITE_ROWS is a 16x16 grid using only known palette characters', () => {
  assert.equal(DRAGON_SPRITE_ROWS.length, 16);
  const validChars = new Set(['.', ...Object.keys(DRAGON_PALETTE)]);
  for (const row of DRAGON_SPRITE_ROWS) {
    assert.equal(row.length, 16);
    for (const char of row) {
      assert.ok(validChars.has(char), `unexpected sprite character: "${char}"`);
    }
  }
});

test('every DRAGON_PALETTE entry is a 6-digit hex color', () => {
  for (const [key, value] of Object.entries(DRAGON_PALETTE)) {
    assert.match(value, /^#[0-9a-f]{6}$/i, `palette["${key}"] = ${value}`);
  }
});

test('hpBarSegments fills proportionally and clamps to the 0-100 range', () => {
  assert.deepEqual(hpBarSegments(0), { filled: 0, empty: 10, totalSegments: 10 });
  assert.deepEqual(hpBarSegments(50), { filled: 5, empty: 5, totalSegments: 10 });
  assert.deepEqual(hpBarSegments(100), { filled: 10, empty: 0, totalSegments: 10 });
  assert.deepEqual(hpBarSegments(70.1), { filled: 7, empty: 3, totalSegments: 10 });
  assert.deepEqual(hpBarSegments(-5), { filled: 0, empty: 10, totalSegments: 10 });
  assert.deepEqual(hpBarSegments(150), { filled: 10, empty: 0, totalSegments: 10 });
  assert.deepEqual(hpBarSegments(null), { filled: 0, empty: 10, totalSegments: 10 });
});

test('hpBarSegments supports a custom segment count', () => {
  assert.deepEqual(hpBarSegments(50, 20), { filled: 10, empty: 10, totalSegments: 20 });
});
