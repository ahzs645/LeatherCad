import { defineConfig, devices } from '@playwright/test'

const baseURL = 'http://127.0.0.1:41731'
// A second server for the built bundle. The dev server serves modules
// unbundled, so it cannot show a chunking fault; this is the only place the
// app is loaded the way a user loads it.
const previewURL = 'http://127.0.0.1:41732'

// Environments with a system-provided Chromium (sandboxed CI containers that
// pre-install browsers) can point the Chromium-based projects at it instead
// of the revision Playwright would download itself. Applies only to the
// Chromium-based projects, which is all of them today — the mobile project uses the
// iPhone 13 descriptor but overrides defaultBrowserType to chromium in its spec.
const chromiumExecutablePath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH
const chromiumLaunchOverride = chromiumExecutablePath
  ? { launchOptions: { executablePath: chromiumExecutablePath } }
  : {}

export default defineConfig({
  testDir: './e2e',
  // Playwright's 30s default is sized for a DOM app. Half this suite mounts a
  // WebGL canvas, and on a machine with no GPU -- a CI container, a laptop
  // running the whole suite two workers wide -- that mount alone can eat most
  // of a 30s budget, leaving the assertions after it to fail on the clock
  // rather than on the app. Both failure shapes seen here were that: a canvas
  // `waitFor` and a click that never became actionable, each reported as
  // "Test timeout of 30000ms exceeded" and each passing on a quiet machine.
  //
  // Actions inherit this budget (`actionTimeout` is deliberately left unset),
  // so this one number governs the whole suite. It costs nothing when tests
  // pass; it only buys room before a slow machine is called a broken one.
  timeout: 90_000,
  expect: {
    timeout: 5_000,
  },
  fullyParallel: true,
  use: {
    baseURL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  webServer: [
    {
      command: `pnpm dev --host 127.0.0.1 --port ${new URL(baseURL).port} --strictPort`,
      url: baseURL,
      reuseExistingServer: false,
      timeout: 120_000,
    },
    {
      // `vite build` rather than `pnpm build`: the typecheck already ran as its
      // own CI step, and repeating it here only slows the suite down.
      command:
        `pnpm exec vite build && ` +
        `pnpm exec vite preview --host 127.0.0.1 --port ${new URL(previewURL).port} --strictPort`,
      url: previewURL,
      reuseExistingServer: false,
      timeout: 240_000,
    },
  ],
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        ...chromiumLaunchOverride,
      },
      testIgnore: [
        /mobile-smoke\.spec\.ts$/,
        /tablet-smoke\.spec\.ts$/,
        /production-build\.spec\.ts$/,
      ],
    },
    {
      name: 'production-build',
      use: {
        ...devices['Desktop Chrome'],
        baseURL: previewURL,
        ...chromiumLaunchOverride,
      },
      testMatch: /production-build\.spec\.ts$/,
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
      // The spec overrides defaultBrowserType to chromium, so it needs the same
      // system-Chromium override as the projects above — without it the run tries
      // to launch a Playwright-pinned revision the sandbox has not downloaded.
      name: 'mobile',
      use: {
        ...devices['iPhone 13'],
        ...chromiumLaunchOverride,
      },
      testMatch: /mobile-smoke\.spec\.ts$/,
    },
  ],
})
