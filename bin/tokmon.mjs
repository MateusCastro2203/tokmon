#!/usr/bin/env node
import { runSnapshot } from '../scripts/snapshot.mjs';
import { runWatch } from '../scripts/watch.mjs';
import { runStatusline } from '../scripts/statusline.mjs';

function printHelp() {
  console.log(`tokmon — monitor de consumo de token do Claude Code

Uso:
  tokmon snapshot [cwd]   Snapshot de texto: total, ranking de prompt, quebra por skill, context window
  tokmon watch [cwd]      Dashboard ao vivo no terminal (atualiza sozinho)
  tokmon statusline       Modo statusLine — lê JSON do stdin (uso interno, configurado em ~/.claude/settings.json)
  tokmon help             Mostra esta ajuda`);
}

async function main() {
  const [subcommand, ...rest] = process.argv.slice(2);

  switch (subcommand) {
    case 'snapshot':
      runSnapshot(rest);
      break;
    case 'watch':
      await runWatch(rest);
      break;
    case 'statusline':
      runStatusline();
      break;
    case 'help':
    case '--help':
    case '-h':
    case undefined:
      printHelp();
      break;
    default:
      console.error(`tokmon: comando desconhecido "${subcommand}"\n`);
      printHelp();
      process.exitCode = 1;
  }
}

main();
