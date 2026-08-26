/**
 * Photograph a folded piece in the real app, the same way twice.
 *
 * A change to the fold solver is easy to talk yourself into. The model looks
 * different, and different is read as better. This drives the shipped build in a
 * browser, sets the fold sliders a maker would set, and writes one PNG per shot
 * from a framing that is pinned to the shot list rather than to whatever the
 * camera happened to be doing — so the honest way to judge a change is to run it
 * once before, once after, and put the two directories side by side.
 *
 * The caller serves the app; this script only drives it:
 *
 *   pnpm exec vite build
 *   pnpm exec vite preview --host 127.0.0.1 --port 41732 --strictPort &
 *   node scripts/fold-screenshots.mjs --out docs/images/fold-before
 *   # ...make the change, rebuild, then...
 *   node scripts/fold-screenshots.mjs --out docs/images/fold-after
 *
 * Options:
 *   --url    where the app is served (default http://127.0.0.1:41732)
 *   --out    directory for the PNGs and manifest.json (default docs/images/fold)
 *   --shots  a JSON shot list; omit for the built-in wallet set below
 *   --only   comma separated shot names, for re-taking one picture
 *
 * A shot list is `{ "preset": "<preset id>", "settleMs": 4000, "shots": [...] }`
 * and each shot is:
 *
 *   {
 *     "name": "flap-180",              // the PNG's filename
 *     "folds": { "flap": 180 },        // fold name fragment -> degrees
 *     "sliders": [                     // any other range on the panel
 *       { "label": "Stiffness", "fold": "flap", "value": 0.95 }
 *     ],
 *     "camera": "Orbit",               // Orbit | Side | Front | Top
 *     "zoom": 36,                      // wheel notches in from the far stop
 *     "hide": ["Piece C"]              // layers to hide, by name
 *   }
 *
 * `zoom` is absolute, not a nudge: the camera is wound out to its far stop first
 * and then in by that many notches, so 36 means the same size in the first shot
 * and the ninth. Around 32 frames the wallet from Orbit and 36 from Side or
 * Front; a shot that ends up mostly empty sky fails the run rather than being
 * written, so a wrong number is caught rather than filed.
 *
 * Every shot sets *every* fold on the panel — the ones it names to their angle
 * and the rest back to zero — on a page of its own. Shots therefore inherit
 * nothing from each other, and `--only` re-takes one picture that matches the
 * one it replaces.
 *
 * On comparing two runs: the framing and the geometry repeat exactly, but the
 * shading carries a fine dither that is re-seeded per page load, so about a
 * tenth of the pixels differ by a handful of levels between runs of an unchanged
 * build. `md5sum` is therefore not the test — amplify the difference of a pair
 * six times and an unchanged shot is black, while a fold that really moved is
 * not. Within a run the comparison is stricter: the material sweeps below shoot
 * the same pose on the same build, and those either differ or they do not.
 *
 * Four things about this app that the code below is shaped around, each of which
 * cost an afternoon to find:
 *
 *   - The solve runs in a worker. Nothing in the DOM says it has landed, so the
 *     script waits `settleMs` after touching a slider. Four seconds is reliable
 *     on Swiftshader here; a slower machine wants more, not a cleverer wait.
 *   - React ignores `element.value = x`. Ranges are set through the prototype
 *     setter plus a native `input` and `change`, the way a drag would.
 *   - The camera presets turn the camera without resetting how far away it is,
 *     and nothing else resets it either, so zoom accumulates down a run. Hence a
 *     page per shot, and hence winding out to the stop before winding in.
 *   - `page.mouse.wheel` costs about five seconds a call against this renderer.
 *     The wheel is turned with synthetic events instead; see `wheel` below.
 *
 * Neither eslint (which only covers .ts/.tsx) nor tsconfig.node.json (whose
 * `include` stops at e2e/) reaches this file, so it is written to the same bar
 * by hand rather than by a checker.
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

const URL = args.get('url') ?? 'http://127.0.0.1:41732'
const OUT_DIR = path.resolve(process.cwd(), args.get('out') ?? 'docs/images/fold')
const ONLY = args.get('only') ? new Set(args.get('only').split(',')) : null

/**
 * A retina viewport, so a crop of one of these is a zoom rather than a blur.
 * The 3D canvas takes whatever the panel layout leaves it, which is about
 * 800x717 CSS pixels at this size — 2400x2151 in the file.
 */
const VIEWPORT = { width: 1500, height: 950 }
const DEVICE_SCALE_FACTOR = 3

/** Where the fold panel's crease sliders are labelled from. */
const FOLD_LABEL_PREFIX = 'Fold — '

/**
 * The least of the frame a shot may fill before it is called a failure.
 *
 * The ground grid alone comes to a few per cent, and the smallest framing worth
 * keeping — the closed wallet seen edge on, which is mostly sky — sits around a
 * fifth. Ten per cent is comfortably between the two.
 */
const MIN_INK = 0.1

/**
 * The imported keychain snap wallet, folded a few ways.
 *
 * It earns the default because it is a real imported pattern rather than a
 * drawn-for-the-demo one: three pieces, a sewn seam, and a flap whose crease
 * runs off the cut edge — the case the drape gets wrong most visibly. Piece C is
 * the keychain tab, which sits off to the side and only costs frame.
 */
const DEFAULT_SHOTS = {
  preset: 'makesupply-keychain-snap-wallet',
  settleMs: 4000,
  shots: [
    { name: 'flat', folds: {}, camera: 'Orbit', zoom: 32, hide: ['Piece C'] },
    // Half open, seen along the crease. The flap stands clear of the body, so
    // this is the frame where a bend that costs no material is obvious.
    { name: 'flap-090', folds: { flap: 90 }, camera: 'Side', zoom: 36, hide: ['Piece C'] },
    { name: 'flap-180', folds: { flap: 180 }, camera: 'Orbit', zoom: 32, hide: ['Piece C'] },
    // Closed, edge on: the crease as a profile rather than a shaded curve, and
    // the two layers as a stack whose thickness can be measured off the picture.
    { name: 'flap-180-side', folds: { flap: 180 }, camera: 'Side', zoom: 36, hide: ['Piece C'] },
    { name: 'flap-180-front', folds: { flap: 180 }, camera: 'Front', zoom: 36, hide: ['Piece C'] },
    // The two material knobs the crease carries, swept end to end against an
    // otherwise identical frame, half open so the bend has room to show it.
    //
    // This quartet has already earned its place twice. Shot against a build
    // where the drape took both knobs as parameters and read neither, all four
    // came back the same picture. Shot against the build that makes stiffness a
    // compliance, they separate — about a seventh of the frame moves across the
    // stiffness pair and a fifth across the neutral axis pair, and it moves as
    // silhouette, not as shading. So the answer to "does this knob reach the
    // solver" is a picture, and it has been both no and yes.
    {
      name: 'flap-090-stiffness-low',
      folds: { flap: 90 },
      sliders: [{ label: 'Stiffness', fold: 'flap', value: 0.05 }],
      camera: 'Side',
      zoom: 36,
      hide: ['Piece C'],
    },
    {
      name: 'flap-090-stiffness-high',
      folds: { flap: 90 },
      sliders: [{ label: 'Stiffness', fold: 'flap', value: 0.95 }],
      camera: 'Side',
      zoom: 36,
      hide: ['Piece C'],
    },
    {
      name: 'flap-090-neutral-axis-low',
      folds: { flap: 90 },
      sliders: [{ label: 'Neutral Axis Ratio', fold: 'flap', value: 0 }],
      camera: 'Side',
      zoom: 36,
      hide: ['Piece C'],
    },
    {
      name: 'flap-090-neutral-axis-high',
      folds: { flap: 90 },
      sliders: [{ label: 'Neutral Axis Ratio', fold: 'flap', value: 1 }],
      camera: 'Side',
      zoom: 36,
      hide: ['Piece C'],
    },
    // Both creases at once: the wallet as it is meant to close.
    { name: 'both-180', folds: { flap: 180, holes: 180 }, camera: 'Orbit', zoom: 32, hide: ['Piece C'] },
  ],
}

/**
 * Find a Chromium to drive.
 *
 * This container keeps its browsers outside the checkout, so the path is
 * spelled out; PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH — the same variable
 * `playwright.config.ts` reads — overrides it anywhere else.
 */
const CHROMIUM_PATH =
  process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome'

const LAUNCH = {
  executablePath: CHROMIUM_PATH,
  // ANGLE over Swiftshader: plain --use-gl=swiftshader gets a context here that
  // draws the grid and drops the model, which reads as a working screenshot.
  args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
}

/**
 * Set a range the way a drag would, rather than through `fill`.
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

/** Every labelled range on the 3D panel. Folds, exploded view, sew order, all of it. */
function rangeLabels(page) {
  return page.locator('label:has(input[type="range"])')
}

/**
 * The fold names the loaded document actually has, without their live angle.
 *
 * Read at runtime rather than hard coded: a shot list names a fragment, and
 * resolving it here is what lets the script complain about a typo instead of
 * silently photographing an unfolded piece.
 */
async function readFoldNames(page) {
  const texts = await rangeLabels(page).allTextContents()
  return texts
    .map((text) => text.trim())
    .filter((text) => text.startsWith(FOLD_LABEL_PREFIX))
    .map((text) => text.replace(/:\s*-?\d+\s*deg$/, '').trim())
}

/** Resolve a shot list's fold fragment against those names, or say why it cannot. */
function resolveFold(foldNames, fragment) {
  const needle = fragment.toLowerCase()
  const matches = foldNames.filter((name) => name.toLowerCase().includes(needle))
  if (matches.length === 1) {
    return matches[0]
  }
  const known = foldNames.map((name) => `"${name}"`).join(', ')
  throw new Error(
    matches.length === 0
      ? `no fold matches "${fragment}". This document has: ${known}`
      : `"${fragment}" matches ${matches.length} folds. Be more specific: ${known}`,
  )
}

/** The card holding one crease's angle, direction, radius and material sliders. */
function foldCard(page, foldName) {
  return page.locator('.fold-control-card').filter({ hasText: foldName })
}

/**
 * One range, found by the text of the label wrapping it.
 *
 * Never by index. Exploded View, Neutral Axis Ratio, Stiffness, Assembly angle
 * and Sewn up to all share the panel, the fold cards repeat their three
 * material sliders once per crease, and the whole list shifts as soon as a
 * document has a different number of folds.
 */
function rangeByLabel(page, label, foldName) {
  const scope = foldName ? foldCard(page, foldName) : page
  return scope.locator('label:has(input[type="range"])').filter({ hasText: label })
}

async function setLabelledRange(page, label, foldName, value) {
  const matches = rangeByLabel(page, label, foldName)
  const count = await matches.count()
  if (count !== 1) {
    throw new Error(
      count === 0
        ? `no slider labelled "${label}"${foldName ? ` on the "${foldName}" card` : ''}`
        : `"${label}" matches ${count} sliders; name a fold to say which one`,
    )
  }
  await setRange(matches.locator('input[type="range"]'), value)
}

/**
 * Put the layer rows into the requested state, toggling only what disagrees.
 *
 * The document browser dims a hidden layer's row, so the current state is
 * readable and a shot can be re-taken without carrying the last one's toggles.
 */
async function setHiddenLayers(page, hide) {
  const wanted = new Set(hide ?? [])
  const rows = page.locator('.workbench-tree-node[data-node-kind="layer"]')
  const count = await rows.count()
  for (let index = 0; index < count; index += 1) {
    const row = rows.nth(index)
    const name = (await row.locator('.workbench-tree-node-button span').first().textContent())?.trim() ?? ''
    const hidden = ((await row.getAttribute('class')) ?? '').split(/\s+/).includes('dimmed')
    if (wanted.has(name) !== hidden) {
      await row.getByRole('button', { name: 'V', exact: true }).first().click()
      await page.waitForTimeout(600)
    }
  }
}

/**
 * How far to wind the wheel back to be sure the camera is against its stop.
 *
 * `engine-runtime.ts` clamps the orbit distance to `[radius * 0.4, radius * 8]`
 * and a notch dollies by a twentieth, so crossing that span takes about sixty
 * notches. Eighty, and the arithmetic does not have to be exactly right.
 */
const ZOOM_OUT_TICKS = 80

/**
 * Turn the wheel over the middle of the canvas, `ticks` notches.
 *
 * Through a synthetic event rather than `page.mouse.wheel`, which costs five
 * seconds a call against this renderer — Playwright waits for the compositor,
 * and Swiftshader takes its time. Eighty notches that way is a seven minute
 * screenshot; this way it is a tenth of a second, and OrbitControls cannot tell
 * the difference because it reads `deltaY` and the cursor position and nothing
 * else.
 */
async function wheel(canvas, ticks, deltaY) {
  if (ticks <= 0) {
    return
  }
  await canvas.evaluate(
    (element, [count, delta]) => {
      const box = element.getBoundingClientRect()
      for (let tick = 0; tick < count; tick += 1) {
        element.dispatchEvent(
          new WheelEvent('wheel', {
            deltaY: delta,
            deltaMode: 0,
            clientX: box.left + box.width / 2,
            clientY: box.top + box.height / 2,
            bubbles: true,
            cancelable: true,
          }),
        )
      }
    },
    [ticks, deltaY],
  )
}

/**
 * Put the camera where the shot list says, from a stop rather than from
 * wherever the last shot left it.
 *
 * The preset buttons only turn the camera: `camera.ts` builds the new pose at
 * "the current camera-to-target distance", and nothing else resets it, so wheel
 * notches accumulate across a run and the same shot comes out at a different
 * size depending on what was photographed before it. Winding all the way out to
 * the far clamp first gives every shot the same starting distance — which is
 * what makes `zoom` an absolute framing rather than a relative nudge.
 */
async function frame(page, canvas, camera, zoom) {
  if (camera) {
    await page.getByRole('button', { name: camera, exact: true }).first().click()
    await page.waitForTimeout(1200)
  }
  // The wind-out goes after the preset, not before it: turning the camera can
  // reframe as well as rotate, and an anchor set first would be thrown away.
  await wheel(canvas, ZOOM_OUT_TICKS, 100)
  await page.waitForTimeout(900)

  await wheel(canvas, Math.abs(zoom ?? 0), (zoom ?? 0) > 0 ? -100 : 100)
  await page.waitForTimeout(900)
}

/**
 * How much of the frame is something other than the empty background.
 *
 * The failure this script is most likely to hand back is a picture of nothing:
 * a lost WebGL context, or a camera left pointing past the model, both of which
 * screenshot perfectly happily. File size is a poor proxy — a near-empty frame
 * still carries the ground grid and lands in the tens of kilobytes — so the PNG
 * goes back into the page, gets drawn small onto a 2D canvas, and its pixels are
 * counted against the colour in the corner.
 */
async function inkCoverage(page, buffer) {
  return page.evaluate(async (dataUrl) => {
    const image = new Image()
    await new Promise((resolve, reject) => {
      image.onload = resolve
      image.onerror = reject
      image.src = dataUrl
    })
    const width = 240
    const height = Math.max(1, Math.round((image.height / image.width) * width))
    const scratch = document.createElement('canvas')
    scratch.width = width
    scratch.height = height
    const ctx = scratch.getContext('2d')
    ctx.drawImage(image, 0, 0, width, height)
    const pixels = ctx.getImageData(0, 0, width, height).data
    const [red, green, blue] = pixels
    let ink = 0
    for (let index = 0; index < pixels.length; index += 4) {
      const delta =
        Math.abs(pixels[index] - red) +
        Math.abs(pixels[index + 1] - green) +
        Math.abs(pixels[index + 2] - blue)
      if (delta > 24) {
        ink += 1
      }
    }
    return ink / (width * height)
  }, `data:image/png;base64,${buffer.toString('base64')}`)
}

async function loadPreset(page, presetId) {
  await page.getByRole('tab', { name: 'Output' }).click()
  await page.getByRole('button', { name: 'Templates', exact: true }).click()
  await page.getByRole('tab', { name: 'Presets' }).click()
  await page.getByLabel('Workspace preset').selectOption(presetId)
  await page.getByRole('button', { name: 'Load Preset' }).click()
  await page.waitForTimeout(2000)
  await page.getByRole('button', { name: 'Done' }).click()
  await page.waitForTimeout(1500)
}

/**
 * A page with the wallet loaded and the 3D view open, ready to be posed.
 *
 * One of these per shot. That is the price of a framing you can trust: the
 * camera's distance is a single running number that the preset buttons do not
 * reset and only a model rebuild refits, so any shot taken after another one
 * inherits its zoom. Handing every shot a fresh page is the only way to make
 * `zoom: 36` mean the same thing in the first shot and the ninth — and, because
 * the sequence is then identical for every shot, in tomorrow's run too.
 */
async function openPosedPage(context, presetId, settleMs, failures) {
  const page = await context.newPage()
  page.on('pageerror', (error) => failures.push(String(error).slice(0, 200)))
  // Loading a preset asks whether it may replace the open document. Playwright
  // dismisses dialogs by default, which quietly leaves the wrong document open.
  page.on('dialog', (dialog) => dialog.accept())

  await page.goto(`${URL}/`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(2500)
  await loadPreset(page, presetId)
  await page.getByRole('button', { name: '3D Assembly' }).click()
  await page.waitForTimeout(settleMs)

  const canvas = page.locator('canvas.three-preview-canvas')
  await canvas.waitFor()
  return { page, canvas }
}

/**
 * Take one shot on a page of its own.
 *
 * Order matters: the material sliders go first and the angles last, so the
 * solve that the picture is taken of is the one that saw every setting.
 */
async function capture(page, canvas, shot, foldNames, settleMs) {
  await setHiddenLayers(page, shot.hide)

  for (const slider of shot.sliders ?? []) {
    const scope = slider.fold ? resolveFold(foldNames, slider.fold) : undefined
    await setLabelledRange(page, slider.label, scope, slider.value)
  }

  const wanted = new Map()
  for (const [fragment, degrees] of Object.entries(shot.folds ?? {})) {
    wanted.set(resolveFold(foldNames, fragment), degrees)
  }
  for (const name of foldNames) {
    await setLabelledRange(page, name, name, wanted.get(name) ?? 0)
  }
  await page.waitForTimeout(settleMs)

  await frame(page, canvas, shot.camera, shot.zoom)
  await page.waitForTimeout(1200)

  const file = path.join(OUT_DIR, `${shot.name}.png`)
  const buffer = await page.screenshot({ path: file, clip: await canvas.boundingBox() })

  const ink = await inkCoverage(page, buffer)
  if (ink < MIN_INK) {
    throw new Error(
      `${shot.name}.png is ${(ink * 100).toFixed(1)}% ink — the model is not in this frame. ` +
        'Wind the shot\'s zoom in, or check the 3D view still has a context.',
    )
  }

  // Read the angles back off the labels rather than trusting that they took, so
  // the manifest records what the app did and not what it was asked.
  const applied = (await rangeLabels(page).allTextContents())
    .map((text) => text.trim())
    .filter((text) => text.startsWith(FOLD_LABEL_PREFIX))

  const kb = Math.round(buffer.length / 1024)
  process.stdout.write(
    `  ${shot.name}.png  ${kb}kB  ink ${(ink * 100).toFixed(0)}%  ${applied.join(' | ')}\n`,
  )
  return { ...shot, file: path.basename(file), kb, ink: Number(ink.toFixed(4)), applied }
}

async function main() {
  const shotList = args.get('shots')
    ? JSON.parse(fs.readFileSync(path.resolve(process.cwd(), args.get('shots')), 'utf8'))
    : DEFAULT_SHOTS
  const settleMs = shotList.settleMs ?? 4000

  fs.mkdirSync(OUT_DIR, { recursive: true })
  const browser = await chromium.launch(LAUNCH)
  const context = await browser.newContext({ viewport: VIEWPORT, deviceScaleFactor: DEVICE_SCALE_FACTOR })
  const preset = shotList.preset ?? DEFAULT_SHOTS.preset
  const failures = []

  process.stdout.write(`${URL} -> ${OUT_DIR}\n`)

  const taken = []
  let foldNames = null
  for (const shot of shotList.shots) {
    if (ONLY && !ONLY.has(shot.name)) {
      continue
    }
    const { page, canvas } = await openPosedPage(context, preset, settleMs, failures)
    if (!foldNames) {
      foldNames = await readFoldNames(page)
      if (foldNames.length === 0) {
        throw new Error('this document has no fold sliders — nothing to photograph')
      }
      process.stdout.write(`folds: ${foldNames.join(', ')}\n`)
    }
    taken.push(await capture(page, canvas, shot, foldNames, settleMs))
    await page.close()
  }

  fs.writeFileSync(
    path.join(OUT_DIR, 'manifest.json'),
    `${JSON.stringify({ url: URL, preset, settleMs, shots: taken }, null, 2)}\n`,
  )

  await browser.close()
  if (failures.length > 0) {
    console.error('page errors:', failures.slice(0, 5))
    process.exitCode = 1
  }
}

await main()
