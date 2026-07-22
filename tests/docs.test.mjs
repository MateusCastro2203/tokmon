// tests/docs.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');

test('SKILL.md has frontmatter with name and description', () => {
  const content = readFileSync(path.join(root, 'SKILL.md'), 'utf8');
  assert.match(content, /^---\nname: token-monitor\ndescription: .+\n---/s);
  assert.ok(content.includes('scripts/snapshot.mjs'));
});

test('commands/tokens.md invokes snapshot.mjs', () => {
  const content = readFileSync(path.join(root, 'commands', 'tokens.md'), 'utf8');
  assert.ok(content.includes('scripts/snapshot.mjs'));
});
