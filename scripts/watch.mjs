#!/usr/bin/env node
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

function createApp({ Box, Text, useState, useEffect, h }) {
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

    if (state.error) {
      return h(
        Box,
        { borderStyle: 'round', borderColor: 'yellow', paddingX: 1 },
        h(Text, { color: 'yellow' }, `⚠ token-monitor: ${state.error}`)
      );
    }
    const { model } = state;
    const contextColor =
      model.contextSeverity === 'danger' ? 'red' : model.contextSeverity === 'warn' ? 'yellow' : 'green';

    return h(
      Box,
      { flexDirection: 'column' },
      h(
        Box,
        { flexDirection: 'column', borderStyle: 'round', borderColor: 'cyan', paddingX: 1, marginBottom: 1 },
        h(Text, { bold: true, color: 'cyan' }, model.header),
        h(Text, null, `🔥 Total: ${model.totalTokens} tok`),
        h(Text, { dimColor: true }, `   ${model.breakdown}`),
        model.contextPercentage !== null
          ? h(Text, { color: contextColor }, `🧠 Contexto: ${model.contextPercentage}% usado (${model.contextDetail})`)
          : h(Text, { dimColor: true }, '🧠 Contexto: sem dados ainda')
      ),
      h(
        Box,
        { flexDirection: 'column', borderStyle: 'round', borderColor: 'magenta', paddingX: 1, marginBottom: 1 },
        h(Text, { bold: true, color: 'magenta' }, '🏆 Top prompts'),
        ...(model.topRows.length
          ? model.topRows.map((row) =>
              h(Text, { key: String(row.rank) }, ` ${row.rank}. ${row.tokens.padStart(7)}  "${row.preview}"`)
            )
          : [h(Text, { dimColor: true }, ' (nenhum prompt registrado ainda)')])
      ),
      h(
        Box,
        { flexDirection: 'column', borderStyle: 'round', borderColor: 'blue', paddingX: 1 },
        h(Text, { bold: true, color: 'blue' }, '🧩 Por skill/agente'),
        ...(model.skillRows.length
          ? model.skillRows.map((row) =>
              h(Text, { key: row.skill }, ` ${row.skill.padEnd(12)} ${row.tokens.padStart(7)}`)
            )
          : [h(Text, { dimColor: true }, ' (sem dados)')])
      ),
      model.warningsLine ? h(Text, { color: 'red' }, `⚠ ${model.warningsLine}`) : null
    );
  };
}

export async function runWatch(argv = process.argv.slice(2)) {
  let React, ink;
  try {
    [{ default: React }, ink] = await Promise.all([import('react'), import('ink')]);
  } catch {
    console.error('token-monitor: dependências não instaladas. Rode `npm install` na pasta da skill (~/.claude/skills/token-monitor).');
    process.exitCode = 1;
    return;
  }
  const h = React.createElement;
  const App = createApp({ Box: ink.Box, Text: ink.Text, useState: React.useState, useEffect: React.useEffect, h });
  const cwd = argv[0] ?? process.cwd();
  ink.render(h(App, { cwd }));
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runWatch();
}
