import type { GameState } from '@/lib/game/types';

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
  }

  for (const monster of state.monsters) {
    const name = monster.name.toLowerCase();
    if (!text.includes(name)) continue;
    const segment = extractSentenceAround(text, name);
    const dmg = segment.match(/(\d+)\s+damage/);
    if (dmg && monster.hp <= 0) {
      warnings.push(`Narration may imply ${monster.name} is still active; engine has 0 HP.`);
    }
  }

  return [...new Set(warnings)];
}

function extractSentenceAround(text: string, needle: string): string {
  const idx = text.indexOf(needle);
  if (idx < 0) return text;
  const start = Math.max(0, text.lastIndexOf('.', idx) + 1);
  const end = text.indexOf('.', idx);
  return text.slice(start, end > 0 ? end : undefined);
}
