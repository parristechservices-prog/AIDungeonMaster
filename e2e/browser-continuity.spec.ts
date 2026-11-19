import { expect, test } from '@playwright/test';
import { expectNoHorizontalOverflow } from './helpers';

test('preserves a wizard, location and narration after browser reload', async ({ page }) => {
  await page.goto('/start');
  await page.getByRole('button', { name: /^Wizard /i }).click();
  await page.getByRole('button', { name: /Nightstone Chapter 1 expanded/i }).click();
  await expectNoHorizontalOverflow(page);

  const started = page.waitForResponse(response => response.url().endsWith('/api/session/start'));
  await page.getByRole('button', { name: /begin quest/i }).click();
  const initial = await (await started).json();
  expect(initial.ok).toBe(true);
  const wizard = initial.state.party[0];
  expect(wizard.className).toBe('Wizard');

  const composer = page.getByLabel('Player action');
  await expect(composer).toBeEnabled();
  const next = page.waitForResponse(response => response.url().endsWith('/api/turn'));
  await composer.fill('I look around from here without moving.');
  await composer.press('Enter');
  const turn = await (await next).json();
  expect(turn.ok).toBe(true);
  expect(turn.state.party[0]).toMatchObject({ id: wizard.id, className: 'Wizard' });
  expect(turn.state.exploration.locations[wizard.id]).toBe(initial.state.exploration.locations[wizard.id]);
  await expect(page.getByLabel('Adventure narration')).toContainText(turn.narration);

  await page.reload();
  await expect(composer).toBeEnabled();
  await expect(page.getByLabel('Adventure narration')).toContainText(turn.narration);
  await expectNoHorizontalOverflow(page);

  const resumed = page.waitForResponse(response => response.url().endsWith('/api/turn'));
  await composer.fill('Where am I standing now?');
  await composer.press('Enter');
  const resumedResponse = await resumed;
  if (initial.browserSave) {
    expect(resumedResponse.request().postDataJSON().browserSave).toBe(turn.browserSave);
  }
  const another = await resumedResponse.json();
  expect(another.ok).toBe(true);
  expect(another.state.party[0]).toMatchObject({ id: wizard.id, className: 'Wizard' });
  expect(another.recap.turnNumber).toBe(turn.recap.turnNumber + 1);
});
