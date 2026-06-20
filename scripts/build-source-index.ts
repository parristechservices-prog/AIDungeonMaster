/**
 * Build a retrieval index from an owned source book (e.g. Storm King's Thunder).
 *
 * Usage:
 *   pnpm tsx scripts/build-source-index.ts <key> [inputPath]
 *   e.g. pnpm tsx scripts/build-source-index.ts skt
 *
 * Reads content/private/<key>-source/source.txt (or the given path) and writes
 * content/private/<key>-source/index.json. The source text and index live under
 * content/private/, which is gitignored — owned book text never enters version
 * control. Upload the resulting index.json to Vercel Blob for production.
 */
import { existsSync, readFileSync, writeFileSync } from 'fs';
import path from 'path';
import { SOURCE_INDEX_FORMAT, type GazetteerEntry, type SourceChunk, type SourceIndex } from '../src/lib/llm/source-lore/types';

const TITLES: Record<string, string> = { skt: "Storm King's Thunder" };

const CHUNK_TARGET_CHARS = 1100;
const CHUNK_MAX_CHARS = 1500;

function cleanLine(line: string): string {
  return line.replace(/­/g, '').replace(/\s+/g, ' ').trimEnd();
}

function upperRatio(s: string): number {
  const letters = s.replace(/[^A-Za-z]/g, '');
  if (letters.length === 0) return 0;
  return s.replace(/[^A-Z]/g, '').length / letters.length;
}

/** Heading-ish: short, mostly uppercase, or an area marker like "11. BRIDGE" / "14A. GREAT HALL". */
function isHeading(line: string): boolean {
  const t = line.trim();
  if (t.length === 0 || t.length > 60) return false;
  // Area marker like "11. BRIDGE" / "14A. GREAT HALL": the TITLE after the number
  // must be a title (mostly uppercase), not a numbered sentence ("12. After ...").
  const marker = t.match(/^\d{1,3}[A-Z]?\.\s+(.+)$/);
  if (marker) {
    const title = marker[1];
    return title.replace(/[^A-Za-z]/g, '').length >= 2 && upperRatio(title) > 0.7;
  }
  const letters = t.replace(/[^A-Za-z]/g, '');
  if (letters.length < 3) return false;
  return upperRatio(t) > 0.7;
}

/** Table-of-contents lines: dot leaders or trailing page numbers. */
function isTocNoise(line: string): boolean {
  return /\.{4,}\s*\d+\s*$/.test(line) || /^\s*\d+\s*$/.test(line);
}

function dehyphenate(lines: string[]): string[] {
  const out: string[] = [];
  for (let i = 0; i < lines.length; i++) {
    let line = lines[i];
    // Join soft/hard hyphenation at end of line with the next line's first word.
    while (/[A-Za-z]-$/.test(line) && i + 1 < lines.length) {
      const next = lines[i + 1].replace(/^\s+/, '');
      line = line.replace(/-$/, '') + next;
      i++;
    }
    out.push(line);
  }
  return out;
}

function build(key: string, inputPath: string): SourceIndex {
  const raw = readFileSync(inputPath, 'utf8');
  const rawLines = raw.split(/\r?\n/).map(cleanLine);
  const lines = dehyphenate(rawLines);

  const chunks: SourceChunk[] = [];
  let heading = TITLES[key] ?? key;
  let areaPrefix = ''; // last top-level area, e.g. "8. NIGHTSTONE INN"
  let areaNum = '';
  let buf: string[] = [];
  let bufLen = 0;
  let counter = 0;

  const flush = () => {
    const text = buf.join(' ').replace(/\s+/g, ' ').trim();
    if (text.length >= 40) {
      chunks.push({ id: `${key}-${String(++counter).padStart(5, '0')}`, heading, text });
    }
    buf = [];
    bufLen = 0;
  };

  for (const line of lines) {
    if (isTocNoise(line)) continue;
    if (isHeading(line)) {
      flush();
      const t = line.trim();
      const top = t.match(/^(\d{1,2})\.\s+[A-Z]/); // top-level area: "8. NIGHTSTONE INN"
      const sub = t.match(/^(\d{1,2})[A-Z]\.\s+/); // sub-area: "8A. DINING ROOM"
      if (top) {
        areaNum = top[1];
        areaPrefix = t;
        heading = t;
      } else if (sub && sub[1] === areaNum && areaPrefix) {
        // Carry parent context so sub-areas are searchable by their area name.
        heading = `${areaPrefix} — ${t}`;
      } else {
        heading = t;
      }
      continue;
    }
    if (line.trim().length === 0) {
      if (bufLen >= CHUNK_TARGET_CHARS) flush();
      continue;
    }
    buf.push(line.trim());
    bufLen += line.length + 1;
    if (bufLen >= CHUNK_MAX_CHARS) flush();
  }
  flush();

  return { key, title: TITLES[key] ?? key, builtFormat: SOURCE_INDEX_FORMAT, chunks };
}

/** Words that look capitalized but aren't proper names (sentence-starters, etc.). */
const NAME_STOP = new Set([
  'The', 'This', 'That', 'These', 'Those', 'There', 'Their', 'They', 'When', 'While', 'With',
  'If', 'In', 'On', 'At', 'As', 'A', 'An', 'Each', 'Any', 'All', 'Some', 'One', 'Two', 'Both',
  'He', 'She', 'It', 'You', 'We', 'Characters', 'Character', 'Treasure', 'Development', 'Chapter', 'DC',
  'Ideally', 'Once', 'After', 'Before', 'Suddenly', 'Meanwhile', 'Unless', 'Because', 'However',
  'Although', 'Finally', 'Instead', 'Otherwise', 'Similarly', 'Additionally', 'Nevertheless',
  'Together', 'Inside', 'Outside', 'Above', 'Below', 'North', 'South', 'East', 'West', 'Town',
  'Flames', 'Highsun', 'Here', 'Such', 'Most', 'Many', 'Several', 'Other', 'Another', 'During',
  'Roleplaying', 'Roll', 'Read', 'Use', 'Set', 'Lying', 'Standing', 'Hanging', 'Mounted', 'Known',
]);

function looksLikeName(name: string): boolean {
  const words = name.split(/\s+/);
  if (words.length === 0 || words.length > 4) return false;
  if (words.some((w) => NAME_STOP.has(w))) return false;
  // A single-word name must be at least 4 letters to avoid stray caps.
  if (words.length === 1 && words[0].length < 4) return false;
  // Each word starts uppercase; allow internal apostrophes/hyphens.
  return words.every((w) => /^[A-Z][A-Za-z'’-]+$/.test(w));
}

function cleanNote(s: string): string {
  return s.replace(/\s+/g, ' ').replace(/[.,;:]+$/, '').trim().slice(0, 120);
}

/**
 * Extracts canonical named entities from chunks using the stat-block prose
 * patterns the book uses ("a goblin named X", "X, a Zhentarim spy",
 * "X (LE male half-elf ...)"). Heuristic but high-precision; deduped by name,
 * keeping the most descriptive note.
 */
function buildGazetteer(chunks: SourceChunk[]): GazetteerEntry[] {
  const byName = new Map<string, GazetteerEntry>();
  const consider = (name: string, note: string, heading: string) => {
    name = name.trim();
    note = cleanNote(note);
    if (!looksLikeName(name) || note.length < 4) return;
    const existing = byName.get(name);
    if (!existing || note.length > existing.note.length) {
      byName.set(name, { name, note, heading });
    }
  };

  const namedRe = /\b(?:named|called)\s+([A-Z][A-Za-z'’-]+(?:\s+[A-Z][A-Za-z'’-]+){0,2})\b([^.]{0,90})/g;
  const apposRe = /\b([A-Z][A-Za-z'’-]+(?:\s+[A-Z][A-Za-z'’-]+){0,2}),\s+(an?|the)\s+([a-z][^.,;()]{4,80})/g;
  const parenRe = /\b([A-Z][A-Za-z'’-]+(?:\s+[A-Z][A-Za-z'’-]+){0,2})\s*\(([A-Z]{1,2}\b[^)]{4,80})\)/g;

  for (const c of chunks) {
    let m: RegExpExecArray | null;
    namedRe.lastIndex = 0;
    while ((m = namedRe.exec(c.text))) consider(m[1], m[2] ? `${m[2]}` : c.heading, c.heading);
    apposRe.lastIndex = 0;
    while ((m = apposRe.exec(c.text))) consider(m[1], `${m[2]} ${m[3]}`, c.heading);
    parenRe.lastIndex = 0;
    while ((m = parenRe.exec(c.text))) consider(m[1], m[2], c.heading);
  }
  return [...byName.values()].sort((a, b) => a.name.localeCompare(b.name));
}

function main() {
  const key = process.argv[2];
  if (!key) {
    console.error('Usage: tsx scripts/build-source-index.ts <key> [inputPath]');
    process.exit(1);
  }
  const dir = path.resolve(process.cwd(), 'content', 'private', `${key}-source`);
  const inputPath = process.argv[3] ?? path.join(dir, 'source.txt');
  if (!existsSync(inputPath)) {
    console.error(`Source not found: ${inputPath}`);
    process.exit(1);
  }
  const index = build(key, inputPath);
  index.gazetteer = buildGazetteer(index.chunks);
  const outPath = path.join(dir, 'index.json');
  writeFileSync(outPath, JSON.stringify(index), 'utf8');
  const bytes = Buffer.byteLength(JSON.stringify(index));
  console.log(JSON.stringify({
    key,
    title: index.title,
    chunks: index.chunks.length,
    gazetteer: index.gazetteer?.length ?? 0,
    indexBytes: bytes,
    out: outPath,
  }, null, 2));
}

main();
