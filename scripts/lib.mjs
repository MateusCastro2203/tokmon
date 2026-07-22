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

export function groupIntoTurns(events) {
  const turns = [];
  let current = null;
  for (const event of events) {
    if (event.role === 'user' && event.isRealUserText && !event.isSidechain) {
      current = {
        id: event.uuid,
        ts: event.ts,
        textPreview: event.textPreview ?? '',
        usage: { input_tokens: 0, output_tokens: 0, cache_creation_input_tokens: 0, cache_read_input_tokens: 0, total: 0 },
        bySkill: {},
      };
      turns.push(current);
      continue;
    }
    if (!current || !event.usage) continue;
    const bucket = event.isSidechain ? (event.attributionSkill ?? 'subagent') : 'main';
    const turnTotal =
      event.usage.input_tokens +
      event.usage.output_tokens +
      event.usage.cache_creation_input_tokens +
      event.usage.cache_read_input_tokens;
    current.usage.input_tokens += event.usage.input_tokens;
    current.usage.output_tokens += event.usage.output_tokens;
    current.usage.cache_creation_input_tokens += event.usage.cache_creation_input_tokens;
    current.usage.cache_read_input_tokens += event.usage.cache_read_input_tokens;
    current.usage.total += turnTotal;
    current.bySkill[bucket] = (current.bySkill[bucket] ?? 0) + turnTotal;
  }
  return turns;
}

export const DEFAULT_MODEL_LIMITS = { sonnet: 200000, opus: 200000, haiku: 200000 };

export function formatTokenCount(n) {
  if (n < 1000) return String(Math.round(n));
  return `${(n / 1000).toFixed(1)}k`;
}

function resolveModelLimit(modelId, modelLimits) {
  if (!modelId) return 200000;
  const lower = modelId.toLowerCase();
  for (const [key, limit] of Object.entries(modelLimits)) {
    if (lower.includes(key)) return limit;
  }
  return 200000;
}

export function computeTotals(events, turns, opts = {}) {
  const modelLimits = opts.modelLimits ?? DEFAULT_MODEL_LIMITS;

  const totals = { input_tokens: 0, output_tokens: 0, cache_creation_input_tokens: 0, cache_read_input_tokens: 0, total: 0 };
  const bySkillMap = {};
  for (const turn of turns) {
    totals.input_tokens += turn.usage.input_tokens;
    totals.output_tokens += turn.usage.output_tokens;
    totals.cache_creation_input_tokens += turn.usage.cache_creation_input_tokens;
    totals.cache_read_input_tokens += turn.usage.cache_read_input_tokens;
    totals.total += turn.usage.total;
    for (const [skill, tokens] of Object.entries(turn.bySkill)) {
      bySkillMap[skill] = (bySkillMap[skill] ?? 0) + tokens;
    }
  }
  const bySkill = Object.entries(bySkillMap)
    .map(([skill, total]) => ({ skill, total }))
    .sort((a, b) => b.total - a.total);
  const topTurns = [...turns].sort((a, b) => b.usage.total - a.usage.total);

  let contextWindow = null;
  const lastMainAssistant = [...events].reverse().find((e) => e.role === 'assistant' && !e.isSidechain && e.usage);
  if (lastMainAssistant) {
    const totalInputTokens =
      lastMainAssistant.usage.input_tokens +
      lastMainAssistant.usage.cache_read_input_tokens +
      lastMainAssistant.usage.cache_creation_input_tokens;
    const contextWindowSize = resolveModelLimit(lastMainAssistant.model, modelLimits);
    contextWindow = {
      totalInputTokens,
      contextWindowSize,
      usedPercentage: Math.round((totalInputTokens / contextWindowSize) * 1000) / 10,
    };
  }

  return { totals, bySkill, topTurns, contextWindow };
}
