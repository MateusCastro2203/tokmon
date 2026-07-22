import { readdirSync, statSync, existsSync } from 'node:fs';
import path from 'node:path';

export function encodeProjectDir(cwd) {
  return cwd.replace(/[\/._]/g, '-');
}

export function listSessionFiles(projectDir) {
  if (!existsSync(projectDir)) return [];
  return readdirSync(projectDir)
    .filter((name) => name.endsWith('.jsonl'))
    .map((name) => path.join(projectDir, name))
    .sort((a, b) => statSync(b).mtimeMs - statSync(a).mtimeMs);
}

export function findActiveSession(projectDir) {
  const files = listSessionFiles(projectDir);
  return files[0] ?? null;
}
