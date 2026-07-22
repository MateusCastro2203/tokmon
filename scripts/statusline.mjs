#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { parseSession, groupIntoTurns, computeTotals, formatStatusLine } from './lib.mjs';

function main() {
  let input;
  try {
    input = JSON.parse(readFileSync(0, 'utf8'));
  } catch {
    console.log('token-monitor: sem sessão');
    return;
  }
  const transcriptPath = input?.transcript_path;
  if (!transcriptPath) {
    console.log('token-monitor: sem sessão');
    return;
  }
  let totals;
  try {
    const { events } = parseSession(transcriptPath);
    const turns = groupIntoTurns(events);
    totals = computeTotals(events, turns);
  } catch {
    console.log('token-monitor: sem sessão');
    return;
  }
  const contextWindowOverride = input?.context_window?.used_percentage ?? null;
  console.log(formatStatusLine({ totals, contextWindowOverride }));
}

main();
