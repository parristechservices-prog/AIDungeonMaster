import { NextResponse } from 'next/server';
import { BACKGROUNDS } from '@/lib/game/backgrounds';
import { CHARACTER_TEMPLATES } from '@/lib/game/characters/templates';
import { DM_PERSONAS } from '@/lib/game/personas';
import { listAdventuresForCatalog } from '@/lib/game/adventures/registry.server';

export async function GET() {
  return NextResponse.json({
    ok: true,
    characters: CHARACTER_TEMPLATES.map((c) => ({
      id: c.id,
      label: c.label,
      className: c.className,
      description: c.description,
      suggestedAdventures: c.suggestedAdventures,
    })),
    backgrounds: BACKGROUNDS.map((b) => ({
      id: b.id,
      label: b.label,
      description: b.description,
    })),
    scenarios: listAdventuresForCatalog(),
    personas: Object.values(DM_PERSONAS).map((p) => ({
      id: p.id,
      name: p.name,
      description: p.description,
    })),
  });
}
