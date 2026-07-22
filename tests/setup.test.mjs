import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, lstatSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { mergeStatusLine } from '../scripts/setup.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const BIN = path.join(root, 'bin', 'tokmon.mjs');

const STATUS_LINE = { type: 'command', command: 'node /wherever/scripts/statusline.mjs' };

test('mergeStatusLine adds statusLine when none exists', () => {
  const result = mergeStatusLine({ model: 'sonnet' }, STATUS_LINE);
  assert.equal(result.changed, true);
  assert.equal(result.skippedReason, null);
  assert.deepEqual(result.settings, { model: 'sonnet', statusLine: STATUS_LINE });
});

test('mergeStatusLine is a no-op when the same statusLine is already set', () => {
  const existing = { model: 'sonnet', statusLine: { ...STATUS_LINE } };
  const result = mergeStatusLine(existing, STATUS_LINE);
  assert.equal(result.changed, false);
  assert.equal(result.skippedReason, null);
  assert.deepEqual(result.settings, existing);
});

test('mergeStatusLine refuses to overwrite a different existing statusLine without force', () => {
  const existing = { statusLine: { type: 'command', command: 'node something-else.mjs' } };
  const result = mergeStatusLine(existing, STATUS_LINE);
  assert.equal(result.changed, false);
  assert.ok(result.skippedReason.includes('--force'));
  assert.deepEqual(result.settings, existing);
});

test('mergeStatusLine overwrites a different existing statusLine when force is set', () => {
  const existing = { statusLine: { type: 'command', command: 'node something-else.mjs' } };
  const result = mergeStatusLine(existing, STATUS_LINE, { force: true });
  assert.equal(result.changed, true);
  assert.deepEqual(result.settings.statusLine, STATUS_LINE);
});

test('tokmon setup symlinks the skill, copies /tokens, and writes statusLine while preserving existing settings', () => {
  const fakeHome = mkdtempSync(path.join(tmpdir(), 'token-monitor-setup-'));
  mkdirSync(fakeHome, { recursive: true });
  writeFileSync(path.join(fakeHome, 'settings.json'), JSON.stringify({ model: 'sonnet', existingKey: true }));

  const output = execFileSync('node', [BIN, 'setup'], {
    env: { ...process.env, TOKEN_MONITOR_HOME: fakeHome },
    encoding: 'utf8',
  });

  const skillLink = path.join(fakeHome, 'skills', 'token-monitor');
  const commandFile = path.join(fakeHome, 'commands', 'tokens.md');
  const settingsFile = path.join(fakeHome, 'settings.json');

  assert.equal(lstatSync(skillLink).isSymbolicLink(), true);
  assert.equal(existsSync(commandFile), true);
  assert.ok(output.includes('statusLine configurada'));

  const settings = JSON.parse(readFileSync(settingsFile, 'utf8'));
  assert.equal(settings.model, 'sonnet');
  assert.equal(settings.existingKey, true);
  assert.equal(settings.statusLine.type, 'command');
  assert.ok(settings.statusLine.command.includes('statusline.mjs'));
});

test('tokmon setup run twice is idempotent and does not duplicate or break settings.json', () => {
  const fakeHome = mkdtempSync(path.join(tmpdir(), 'token-monitor-setup-'));
  execFileSync('node', [BIN, 'setup'], { env: { ...process.env, TOKEN_MONITOR_HOME: fakeHome }, encoding: 'utf8' });
  const secondOutput = execFileSync('node', [BIN, 'setup'], {
    env: { ...process.env, TOKEN_MONITOR_HOME: fakeHome },
    encoding: 'utf8',
  });
  assert.ok(secondOutput.includes('já configurada corretamente'));
});
