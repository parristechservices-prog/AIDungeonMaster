import { expect, type Page } from '@playwright/test';

/** Attaches console-error / pageerror capture. Returns the collected errors. */
export function trackPageErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(`console.error: ${msg.text()}`);
  });
  return errors;
}

/** Asserts the document does not scroll horizontally (allowing 1px rounding). */
export async function expectNoHorizontalOverflow(page: Page) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow, 'horizontal overflow (scrollWidth - clientWidth)').toBeLessThanOrEqual(1);
}

/** Drives /start → /play with the default party, returning when /play is ready. */
export async function startGame(page: Page, adventureName?: string) {
  await page.goto('/start');
  await expect(page.getByRole('button', { name: /begin quest/i })).toBeVisible();
  if (adventureName) {
    const card = page.getByRole('button', { name: new RegExp(adventureName, 'i') }).first();
    if (await card.count()) await card.click();
  }
  await page.getByRole('button', { name: /begin quest/i }).click();
  await page.waitForURL(/\/play/, { timeout: 30_000 });
  // /play is ready once the composer input is present.
  await expect(page.getByLabel('Player action')).toBeVisible({ timeout: 20_000 });
}
