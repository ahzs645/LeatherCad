import { defineConfig, devices } from '@playwright/test'

const entryURL = new URL(process.env.LEATHERCAD_RELEASE_URL || 'http://127.0.0.1:41742/')
if (!['http:', 'https:'].includes(entryURL.protocol) || entryURL.search || entryURL.hash || entryURL.username || entryURL.password) {
  throw new Error('LEATHERCAD_RELEASE_URL must be an HTTP(S) app directory URL without query, fragment or credentials')
}
if (!entryURL.pathname.endsWith('/')) entryURL.pathname += '/'
const baseURL = entryURL.href
const serveLocal = entryURL.protocol === 'http:' && ['127.0.0.1', 'localhost', '[::1]'].includes(entryURL.hostname)
if (serveLocal && !entryURL.port) throw new Error('A local LEATHERCAD_RELEASE_URL needs an explicit preview port')
const previewHost = entryURL.hostname.replace(/^\[|\]$/g, '')
export default defineConfig({
  testDir: './e2e', testMatch: /(?:production-build|manufacturing|calibration|native-curves|interchange|physical-output)\.spec\.ts$/,
  timeout: 90_000, workers: 1,
  use: { ...devices['Desktop Chrome'], baseURL, trace: 'retain-on-failure', screenshot: 'only-on-failure', launchOptions: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH } : {} },
  webServer: serveLocal ? {
    command: `node node_modules/vite/bin/vite.js preview --host ${previewHost} --port ${entryURL.port} --strictPort`,
    url: baseURL,
    env: { VITE_BASE_PATH: entryURL.pathname },
    reuseExistingServer: false,
  } : undefined,
})
