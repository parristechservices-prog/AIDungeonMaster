import { defineConfig, devices } from '@playwright/test';

// Browser QA for /start and /play. Runs against a local production build
// (`next start`) on port 3100. Screenshots are captured on failure; the suite
// fails on uncaught page errors (see e2e/helpers).
export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: [['list']],
  outputDir: 'test-results',
  use: {
    baseURL: 'http://127.0.0.1:3100',
    screenshot: 'only-on-failure',
    trace: 'off',
    video: 'off',
  },
  projects: [
    { name: 'mobile', use: { ...devices['Pixel 5'], viewport: { width: 390, height: 844 } } },
    { name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1366, height: 768 } } },
  ],
  webServer: {
    command: 'npx next start -p 3100',
    url: 'http://127.0.0.1:3100',
    timeout: 120_000,
    reuseExistingServer: true,
  },
});
