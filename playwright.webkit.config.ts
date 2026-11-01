import { defineConfig, devices } from '@playwright/test'

const baseURL = 'http://127.0.0.1:41744'
export default defineConfig({
  testDir: './e2e',
  timeout: 90_000,
  workers: 1,
  retries: 0,
  use: { baseURL, trace: 'retain-on-failure', screenshot: 'only-on-failure' },
  webServer: {
    command: 'node node_modules/vite/bin/vite.js --host 127.0.0.1 --port 41744 --strictPort',
    env: { VITE_CACHE_DIR: 'node_modules/.vite-webkit' },
    url: baseURL,
    reuseExistingServer: false,
  },
  projects: [
    { name: 'webkit-desktop', use: { ...devices['Desktop Safari'] },
      testMatch: /(?:recovery|interchange|physical-output|manufacturing|calibration)\.spec\.ts$/ },
    { name: 'webkit-phone', use: { ...devices['iPhone 13'] },
      testMatch: /browser-compatibility\.spec\.ts$/ },
  ],
})
