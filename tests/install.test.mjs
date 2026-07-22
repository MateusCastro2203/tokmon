import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, existsSync, lstatSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');

test('install.sh symlinks the skill and copies the /tokens command into a fake CLAUDE_HOME', () => {
  const fakeHome = mkdtempSync(path.join(tmpdir(), 'token-monitor-claude-home-'));
  const output = execFileSync('bash', [path.join(root, 'install.sh')], {
    env: { ...process.env, TOKEN_MONITOR_HOME: fakeHome },
    encoding: 'utf8',
  });

  const skillLink = path.join(fakeHome, 'skills', 'token-monitor');
  const commandFile = path.join(fakeHome, 'commands', 'tokens.md');
  assert.equal(lstatSync(skillLink).isSymbolicLink(), true);
  assert.equal(existsSync(commandFile), true);
  assert.ok(output.includes('statusLine'));
});
