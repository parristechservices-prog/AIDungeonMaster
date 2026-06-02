import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { NextResponse } from 'next/server';
import { adventureModuleSchema } from '@/lib/game/adventures/module-schema';

function sanitizeModuleId(raw: string): string {
  const cleaned = raw.trim().toLowerCase().replace(/[^a-z0-9-]/g, '-');
  return cleaned.replace(/-+/g, '-').replace(/^-|-$/g, '');
}

/** Dev-only: import module JSON into local gitignored content/private folder. */
export async function POST(req: Request) {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json(
      { ok: false, error: 'Not available in production deployment' },
      { status: 404 },
    );
  }

  const form = await req.formData().catch(() => null);
  if (!form) {
    return NextResponse.json({ ok: false, error: 'Expected multipart form-data' }, { status: 400 });
  }

  const uploaded = form.get('file');
  if (!(uploaded instanceof File)) {
    return NextResponse.json({ ok: false, error: 'Expected file field "file"' }, { status: 400 });
  }

  const text = await uploaded.text();
  const body = (() => {
    try {
      return JSON.parse(text || '{}');
    } catch {
      return null;
    }
  })();
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ ok: false, error: 'Uploaded file is not valid JSON' }, { status: 400 });
  }
  const parsed = adventureModuleSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: 'Validation failed', details: parsed.error.format() },
      { status: 400 },
    );
  }

  const moduleId = sanitizeModuleId(
    String(form.get('moduleId') || parsed.data.id || '').trim(),
  );
  if (!moduleId) {
    return NextResponse.json({ ok: false, error: 'Module id is required' }, { status: 400 });
  }

  const moduleData = {
    ...parsed.data,
    id: moduleId,
  };
  const targetDir = path.join(process.cwd(), 'content', 'private', moduleId);
  await mkdir(targetDir, { recursive: true });
  await writeFile(path.join(targetDir, 'module.json'), `${JSON.stringify(moduleData, null, 2)}\n`, 'utf8');

  return NextResponse.json({
    ok: true,
    id: moduleId,
    sceneCount: moduleData.sceneOrder.length,
    path: `content/private/${moduleId}/module.json`,
  });
}
