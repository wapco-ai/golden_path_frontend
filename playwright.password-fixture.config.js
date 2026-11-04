import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './tests/browser',
  timeout: 60000,
  workers: 1,
  use: { baseURL: 'http://127.0.0.1:5179', viewport: { width: 1440, height: 1000 }, launchOptions: process.env.GP_TEST_CHROMIUM ? { executablePath: process.env.GP_TEST_CHROMIUM } : {} },
  webServer: { command: 'npm run dev -- --host 127.0.0.1 --port 5179 --strictPort', url: 'http://127.0.0.1:5179', reuseExistingServer: false }
});

