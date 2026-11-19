import { expect, test } from '@playwright/test';
import { startGame } from './helpers';

test('reload restores an outstanding physical dice prompt and accepts its roll', async ({ page }) => {
  await startGame(page, 'Nightstone Chapter 1 expanded');
  const moreOptions = page.getByRole('button', { name: /^More options/ });
  if (await moreOptions.isVisible()) await moreOptions.click();
  await page.getByLabel('Use physical dice').check();
  const composer = page.getByLabel('Player action');
  await composer.fill('I search for tracks.');
  await composer.press('Enter');
  const prompt = page.getByRole('heading', { name: 'Physical Roll Required' });
  await expect(prompt).toBeVisible();
  await page.reload();
  await expect(prompt).toBeVisible();
  await page.getByRole('spinbutton').fill('17');
  const resolved = page.waitForResponse(response => response.url().endsWith('/api/turn'));
  await page.getByRole('button', { name: 'Confirm' }).click();
  expect(await (await resolved).json()).toMatchObject({ ok: true, needsManualRoll: false, recap: { turnNumber: 2 } });
  await expect(prompt).toBeHidden();
});

test('dictation review, auto-send and built-in narration use the browser interfaces', async ({ page }) => {
  await page.addInitScript(() => {
    class DemoSpeechRecognition {
      onresult?: (event: { results: { transcript: string }[][] }) => void;
      onend?: () => void;
      start() {
        setTimeout(() => {
          this.onresult?.({ results: [[{ transcript: 'I look around.' }]] });
          this.onend?.();
        }, 0);
      }
      stop() { this.onend?.(); }
    }
    class DemoUtterance {
      text: string;
      onend?: () => void;
      constructor(text: string) { this.text = text; }
    }
    Object.defineProperty(window, 'SpeechRecognition', { value: DemoSpeechRecognition });
    Object.defineProperty(window, 'SpeechSynthesisUtterance', { value: DemoUtterance });
    Object.defineProperty(window, 'speechSynthesis', { value: {
      speak(line: DemoUtterance) {
        document.documentElement.dataset.testNarration = line.text;
        setTimeout(() => line.onend?.(), 0);
      },
      cancel() {},
    } });
  });
  await startGame(page, 'Nightstone Chapter 1 expanded');
  const moreOptions = page.getByRole('button', { name: /^More options/ });
  if (await moreOptions.isVisible()) await moreOptions.click();
  await page.getByText('Voice DM', { exact: true }).click();
  await page.getByRole('button', { name: 'Read with browser voice' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-test-narration', /Nightstone/i);

  const speak = page.getByRole('button', { name: 'Speak action' });
  await speak.click();
  await expect(page.getByLabel('Player action')).toHaveValue('I look around.');
  await page.getByLabel('Auto-send').check();
  const result = page.waitForResponse(response => response.url().endsWith('/api/turn'));
  await speak.click();
  expect(await (await result).json()).toMatchObject({ ok: true });
});
