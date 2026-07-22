import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, utimesSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { encodeProjectDir, findActiveSession, listSessionFiles } from '../scripts/lib.mjs';

test('encodeProjectDir replaces slashes, dots and underscores with dashes', () => {
  const result = encodeProjectDir('/Users/mateus.castro/Documents/React-Native_Harness');
  assert.equal(result, '-Users-mateus-castro-Documents-React-Native-Harness');
});

test('listSessionFiles returns .jsonl files sorted by mtime descending', () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'token-monitor-'));
  const older = path.join(dir, 'session-a.jsonl');
  const newer = path.join(dir, 'session-b.jsonl');
  writeFileSync(older, '{}\n');
  writeFileSync(newer, '{}\n');
  const past = new Date('2026-01-01T00:00:00Z');
  const recent = new Date('2026-06-01T00:00:00Z');
  utimesSync(older, past, past);
  utimesSync(newer, recent, recent);
  assert.deepEqual(listSessionFiles(dir), [newer, older]);
});

test('findActiveSession returns the most recently modified session, null when none exist', () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'token-monitor-'));
  assert.equal(findActiveSession(dir), null);
  const file = path.join(dir, 'session-a.jsonl');
  writeFileSync(file, '{}\n');
  assert.equal(findActiveSession(dir), file);
});

test('listSessionFiles and findActiveSession handle nonexistent project directory gracefully', () => {
  const baseDir = mkdtempSync(path.join(tmpdir(), 'token-monitor-'));
  const nonexistentDir = path.join(baseDir, 'does-not-exist');
  // Assert the directory truly does not exist
  assert.equal(existsSync(nonexistentDir), false);
  // listSessionFiles should return empty array without throwing
  assert.deepEqual(listSessionFiles(nonexistentDir), []);
  // findActiveSession should return null without throwing
  assert.equal(findActiveSession(nonexistentDir), null);
});
