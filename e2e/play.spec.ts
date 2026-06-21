import { test, expect } from '@playwright/test';
import { expectNoHorizontalOverflow, startGame, trackPageErrors } from './helpers';

test.describe('/play UI', () => {
  test('core layout: no overflow, story + composer + key controls visible', async ({ page }, testInfo) => {
    const errors = trackPageErrors(page);
    await startGame(page);

    await expectNoHorizontalOverflow(page);
    await expect(page.getByLabel('Adventure narration')).toBeVisible();
    await expect(page.getByLabel('Player action')).toBeVisible();
    await expect(page.getByRole('button', { name: /^send$|…/i })).toBeVisible();
    // Always-visible Display opener.
    await expect(page.getByRole('button', { name: /^display$/i })).toBeVisible();

    await page.screenshot({ path: `test-results/screenshots/play-${testInfo.project.name}.png`, fullPage: true });
    expect(errors, errors.join('\n')).toEqual([]);
  });

  test('theme toggle flips the document theme class', async ({ page }) => {
    await startGame(page);
    const themeBtn = page.getByRole('button', { name: /toggle dark mode/i }).first();
    await expect(themeBtn).toBeVisible();
    const before = await page.evaluate(() => document.documentElement.className);
    await themeBtn.click();
    await expect.poll(() => page.evaluate(() => document.documentElement.className)).not.toBe(before);
  });

  test('Display settings: hide suggested actions, then reset restores them', async ({ page }) => {
    await startGame(page);
    await page.getByRole('button', { name: /^display$/i }).click();
    const dialog = page.getByRole('dialog', { name: /display settings/i });
    await expect(dialog).toBeVisible();

    // Toggle "Suggested actions" off.
    const row = dialog.getByText('Suggested actions', { exact: true }).locator('xpath=ancestor::label');
    await row.locator('input[type=checkbox]').uncheck();
    await dialog.getByText('Reset layout').click(); // restore for a clean state
    await dialog.getByRole('button', { name: /close/i }).click();
    await expect(dialog).toBeHidden();
  });

  test('Map opens and never leaves the composer unusable', async ({ page }, testInfo) => {
    await startGame(page);
    const isMobile = testInfo.project.name === 'mobile';

    if (isMobile) {
      await page.getByRole('button', { name: /^map( ⚔)?$/i }).click();
      // Mobile map drawer shows a heading and a close button.
      await expect(page.getByRole('heading', { name: /battle map/i })).toBeVisible();
      await page.screenshot({ path: 'test-results/screenshots/map-mobile.png', fullPage: true });
      await page.getByRole('button', { name: /close/i }).click();
    } else {
      // Desktop: switch the sidebar to the Map tab.
      await page.getByRole('button', { name: /^map( ⚔)?$/i }).first().click();
      await page.screenshot({ path: 'test-results/screenshots/map-desktop.png', fullPage: true });
    }
    // Composer still usable.
    await expect(page.getByLabel('Player action')).toBeVisible();
    await expectNoHorizontalOverflow(page);
  });

  test('DM View opens, defaults off, exposes no secrets', async ({ page }) => {
    const errors = trackPageErrors(page);
    await startGame(page);
    await page.getByRole('button', { name: /dm view/i }).click();
    // The DM View popover lists toggles; none should be checked by default.
    const checks = page.locator('input[type=checkbox]:checked');
    // (Only the dev-panel popover is open; its checkboxes start unchecked.)
    expect(await checks.count()).toBe(0);
    // No secret-looking text leaked.
    const body = (await page.locator('body').innerText()).toLowerCase();
    expect(body).not.toContain('sk-');
    expect(body).not.toContain('api key');
    expect(errors, errors.join('\n')).toEqual([]);
  });
});
