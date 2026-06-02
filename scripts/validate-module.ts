import { readFileSync } from 'fs';
import path from 'path';
import { adventureModuleSchema } from '../src/lib/game/adventures/module-schema';

const target = process.argv[2];

if (!target) {
  console.error('Usage: npm run module:validate -- <path/to/module.json>');
  process.exit(1);
}

const filePath = path.resolve(process.cwd(), target);

let raw: unknown;
try {
  raw = JSON.parse(readFileSync(filePath, 'utf8'));
} catch (e) {
  console.error(`Failed to read or parse JSON: ${filePath}`);
  console.error(e);
  process.exit(1);
}

const parsed = adventureModuleSchema.safeParse(raw);

if (!parsed.success) {
  console.error(`Invalid module: ${filePath}`);
  console.error(parsed.error.format());
  process.exit(1);
}

console.log(`Valid module "${parsed.data.id}" — ${parsed.data.sceneOrder.length} scenes in order.`);
if (parsed.data.chapters?.length) {
  console.log(`  Chapters documented: ${parsed.data.chapters.map((c) => c.id).join(', ')}`);
}
