import { NextResponse } from 'next/server';
import { adventureModuleSchema } from '@/lib/game/adventures/module-schema';

/** Dev-only: validate a module.json payload without saving. */
export async function POST(req: Request) {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ ok: false, error: 'Not available in production' }, { status: 404 });
  }

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ ok: false, error: 'Expected JSON body' }, { status: 400 });
  }

  const parsed = adventureModuleSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: 'Validation failed', details: parsed.error.format() },
      { status: 400 },
    );
  }

  return NextResponse.json({
    ok: true,
    id: parsed.data.id,
    sceneCount: parsed.data.sceneOrder.length,
    chapters: parsed.data.chapters?.map((c) => c.id) ?? [],
  });
}
