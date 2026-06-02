import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import path from 'path';
import { adventureModuleSchema } from '../src/lib/game/adventures/module-schema';

const templateId = process.argv[2];
const privateId = process.argv[3] ?? templateId;

if (!templateId) {
  console.error('Usage: npm run module:scaffold -- <template-folder-name> [private-module-id]');
  console.error('Example: npm run module:scaffold -- skt-nightstone-starter skt-nightstone');
  process.exit(1);
}

const srcDir = path.join(process.cwd(), 'content', 'templates', templateId);
const srcFile = path.join(srcDir, 'module.json');

if (!existsSync(srcFile)) {
  console.error(`Template not found: ${srcFile}`);
  process.exit(1);
}

const destDir = path.join(process.cwd(), 'content', 'private', privateId);
const destFile = path.join(destDir, 'module.json');

if (existsSync(destFile)) {
  console.error(`Already exists (refusing to overwrite): ${destFile}`);
  process.exit(1);
}

mkdirSync(destDir, { recursive: true });

const raw = JSON.parse(readFileSync(srcFile, 'utf8')) as Record<string, unknown>;
raw.id = privateId.replace(/[^a-z0-9-]/g, '-');
if (typeof raw.sourceNote === 'string') {
  raw.sourceNote = `Private copy from template ${templateId}. ${raw.sourceNote}`;
}

const validated = adventureModuleSchema.safeParse(raw);
if (!validated.success) {
  console.error('Template module.json failed validation before copy:');
  console.error(validated.error.format());
  process.exit(1);
}

writeFileSync(destFile, `${JSON.stringify(validated.data, null, 2)}\n`, 'utf8');
console.log(`Created ${destFile}`);
console.log('Edit YOUR NOTE fields, then: npm run module:validate --', destFile);
