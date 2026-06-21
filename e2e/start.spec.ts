import { test, expect } from '@playwright/test';
import { expectNoHorizontalOverflow, startGame, trackPageErrors } from './helpers';

test.describe('/start flow', () => {
  test('loads, has no horizontal overflow, and can begin a quest', async ({ page }) => {
    const errors = trackPageErrors(page);
    await page.goto('/start');

    await expect(page.getByRole('button', { name: /begin quest/i })).toBeVisible();
    await expectNoHorizontalOverflow(page);

    // Adventure + character + persona selectors are present.
    await expect(page.getByText(/adventure|scenario|quest/i).first()).toBeVisible();

    await page.screenshot({ path: 'test-results/screenshots/start.png', fullPage: true });

    await startGame(page);
    // Landed on /play with a usable composer.
    await expect(page.getByLabel('Player action')).toBeVisible();
    await expect(page.getByRole('button', { name: /^send$|…/i })).toBeVisible();

    expect(errors, errors.join('\n')).toEqual([]);
  });
});
