#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, writeFileSync, symlinkSync, lstatSync, copyFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { isMainModule } from './lib.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PACKAGE_ROOT = path.join(__dirname, '..');

export function mergeStatusLine(existingSettings, statusLineConfig, opts = {}) {
  const { force = false } = opts;
  const current = existingSettings.statusLine;
  if (current) {
    const same = JSON.stringify(current) === JSON.stringify(statusLineConfig);
    if (same) return { settings: existingSettings, changed: false, skippedReason: null };
    if (!force) {
      return {
        settings: existingSettings,
        changed: false,
        skippedReason: 'statusLine já configurada com outro comando — rode `tokmon setup --force` pra sobrescrever',
      };
    }
  }
  return { settings: { ...existingSettings, statusLine: statusLineConfig }, changed: true, skippedReason: null };
}

export function runSetup(argv = process.argv.slice(2)) {
  const force = argv.includes('--force');
  const claudeHome = process.env.TOKEN_MONITOR_HOME ?? path.join(process.env.HOME ?? '', '.claude');
  const skillLink = path.join(claudeHome, 'skills', 'token-monitor');
  const commandFile = path.join(claudeHome, 'commands', 'tokens.md');
  const settingsFile = path.join(claudeHome, 'settings.json');

  mkdirSync(path.join(claudeHome, 'skills'), { recursive: true });
  mkdirSync(path.join(claudeHome, 'commands'), { recursive: true });

  if (existsSync(skillLink)) {
    if (!lstatSync(skillLink).isSymbolicLink()) {
      console.error(`erro: ${skillLink} existe e não é um symlink — remova manualmente antes de rodar o setup.`);
      process.exitCode = 1;
      return;
    }
  } else {
    symlinkSync(PACKAGE_ROOT, skillLink, 'dir');
  }
  console.log(`✓ skill linkada em ${skillLink}`);

  copyFileSync(path.join(PACKAGE_ROOT, 'commands', 'tokens.md'), commandFile);
  console.log(`✓ comando /tokens copiado pra ${commandFile}`);

  let settings = {};
  if (existsSync(settingsFile)) {
    try {
      settings = JSON.parse(readFileSync(settingsFile, 'utf8'));
    } catch {
      console.error(`erro: ${settingsFile} não é um JSON válido — corrija manualmente antes de rodar o setup.`);
      process.exitCode = 1;
      return;
    }
  }

  const statusLineConfig = {
    type: 'command',
    command: `node ${path.join(skillLink, 'scripts', 'statusline.mjs')}`,
  };
  const { settings: merged, changed, skippedReason } = mergeStatusLine(settings, statusLineConfig, { force });
  if (skippedReason) {
    console.log(`⚠ statusLine não alterada: ${skippedReason}`);
  } else if (changed) {
    writeFileSync(settingsFile, `${JSON.stringify(merged, null, 2)}\n`);
    console.log(`✓ statusLine configurada em ${settingsFile}`);
  } else {
    console.log('✓ statusLine já configurada corretamente');
  }

  console.log('\nPronto. Abra uma nova sessão do Claude Code pra ver a statusline, e rode `tokmon watch` ou `tokmon snapshot` quando quiser.');
}

if (isMainModule(import.meta.url)) {
  runSetup();
}
