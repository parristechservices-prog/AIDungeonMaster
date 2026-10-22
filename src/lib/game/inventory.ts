/** Returns requested removals that are not actually present, respecting duplicate counts. */
export function missingInventoryItems(inventory: string[], requested: string[]): string[] {
  const available = counts(inventory);
  const missing: string[] = [];
  for (const item of requested) {
    const remaining = available.get(item) ?? 0;
    if (remaining <= 0) missing.push(item);
    else available.set(item, remaining - 1);
  }
  return missing;
}

/** Removes exactly the requested multiset. Caller should check missingInventoryItems first. */
export function removeInventoryItems(inventory: string[], requested: string[]): string[] {
  const removals = counts(requested);
  return inventory.filter((item) => {
    const remaining = removals.get(item) ?? 0;
    if (remaining <= 0) return true;
    removals.set(item, remaining - 1);
    return false;
  });
}

function counts(items: string[]): Map<string, number> {
  const result = new Map<string, number>();
  for (const item of items) result.set(item, (result.get(item) ?? 0) + 1);
  return result;
}
