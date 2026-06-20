import { defineConfig, devices } from '@playwright/test';

function parseWorkerCount(value: string | undefined): number {
  if (value == null || value.length === 0) return 3;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) {
    throw new Error(`ZD_PLAYWRIGHT_WORKERS must be a positive integer, got: ${value}`);
  }
  return parsed;
}

export default defineConfig({
  testDir: './ui',
  testMatch: 'visual-*.test.ts',
  outputDir: './ui/reports/visual-test-results',
  timeout: Number(process.env.ZD_PLAYWRIGHT_TIMEOUT) || 60_000,
  expect: {
    timeout: 10_000,
  },
  retries: 0,
  fullyParallel: process.env.ZD_PLAYWRIGHT_FULLY_PARALLEL === '1',
  workers: parseWorkerCount(process.env.ZD_PLAYWRIGHT_WORKERS),
  reporter: process.env.CI
    ? [['github'], ['list'], ['json', { outputFile: './ui/reports/visual-results.json' }]]
    : [['list'], ['json', { outputFile: './ui/reports/visual-results.json' }]],
  use: {
    ...devices['Desktop Chrome'],
    trace: 'off',
    screenshot: 'off',
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 1,
  },
});
