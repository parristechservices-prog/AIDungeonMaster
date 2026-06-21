import type { GameState } from '@/lib/game/types';

export type NarrationEngineResult = {
  kind: string;
  summary: string;
  ok: boolean;
  breakdown?: { rolls: number[]; total: number };
  spatial?: import('@/lib/engine/spatial').SpatialEngineResult;
  tactical?: import('@/lib/engine/spatial/tactical').TacticalEngineResult;
  opportunityAttacks?: import('@/lib/engine/types').OpportunityAttackOutcome[];
};

/**
 * Scans DM narration for numeric claims that contradict engine state.
 * Does not block turns — returns warnings for logging and optional UI display.
 */
export function validateNarrationAgainstState(
  narration: string,
  state: GameState,
): string[] {
  const warnings: string[] = [];
  const text = narration.toLowerCase();

  const hpPatterns = [
    /\b(\d+)\s*\/\s*(\d+)\s*hp\b/gi,
    /\bhp[:\s]+(\d+)\s*\/\s*(\d+)\b/gi,
    /\b(\d+)\s*hit points?\b/gi,
    /\byou have\s+(\d+)\s+hp\b/gi,
  ];

  for (const player of state.party) {
    const name = player.name.toLowerCase();
    const refersToActiveCharacter =
      player.id === state.activeCharacterId && /\b(you|your)\b/i.test(narration);
    if (!text.includes(name) && !refersToActiveCharacter) continue;

    for (const pattern of hpPatterns) {
      let match: RegExpExecArray | null;
      const re = new RegExp(pattern.source, pattern.flags);
      while ((match = re.exec(narration)) !== null) {
        const current = Number(match[1]);
        const max = match[2] ? Number(match[2]) : player.maxHp;
        if (current !== player.hp || (match[2] && max !== player.maxHp)) {
          warnings.push(
            `${player.name}: Narration claims HP ${current}${match[2] ? `/${max}` : ''}; engine has ${player.hp}/${player.maxHp}.`,
          );
        }
      }
    }

    const acMatch =
      text.match(new RegExp(`\\b${name}.*?\\bac\\s*(?:is|:)\\s*(\\d+)\\b`, 'i')) ??
      text.match(new RegExp(`\\b${name}.*?\\barmor class\\s*(?:is|:)\\s*(\\d+)\\b`, 'i')) ??
      (refersToActiveCharacter
        ? text.match(/\byour\s+ac\s*(?:is|:)?\s*(\d+)\b/i) ??
          text.match(/\byour\s+armor class\s*(?:is|:)?\s*(\d+)\b/i)
        : null);
    if (acMatch && Number(acMatch[1]) !== player.ac) {
      warnings.push(`${player.name}: Narration claims AC ${acMatch[1]}; engine has ${player.ac}.`);
    }

    for (const match of narration.matchAll(/level\s+(\d+)\s+spell slots?\s+(?:remaining|left)[:\s]+(\d+)/gi)) {
      const level = Number(match[1]);
      const remaining = Number(match[2]);
      if ((player.spellSlots[level]?.remaining ?? 0) !== remaining) {
        warnings.push(`${player.name}: Narration claims ${remaining} level ${level} spell slots; engine has ${player.spellSlots[level]?.remaining ?? 0}.`);
      }
    }
  }

  for (const monster of state.monsters) {
    const name = monster.name.toLowerCase();
    if (!text.includes(name)) continue;
    if (monster.hp > 0) continue;
    const segment = extractSentenceAround(text, name);
    const dmg = segment.match(/(\d+)\s+damage/);
    // A downed monster taking an active, offensive action contradicts engine state.
    const actsWhileDown =
      /\b(attacks?|strikes?|lunges?|swings?|charges?|hits?|slashes?|bites?|claws?|casts?|advances?|rushes?|leaps?|snarls?|growls?|rises?|stands?\s+up|gets?\s+up|retaliates?|counterattacks?)\b/.test(
        segment,
      );
    if (dmg || actsWhileDown) {
      warnings.push(`Narration may imply ${monster.name} is still active; engine has 0 HP.`);
    }
  }

  return [...new Set(warnings)];
}

export function validateNarrationAgainstResults(
  narration: string,
  results: NarrationEngineResult[],
): string[] {
  const warnings: string[] = [];
  const text = narration.toLowerCase();
  const claimsSuccess = /\b(succeeds?|successful|hits?|lands?|finds?|discovers?|unlocks?|defeats?|kills?)\b/i.test(narration);
  const claimsFailure = /\b(fails?|failure|miss(?:es|ed)?|cannot|does not|unsuccessful)\b/i.test(narration);

  for (const result of results) {
    if (!result.ok && claimsSuccess) {
      warnings.push(`${result.kind}: Narration claims success but the engine result failed.`);
    }
    if (result.ok && claimsFailure) {
      warnings.push(`${result.kind}: Narration claims failure but the engine result succeeded.`);
    }
  }

  const lastMove = results.findLast((result) => result.spatial?.kind === 'move_area')?.spatial;
  if (impliesSpatialArrival(narration)) {
    if (!lastMove) {
      warnings.push('Spatial: Narration implies movement or arrival, but no move_area request was issued.');
    } else if (lastMove.kind === 'move_area' && !lastMove.ok) {
      warnings.push(`Spatial: Narration implies movement or arrival, but move_area failed (${lastMove.reason}).`);
    }
  }

  // Tactical drift: prose that claims a creature closed distance / struck a foe
  // when the engine denied the move or the attack was out of reach/range.
  for (const result of results) {
    const tac = result.tactical;
    if (!tac) continue;
    if (tac.kind === 'move_creature' && !tac.result.ok && impliesSpatialArrival(narration)) {
      warnings.push(`Tactical: Narration implies movement, but move_creature failed (${tac.result.reason}).`);
    }
    if (tac.kind === 'check_line_of_sight' && !tac.ok && impliesAttackLands(narration)) {
      warnings.push(`Tactical: Narration implies a clear attack, but the engine reported ${tac.reason ?? 'no clear shot'}.`);
    }
  }

  // Opportunity-attack drift: prose must match what the engine actually resolved.
  const oas = results.flatMap((r) => r.opportunityAttacks ?? []);
  const engineOaHit = oas.some((o) => o.hit);
  const narrationOa = /\bopportunity attack|parting (?:blow|strike|shot)|as (?:you|they|it) (?:flee|retreat|withdraw|pull away)\b/i.test(narration);
  if (engineOaHit && !narrationOa) {
    warnings.push('Tactical: The engine resolved an opportunity attack, but the narration does not mention it.');
  }
  if (!oas.length && narrationOa && impliesAttackLands(narration)) {
    warnings.push('Tactical: Narration describes an opportunity attack the engine did not resolve.');
  }

  const allowedNumbers = new Set(
    results.flatMap((result) => result.breakdown ? [...result.breakdown.rolls, result.breakdown.total] : []),
  );
  for (const match of text.matchAll(/\b(?:rolled?|roll of|dealt?|takes?|for)\s+(\d+)\s*(?:damage)?\b/gi)) {
    const claimed = Number(match[1]);
    if (allowedNumbers.size > 0 && !allowedNumbers.has(claimed)) {
      warnings.push(`Narration claims unsupported roll or damage value ${claimed}.`);
    }
  }

  return [...new Set(warnings)];
}

function impliesAttackLands(narration: string): boolean {
  return /\b(strikes?|hits?|lands? a (?:blow|hit|shot)|slashes?|stabs?|skewers?|cuts? down|shoots?|fells?|cleaves?)\b/i.test(narration);
}

function impliesSpatialArrival(narration: string): boolean {
  return /\b(arrive[sd]?|enter(?:s|ed)?|reach(?:es|ed)?|move[sd]? into|walk(?:s|ed)? into|step(?:s|ped)? into|head(?:s|ed)? (?:to|toward|into)|go(?:es|ne)? (?:to|toward|into)|make(?:s| made) (?:your|their|his|her|our) way to|cross(?:es|ed)? into|pass(?:es|ed)? through)\b/i.test(narration);
}

export function buildEngineSafeNarration(results: NarrationEngineResult[]): string {
  if (results.length === 0) {
    return 'I am not quite sure how to resolve that fairly. Try naming who acts and what they are doing.';
  }
  return results.map((result) => result.summary).join(' ');
}

function extractSentenceAround(text: string, needle: string): string {
  const idx = text.indexOf(needle);
  if (idx < 0) return text;
  const start = Math.max(0, text.lastIndexOf('.', idx) + 1);
  const end = text.indexOf('.', idx);
  return text.slice(start, end > 0 ? end : undefined);
}
