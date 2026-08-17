import { defineConfig, devices } from '@playwright/test'

const baseURL = 'http://127.0.0.1:41731'

// Environments with a system-provided Chromium (sandboxed CI containers that
// pre-install browsers) can point the Chromium-based projects at it instead
// of the revision Playwright would download itself. Applies only to the
// chromium/tablet projects; the mobile project runs WebKit.
const chromiumExecutablePath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH
const chromiumLaunchOverride = chromiumExecutablePath
  ? { launchOptions: { executablePath: chromiumExecutablePath } }
  : {}

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
    command: `pnpm dev --host 127.0.0.1 --port ${new URL(baseURL).port} --strictPort`,
    url: baseURL,
    reuseExistingServer: false,
    timeout: 120_000,
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        ...chromiumLaunchOverride,
      },
      testIgnore: [/mobile-smoke\.spec\.ts$/, /tablet-smoke\.spec\.ts$/],
    },
    {
      // Crosses the 1100px mobile breakpoint defined in the editor layout.
      name: 'tablet',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1024, height: 768 },
        ...chromiumLaunchOverride,
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
