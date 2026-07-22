#!/usr/bin/env node
import path from 'node:path';
import {
  encodeProjectDir,
  findActiveSession,
  parseSession,
  groupIntoTurns,
  computeTotals,
  formatSnapshot,
  isMainModule,
} from './lib.mjs';

export function runSnapshot(argv = process.argv.slice(2)) {
  const cwd = argv[0] ?? process.cwd();
  const home = process.env.HOME ?? '';
  const projectDir = path.join(home, '.claude', 'projects', encodeProjectDir(cwd));
  const sessionFile = findActiveSession(projectDir);
  if (!sessionFile) {
    console.log(`token-monitor: nenhuma sessão encontrada em ${projectDir}`);
    console.log('Rode este comando de dentro de um projeto com uma sessão ativa do Claude Code.');
    return;
  }
  const { events, warnings } = parseSession(sessionFile);
  const turns = groupIntoTurns(events);
  const totals = computeTotals(events, turns);
  const sessionId = path.basename(sessionFile, '.jsonl');
  console.log(formatSnapshot(totals, { sessionId, projectLabel: path.basename(cwd), warnings }));
}

if (isMainModule(import.meta.url)) {
  runSnapshot();
}
