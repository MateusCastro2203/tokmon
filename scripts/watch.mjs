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
  isMainModule,
} from './lib.mjs';
import { DRAGON_SPRITE_ROWS, DRAGON_PALETTE, hpBarSegments } from './dragon-sprite.mjs';

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

// Packs 2 sprite rows into 1 terminal row using the ▀ (upper half block)
// trick: foreground = top pixel, background = bottom pixel. Halves both the
// width (1 char/pixel instead of 2) and the height (2 sprite rows/line) of
// the previous flat-block rendering, and the character's own ~1:2 aspect
// ratio makes each original square sprite pixel read correctly proportioned.
function renderDragonSprite({ Box, Text, h }) {
  const lines = [];
  for (let i = 0; i < DRAGON_SPRITE_ROWS.length; i += 2) {
    const top = DRAGON_SPRITE_ROWS[i];
    const bottom = DRAGON_SPRITE_ROWS[i + 1] ?? '.'.repeat(top.length);
    lines.push(
      h(
        Text,
        { key: `row-${i}` },
        ...top.split('').map((topCode, x) => {
          const topColor = DRAGON_PALETTE[topCode];
          const bottomColor = DRAGON_PALETTE[bottom[x]];
          if (!topColor && !bottomColor) return h(Text, { key: x }, ' ');
          if (topColor && !bottomColor) return h(Text, { key: x, color: topColor }, '▀');
          if (!topColor && bottomColor) return h(Text, { key: x, color: bottomColor }, '▄');
          return h(Text, { key: x, color: topColor, backgroundColor: bottomColor }, '▀');
        })
      )
    );
  }
  return h(Box, { flexDirection: 'column' }, ...lines);
}

function renderStatsPanel({ Box, Text, h }, model, contextColor) {
  const bar = hpBarSegments(model.contextPercentage);
  return h(
    Box,
    { flexDirection: 'column', marginLeft: 2 },
    h(Text, { bold: true, color: 'cyan' }, model.header),
    h(Text, null, ' '),
    h(Text, null, `🔥 Total: ${model.totalTokens} tok`),
    h(Text, { dimColor: true }, model.breakdown),
    h(Text, null, ' '),
    model.contextPercentage !== null
      ? h(
          Text,
          null,
          'CTX ',
          h(Text, { color: contextColor }, '█'.repeat(bar.filled)),
          h(Text, { dimColor: true }, '░'.repeat(bar.empty)),
          ` ${model.contextPercentage}% (${model.contextDetail})`
        )
      : h(Text, { dimColor: true }, 'CTX sem dados ainda'),
    h(Text, null, ' '),
    model.topRows[0]
      ? h(Text, { dimColor: true }, `Top: "${model.topRows[0].preview}"`)
      : h(Text, { dimColor: true }, 'Top: (nenhum prompt registrado ainda)')
  );
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
        { flexDirection: 'row', borderStyle: 'round', borderColor: 'cyan', paddingX: 1, marginBottom: 1 },
        renderDragonSprite({ Box, Text, h }),
        renderStatsPanel({ Box, Text, h }, model, contextColor)
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

if (isMainModule(import.meta.url)) {
  runWatch();
}
