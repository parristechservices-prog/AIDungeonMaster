/**
 * Runs src/lib/db/schema.sql against DATABASE_URL.
 * Usage: pnpm db:migrate   (loads .env.local automatically via the npm script)
 */
import { readFileSync } from 'fs';
import path from 'path';
import postgres from 'postgres';

async function main() {
  const url = process.env.DATABASE_URL?.trim();
  if (!url) {
    console.error('DATABASE_URL is not set.');
    process.exit(1);
  }
  const sql = postgres(url, { prepare: false, max: 1 });
  try {
    const check = await sql`select 1 as ok`;
    console.log('connectivity: select 1 =>', check[0].ok);

    const schema = readFileSync(path.resolve(process.cwd(), 'src/lib/db/schema.sql'), 'utf8');
    await sql.unsafe(schema);
    console.log('schema applied.');

    const tables = await sql`
      select table_name from information_schema.tables
      where table_schema = 'public' and table_name in ('sessions','recaps')
      order by table_name`;
    console.log('tables present:', tables.map((t) => t.table_name).join(', '));
  } finally {
    await sql.end();
  }
}

main().catch((e) => {
  console.error('migrate failed:', e instanceof Error ? e.message : e);
  process.exit(1);
});
