// Z-axis falling resolution. The engine decides whether a creature falls and
// how much damage it takes; narration never invents fall outcomes.

import { getCell } from './grid';
import type { BattleMap, SpatialActor } from './types';

export interface FallResult {
  fell: boolean;
  fallenFromFt?: number;
  fallenToFt?: number;
  distanceFt?: number;
  /** 5e: 1d6 bludgeoning per 10 ft fallen, capped at 20d6. */
  damageDiceD6?: number;
}

/**
 * Resolves falling for one actor: if it is above its cell's floor, not flying,
 * and has no valid support, it drops to the floor and takes 5e fall damage.
 * Returns the updated map and a structured result for the caller to apply the
 * damage roll through the normal combat pipeline.
 */
export function resolveFalling(map: BattleMap, actorId: string): { map: BattleMap; result: FallResult } {
  const actor = map.actors[actorId];
  const pos = map.positions[actorId];
  if (!actor || !pos) return { map, result: { fell: false } };

  const floorFt = getCell(map, pos).elevationFt ?? 0;
  const currentZ = pos.z ?? 0;
  if (actor.flying || currentZ <= floorFt) return { map, result: { fell: false } };

  const distanceFt = currentZ - floorFt;
  const damageDiceD6 = Math.min(20, Math.floor(distanceFt / 10));
  const nextMap: BattleMap = {
    ...map,
    positions: { ...map.positions, [actorId]: { ...pos, z: floorFt } },
    // A fall knocks the creature prone (5e) once it takes any damage.
    actors: damageDiceD6 > 0 ? { ...map.actors, [actorId]: { ...actor, prone: true } as SpatialActor } : map.actors,
  };

  return {
    map: nextMap,
    result: { fell: true, fallenFromFt: currentZ, fallenToFt: floorFt, distanceFt, damageDiceD6 },
  };
}
