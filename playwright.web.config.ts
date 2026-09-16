import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './tests', testMatch: 'image-gallery.spec.ts',
  timeout: 30_000, workers: 1, retries: 0,
  reporter: process.env.CI ? 'github' : 'list',
  webServer: { command: 'node scripts/serve-web.mjs', url: 'http://127.0.0.1:4174', reuseExistingServer: false },
});
