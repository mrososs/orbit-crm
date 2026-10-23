import { defineConfig, devices } from '@playwright/test';

const PORT = 4310;

/**
 * E2E tests run against the production build served with SPA fallback.
 * Run `npm run build` first (or `npm run e2e`, which does both).
 */
export default defineConfig({
  testDir: './e2e',
  timeout: 45_000,
  expect: { timeout: 8_000 },
  fullyParallel: true,
  retries: process.env['CI'] ? 1 : 0,
  reporter: [['list']],
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'desktop',
      testIgnore: /mobile\.spec\.ts/,
      use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } },
    },
    {
      name: 'mobile',
      testMatch: /mobile\.spec\.ts/,
      use: { ...devices['Pixel 7'], viewport: { width: 390, height: 844 } },
    },
  ],
  webServer: {
    command: `node scripts/serve-dist.mjs ${PORT}`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !process.env['CI'],
    timeout: 30_000,
  },
});
