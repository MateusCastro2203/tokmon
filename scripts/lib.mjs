import { readdirSync, statSync, existsSync, readFileSync } from 'node:fs';
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

function isRealUserMessage(entry) {
  if (entry.message?.role !== 'user') return false;
  if (entry.toolUseResult) return false;
  const content = entry.message.content;
  if (typeof content === 'string') return content.trim().length > 0;
  if (Array.isArray(content)) {
    const hasToolResult = content.some((block) => block.type === 'tool_result');
    if (hasToolResult) return false;
    return content.some((block) => block.type === 'text' && block.text.trim().length > 0);
  }
  return false;
}

function extractTextPreview(entry) {
  const content = entry.message?.content;
  let text = null;
  if (typeof content === 'string') text = content;
  else if (Array.isArray(content)) {
    const block = content.find((b) => b.type === 'text' && typeof b.text === 'string');
    text = block?.text ?? null;
  }
  if (!text) return null;
  const trimmed = text.trim().replace(/\s+/g, ' ');
  return trimmed.length > 60 ? `${trimmed.slice(0, 60)}…` : trimmed;
}

function normalizeEvent(entry) {
  const role = entry.message?.role;
  if (role !== 'user' && role !== 'assistant') return null;
  const usageRaw = entry.message?.usage;
  const usage = usageRaw
    ? {
        input_tokens: usageRaw.input_tokens ?? 0,
        output_tokens: usageRaw.output_tokens ?? 0,
        cache_creation_input_tokens: usageRaw.cache_creation_input_tokens ?? 0,
        cache_read_input_tokens: usageRaw.cache_read_input_tokens ?? 0,
      }
    : null;
  return {
    role,
    ts: entry.timestamp ?? null,
    uuid: entry.uuid ?? null,
    parentUuid: entry.parentUuid ?? null,
    isSidechain: entry.isSidechain === true,
    attributionSkill: entry.attributionSkill ?? null,
    model: entry.message?.model ?? null,
    isRealUserText: isRealUserMessage(entry),
    textPreview: extractTextPreview(entry),
    usage,
  };
}

export function parseSession(filePath) {
  const raw = readFileSync(filePath, 'utf8');
  const lines = raw.split('\n').filter((l) => l.trim().length > 0);
  const events = [];
  let warnings = 0;
  for (const line of lines) {
    let entry;
    try {
      entry = JSON.parse(line);
    } catch {
      warnings += 1;
      continue;
    }
    const normalized = normalizeEvent(entry);
    if (normalized) events.push(normalized);
  }
  return { events, warnings };
}
