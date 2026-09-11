import fs from 'node:fs';
import path from 'node:path';

const enabled = process.env.PARTYQUEST_DEV_LOGS === 'true';
const SENSITIVE_KEY = /^(?:playerInput|response|authorization|cookie|sessionAccessHash|token|secret|apiKey|api_key|systemPrompt)$/i;

export function writeDevLog(event: unknown): void {
  if (!enabled) return;
  const dir = path.resolve(process.cwd(), '.logs');
  fs.mkdirSync(dir, { recursive: true });
  const line = JSON.stringify({ ts: new Date().toISOString(), ...sanitizeObject(asObject(event)) });
  fs.appendFileSync(path.join(dir, 'turns.jsonl'), `${line}\n`, 'utf8');
}

function asObject(event: unknown): Record<string, unknown> {
  return typeof event === 'object' && event !== null ? (event as Record<string, unknown>) : { value: event };
}

function sanitizeObject(value: Record<string, unknown>, depth = 0): Record<string, unknown> {
  if (depth > 5) return { truncated: true };
  const safe: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(value)) {
    if (SENSITIVE_KEY.test(key)) {
      safe[key] = '[redacted]';
      continue;
    }
    safe[key] = sanitizeValue(item, depth + 1);
  }
  return safe;
}

function sanitizeValue(value: unknown, depth: number): unknown {
  if (typeof value === 'string') return value.slice(0, 500);
  if (Array.isArray(value)) return value.slice(0, 50).map((item) => sanitizeValue(item, depth + 1));
  if (value && typeof value === 'object') return sanitizeObject(value as Record<string, unknown>, depth + 1);
  return value;
}
