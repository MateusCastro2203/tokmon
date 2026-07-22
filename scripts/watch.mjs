#!/usr/bin/env node
import React, { useState, useEffect } from 'react';
import { watch } from 'node:fs';
import path from 'node:path';
import {
  encodeProjectDir,
  findActiveSession,
  parseSession,
  groupIntoTurns,
  computeTotals,
  buildViewModel,
} from './lib.mjs';

const h = React.createElement;

function loadViewModel(cwd) {
  const home = process.env.HOME ?? '';
  const projectDir = path.join(home, '.claude', 'projects', encodeProjectDir(cwd));
  const sessionFile = findActiveSession(projectDir);
  if (!sessionFile) return { error: `sem sessão ativa em ${projectDir}`, sessionFile: null };
  const { events, warnings } = parseSession(sessionFile);
  const turns = groupIntoTurns(events);
  const totals = computeTotals(events, turns);
  const sessionId = path.basename(sessionFile, '.jsonl');
  return {
    model: buildViewModel(totals, { sessionId, projectLabel: path.basename(cwd), warnings }),
    sessionFile,
  };
}

function createApp({ Box, Text }) {
  return function App({ cwd }) {
    const [state, setState] = useState(() => loadViewModel(cwd));

    useEffect(() => {
      const reload = () => setState(loadViewModel(cwd));
      const interval = setInterval(reload, 2000);
      const watcher = state.sessionFile ? watch(state.sessionFile, { persistent: false }, reload) : null;
      return () => {
        clearInterval(interval);
        watcher?.close();
      };
    }, [cwd, state.sessionFile]);

    if (state.error) return h(Text, { color: 'yellow' }, `token-monitor: ${state.error}`);
    const { model } = state;
    return h(
      Box,
      { flexDirection: 'column', paddingX: 1 },
      h(Text, { bold: true }, model.header),
      h(Text, null, model.totalsLine),
      h(Text, null, model.contextLine),
      h(Text, null, ' '),
      h(Text, { bold: true }, 'Top prompts:'),
      ...model.topRows.map((row) => h(Text, { key: String(row.rank) }, ` ${row.rank}. ${row.tokens}  "${row.preview}"`)),
      h(Text, null, ' '),
      h(Text, { bold: true }, 'Por skill/agente:'),
      ...model.skillRows.map((row) => h(Text, { key: row.skill }, ` ${row.skill.padEnd(12)} ${row.tokens}`)),
      model.warningsLine ? h(Text, { color: 'red' }, model.warningsLine) : null
    );
  };
}

async function main() {
  let ink;
  try {
    ink = await import('ink');
  } catch {
    console.error('token-monitor: dependências não instaladas. Rode `npm install` na pasta da skill (~/.claude/skills/token-monitor).');
    process.exitCode = 1;
    return;
  }
  const App = createApp(ink);
  const cwd = process.argv[2] ?? process.cwd();
  ink.render(h(App, { cwd }));
}

main();
