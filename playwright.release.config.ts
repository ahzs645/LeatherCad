import { defineConfig, devices } from '@playwright/test'

const baseURL = process.env.LEATHERCAD_RELEASE_URL || 'http://127.0.0.1:41742'
export default defineConfig({
  testDir: './e2e', testMatch: /(?:production-build|manufacturing|native-curves|interchange)\.spec\.ts$/,
  timeout: 90_000, workers: 1,
  use: { ...devices['Desktop Chrome'], baseURL, trace: 'retain-on-failure', screenshot: 'only-on-failure', launchOptions: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH } : {} },
  webServer: {
    command: `node node_modules/vite/bin/vite.js preview --host 127.0.0.1 --port ${new URL(baseURL).port} --strictPort`,
    url: baseURL,
    env: { VITE_BASE_PATH: new URL(baseURL).pathname },
    reuseExistingServer: false,
  },
})
