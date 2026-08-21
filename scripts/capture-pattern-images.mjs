/**
 * Capture the documentation images for the seam, fold and assembly review.
 *
 * The pictures are taken from the running app rather than drawn by hand, so a
 * change that breaks the seam lines, the assembly angle, the sew scrubber or the
 * fold timeline shows up the next time this is run. Everything is driven through
 * the same controls a maker uses — there is no back door into the state.
 *
 *   pnpm dev                                   # in one terminal
 *   node scripts/capture-pattern-images.mjs    # in another
 *
 * Options:
 *   --base-url  where the app is served (default http://127.0.0.1:5199)
 *   --out       where to write the PNGs (default docs/images)
 *   --only      comma separated image names, for re-taking one picture
 *
 * The 3D preview is rendered by Swiftshader here rather than a GPU, so a full
 * run takes a few minutes. Each shot waits for the scene to settle rather than
 * racing it.
 */

import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { chromium } from '@playwright/test'

const args = new Map()
for (let index = 2; index < process.argv.length; index += 1) {
  const [key, value] = process.argv[index].replace(/^--/, '').split('=')
  args.set(key, value ?? process.argv[++index])
}

const BASE_URL = args.get('base-url') ?? 'http://127.0.0.1:5199'
const OUT_DIR = path.resolve(process.cwd(), args.get('out') ?? 'docs/images')
const ONLY = args.get('only') ? new Set(args.get('only').split(',')) : null
const VIEWPORT = { width: 1360, height: 820 }

/**
 * Find a Chromium to drive.
 *
 * Playwright resolves its own download by default. On a machine where the
 * browsers live elsewhere — a preinstalled image, or a pinned version that does
 * not match this checkout's — set PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH, the same
 * variable `playwright.config.ts` reads, or let this find one under
 * PLAYWRIGHT_BROWSERS_PATH.
 */
function resolveChromium() {
  if (process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH) {
    return process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH
  }
  const root = process.env.PLAYWRIGHT_BROWSERS_PATH
  if (!root || !fs.existsSync(root)) {
    return undefined
  }
  for (const entry of fs.readdirSync(root).sort().reverse()) {
    if (!entry.startsWith('chromium-')) {
      continue
    }
    const candidate = path.join(root, entry, 'chrome-linux', 'chrome')
    if (fs.existsSync(candidate)) {
      return candidate
    }
  }
  return undefined
}

const LAUNCH = {
  args: ['--no-sandbox', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'],
  executablePath: resolveChromium(),
}

/**
 * Set a range input the way a drag would, rather than through `fill`.
 *
 * React listens for the native input event, and assigning `value` on the element
 * directly does not fire one — the setter has to be called off the prototype.
 */
async function setRange(locator, value) {
  await locator.waitFor()
  await locator.evaluate((element, next) => {
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
    setter.call(element, String(next))
    element.dispatchEvent(new Event('input', { bubbles: true }))
    element.dispatchEvent(new Event('change', { bubbles: true }))
  }, value)
}

function card(page, heading) {
  return page.locator('.fold-control-card').filter({ hasText: heading })
}

async function loadPreset(page, presetId) {
  await page.getByRole('tab', { name: 'Output' }).click()
  await page.getByRole('button', { name: 'Templates', exact: true }).click()
  await page.getByRole('tab', { name: 'Presets' }).click()
  await page.getByLabel('Workspace preset').selectOption(presetId)
  await page.getByRole('button', { name: 'Load Preset' }).click()
  await page.waitForTimeout(1200)
  await page.getByRole('button', { name: 'Done' }).click()
  await page.waitForTimeout(1000)
}

async function openPreviewInspector(page) {
  await page.getByRole('tab', { name: 'Preview 3D' }).click()
  await page.waitForTimeout(400)
}

async function setPreviewMode(page, mode) {
  await openPreviewInspector(page)
  await page.locator('.control-block select').first().selectOption(mode)
  await page.waitForTimeout(1600)
}

/**
 * Bring the pieces together before photographing an assembly.
 *
 * The preview ships with a small exploded factor so a fresh document reads as
 * separate pieces; that is the wrong picture for a seam that is supposed to be
 * closed.
 */
async function setExploded(page, value) {
  await setRange(page.locator('.control-block input[type="range"]').first(), value)
  await page.waitForTimeout(800)
}

async function setAssemblyAngle(page, degrees) {
  await setRange(card(page, 'Assemble from seams').locator('input[type="range"]'), degrees)
  await page.waitForTimeout(1400)
}

async function shoot(page, name, options = {}) {
  if (ONLY && !ONLY.has(name)) {
    return
  }
  if (options.scrollTo) {
    await page.locator(options.scrollTo).first().scrollIntoViewIfNeeded()
  }
  await page.waitForTimeout(options.settleMs ?? 1200)
  const target = options.selector ? page.locator(options.selector) : page
  // JPEG rather than PNG: these are photographs of a shaded 3D render, and a
  // noisy one compresses badly without loss. The whole set costs a couple of
  // megabytes this way against eight as PNG, and the UI text stays legible.
  await target.screenshot({ path: path.join(OUT_DIR, `${name}.jpg`), type: 'jpeg', quality: 80 })
  process.stdout.write(`  ${name}.jpg\n`)
}

const SEAM_PATTERNS = [
  { id: 'card-case', label: 'Two-Panel Card Case' },
  { id: 'boxed-pouch', label: 'Boxed Zip Pouch' },
  { id: 'dice-cup', label: 'Round Dice Cup' },
  { id: 'tote-bag', label: 'Tote Bag' },
]

/** The pattern whose seams are photographed closing one stitch at a time. */
const SEW_ORDER_PATTERN = 'tote-bag'

async function captureSeamShots(page) {
  for (const pattern of SEAM_PATTERNS) {
    process.stdout.write(`${pattern.label}\n`)
    await loadPreset(page, pattern.id)

    // Flat on the 2D canvas, with the pieces and seams listed down the left.
    await page.getByTestId('workspace-mode-2d').click()
    await shoot(page, `${pattern.id}-flat`)

    await page.getByTestId('workspace-mode-3d').click()
    await page.waitForTimeout(2000)
    await setPreviewMode(page, 'assembled')
    await setExploded(page, 0)

    for (const degrees of [0, 90, 180]) {
      await setAssemblyAngle(page, degrees)
      await shoot(page, `${pattern.id}-assembled-${String(degrees).padStart(3, '0')}`, {
        settleMs: 1600,
      })
    }

    if (pattern.id === SEW_ORDER_PATTERN) {
      await captureSewOrderShots(page, pattern.id)
    }
  }
}

/**
 * The sew scrubber walking one project shut.
 *
 * The seams are laid end to end on one stitch axis in the order they are sewn,
 * so these three frames are the same model with the needle at the start, part
 * way through, and finished.
 */
async function captureSewOrderShots(page, patternId) {
  await setAssemblyAngle(page, 90)
  const slider = card(page, 'Sew order').locator('input[type="range"]')
  await slider.waitFor()
  const total = Number(await slider.getAttribute('max'))
  const frames = [
    ['unsewn', 0],
    ['part', Math.round(total / 3)],
    ['most', Math.round((total * 2) / 3)],
    ['sewn', total],
  ]
  for (const [name, value] of frames) {
    await setRange(slider, value)
    await shoot(page, `${patternId}-sewing-${name}`, {
      settleMs: 1600,
      scrollTo: '.fold-control-card:has-text("Sew order")',
    })
  }
}

async function captureFoldShots(page) {
  process.stdout.write('Trifold Wallet Prototype\n')
  await loadPreset(page, 'trifold')
  await page.getByTestId('workspace-mode-3d').click()
  await page.waitForTimeout(2000)
  await setPreviewMode(page, 'final')

  const progress = page.getByLabel('Final fold progress')
  for (const [name, value] of [['flat', 0], ['half', 0.5], ['closed', 1]]) {
    await setRange(progress, value)
    await shoot(page, `trifold-fold-${name}`, {
      settleMs: 2000,
      // Keep the scrubber that drives the fold in frame with the model it folds.
      scrollTo: '.field-row:has-text("Fold Progress")',
    })
  }
}

async function captureSplitShot(page) {
  process.stdout.write('Split workspace\n')
  await loadPreset(page, 'card-case')
  await page.getByTestId('workspace-mode-both').click()
  await page.waitForTimeout(2500)
  await shoot(page, 'workspace-split', { settleMs: 2000 })
}

async function captureMobileShots(browser) {
  if (ONLY && !['mobile-canvas', 'mobile-three'].some((name) => ONLY.has(name))) {
    return
  }
  process.stdout.write('Mobile\n')
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
    // 1 rather than 2: a retina capture of a phone screen is four times the
    // bytes for a picture that is only ever read at document width.
    deviceScaleFactor: 1,
  })
  const page = await context.newPage()
  await page.goto(`${BASE_URL}/`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(3000)
  await shoot(page, 'mobile-canvas', { settleMs: 1200 })

  // The 3D tab is what finding 2.1 measured, so photograph that too.
  await page.getByRole('button', { name: '3D', exact: true }).click()
  await page.waitForTimeout(3500)
  await shoot(page, 'mobile-three', { settleMs: 1500 })
  await context.close()
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true })
  const browser = await chromium.launch(LAUNCH)
  const context = await browser.newContext({ viewport: VIEWPORT, deviceScaleFactor: 1 })
  const page = await context.newPage()
  const failures = []
  page.on('pageerror', (error) => failures.push(String(error).slice(0, 200)))

  await page.goto(`${BASE_URL}/`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(2500)

  await captureSeamShots(page)
  await captureFoldShots(page)
  await captureSplitShot(page)
  await captureMobileShots(browser)

  await browser.close()
  if (failures.length > 0) {
    console.error('page errors:', failures.slice(0, 5))
    process.exitCode = 1
  }
}

await main()
