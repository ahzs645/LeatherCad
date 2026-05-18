import { defineConfig, devices } from '@playwright/test'

const baseURL = 'http://127.0.0.1:41731'

export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  expect: {
    timeout: 5_000,
  },
  fullyParallel: true,
  use: {
    baseURL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  webServer: {
    command: `npm run dev -- --host 127.0.0.1 --port ${new URL(baseURL).port} --strictPort`,
    url: baseURL,
    reuseExistingServer: false,
    timeout: 120_000,
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
      },
      testIgnore: [/mobile-smoke\.spec\.ts$/, /tablet-smoke\.spec\.ts$/],
    },
    {
      // Crosses the 1100px mobile breakpoint defined in the editor layout.
      name: 'tablet',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1024, height: 768 },
      },
      testMatch: /tablet-smoke\.spec\.ts$/,
    },
    {
      name: 'mobile',
      use: {
        ...devices['iPhone 13'],
      },
      testMatch: /mobile-smoke\.spec\.ts$/,
    },
  ],
})
