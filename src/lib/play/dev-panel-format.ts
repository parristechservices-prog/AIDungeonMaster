// Pure formatting/derivation helpers for the DM-view dev panels. No React, no
// I/O — every function is a deterministic transform over already-computed engine
// data, so it can be unit-tested directly and the components stay thin.

import type { RollBreakdown, CoverOutcome, OpportunityAttackOutcome } from '@/lib/engine/types';
import type { BattleMap, Cell } from '@/lib/engine/spatial/tactical';
import type { TurnResponse } from '@/lib/play/types';

export type EngineResultView = TurnResponse['engineResults'][number];
export type MonsterView = TurnResponse['state']['monsters'][number];

/** Tactical-layer defaults, mirrored here for display when a monster omits them. */
export const DEFAULT_MONSTER_SPEED_FT = 30;
export const DEFAULT_MONSTER_REACH_FT = 5;

export function monsterSpeedFt(m: Pick<MonsterView, 'speedFt'>): number {
  return m.speedFt ?? DEFAULT_MONSTER_SPEED_FT;
}

export function monsterReachFt(m: Pick<MonsterView, 'reachFt'>): number {
  return m.reachFt ?? DEFAULT_MONSTER_REACH_FT;
}

/** Normalised attack lines for a monster's stat block (melee/ranged, bonus, dmg). */
export function monsterAttackLines(m: MonsterView): string[] {
  if (m.attacks && m.attacks.length > 0) {
    return m.attacks.map((a) => {
      const range = a.kind === 'ranged' ? `range ${a.rangeFt ?? '?'}${a.longRangeFt ? `/${a.longRangeFt}` : ''} ft` : `reach ${a.reachFt ?? 5} ft`;
      return `${a.name} (${a.kind}): +${a.attackBonus}, ${a.damage}, ${range}`;
    });
  }
  if (m.attackBonus === undefined || m.damage === undefined) return [];
  return [`Attack (melee): +${m.attackBonus}, ${m.damage}, reach ${monsterReachFt(m)} ft`];
}

export type EngineLogEntry = {
  turn: number;
  input: string;
  results: EngineResultView[];
};

/** Human-readable dice line, e.g. "1d20+4 → 17 (rolls: 13) vs DC 15 ✓". */
export function formatRollBreakdown(b: RollBreakdown): string {
  const rolls = b.rolls.length ? ` (rolls: ${b.rolls.join(', ')}${b.keptRoll !== undefined ? `, kept ${b.keptRoll}` : ''})` : '';
  const dc = b.dc !== undefined ? ` vs DC ${b.dc}` : '';
  const ok = b.ok === undefined ? '' : b.ok ? ' ✓' : ' ✗';
  return `${b.formula} → ${b.total}${rolls}${dc}${ok}`;
}

/** Which optional detail sections an engine result carries (drives expanders). */
export function engineResultDetail(result: EngineResultView): {
  hasBreakdown: boolean;
  hasTactical: boolean;
  hasCover: boolean;
  opportunityAttackCount: number;
} {
  return {
    hasBreakdown: !!result.breakdown,
    hasTactical: !!result.tactical,
    hasCover: !!result.cover,
    opportunityAttackCount: result.opportunityAttacks?.length ?? 0,
  };
}

/** Cover readout, e.g. "half cover: AC 12 + 2 = 14". */
export function formatCover(cover: CoverOutcome): string {
  const label = cover.kind.replace('_', '-');
  if (cover.kind === 'total') return 'total cover — cannot be targeted directly';
  if (cover.bonus === 0) return 'no cover';
  return `${label} cover: AC ${cover.baseAc} + ${cover.bonus} = ${cover.effectiveAc}`;
}

/** One opportunity-attack outcome as a readable line. */
export function formatOpportunityAttack(oa: OpportunityAttackOutcome): string {
  if (oa.warning) return oa.warning;
  const outcome = oa.hit ? `hits ${oa.targetName} for ${oa.damage}` : `misses ${oa.targetName}`;
  return `${oa.attackerName} opportunity attack ${outcome} (reaction used)`;
}

export type TerrainKey = Cell['terrain'];

/** Tailwind classes + label for a terrain type, for the grid overlay + legend. */
export function terrainStyle(terrain: TerrainKey): { className: string; label: string } {
  switch (terrain) {
    case 'difficult':
      return { className: 'bg-amber-200/60 dark:bg-amber-900/40', label: 'Difficult' };
    case 'blocked':
      return { className: 'bg-zinc-500/70 dark:bg-zinc-600/70', label: 'Blocked' };
    case 'hazard':
      return { className: 'bg-red-300/60 dark:bg-red-900/50', label: 'Hazard' };
    case 'water':
      return { className: 'bg-sky-300/50 dark:bg-sky-900/50', label: 'Water' };
    case 'climb':
      return { className: 'bg-lime-200/60 dark:bg-lime-900/40', label: 'Climb' };
    case 'squeeze':
      return { className: 'bg-purple-200/60 dark:bg-purple-900/40', label: 'Squeeze' };
    default:
      return { className: '', label: 'Normal' };
  }
}

const COVER_BADGE: Record<NonNullable<Cell['cover']>, string> = {
  none: '',
  half: '½',
  three_quarters: '¾',
  total: '■',
};

/** Small badge shown on a cell that provides cover (empty for none). */
export function coverBadge(cover: Cell['cover']): string {
  return cover ? COVER_BADGE[cover] : '';
}

/** Distinct terrain/cover styles present on a map, for rendering a legend. */
export function terrainLegendFor(map: BattleMap): { className: string; label: string }[] {
  const seen = new Set<string>();
  const out: { className: string; label: string }[] = [];
  for (const cell of Object.values(map.cells)) {
    const style = terrainStyle(cell.terrain);
    if (style.label !== 'Normal' && !seen.has(style.label)) {
      seen.add(style.label);
      out.push(style);
    }
    if (cell.cover && cell.cover !== 'none' && !seen.has(`cover:${cell.cover}`)) {
      seen.add(`cover:${cell.cover}`);
      out.push({ className: '', label: `${cell.cover.replace('_', '-')} cover ${coverBadge(cell.cover)}` });
    }
  }
  return out;
}
