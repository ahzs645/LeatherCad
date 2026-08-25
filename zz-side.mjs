import { chromium } from '@playwright/test'
const OUT = process.env.SHOT_DIR
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] })
const page = await (await browser.newContext({ viewport: { width: 1500, height: 950 }, deviceScaleFactor: 3 })).newPage()
page.on('dialog', (d) => { void d.accept() })
page.on('pageerror', (e) => console.log('PAGEERROR:', e.message))
const setRange = (handle, next) =>
  handle.evaluate((el, value) => {
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set
    setter?.call(el, String(value))
    el.dispatchEvent(new Event('input', { bubbles: true }))
    el.dispatchEvent(new Event('change', { bubbles: true }))
  }, next)
try {
  await page.goto('http://127.0.0.1:41732/')
  await page.waitForTimeout(1500)
  await page.getByRole('tab', { name: 'Output', exact: true }).first().click()
  await page.getByRole('button', { name: 'Templates', exact: true }).first().click()
  await page.waitForTimeout(600)
  await page.getByRole('tab', { name: 'Presets' }).click()
  await page.getByLabel('Workspace preset').selectOption('makesupply-keychain-snap-wallet')
  await page.getByRole('button', { name: 'Load Preset' }).click()
  await page.getByRole('button', { name: 'Done' }).click()
  await page.getByRole('button', { name: '3D Assembly' }).first().click()
  await page.waitForTimeout(2500)
  const row = page.locator('div').filter({ hasText: /^Piece C/ }).last()
  const hide = row.getByRole('button', { name: 'V', exact: true }).first()
  if (await hide.count()) { await hide.click(); await page.waitForTimeout(1200) }
  const boxes = await page.locator('canvas').evaluateAll((els) => els.map((el) => { const r = el.getBoundingClientRect(); return { w: Math.round(r.width), h: Math.round(r.height), x: Math.round(r.x), y: Math.round(r.y) } }))
  const big = boxes.filter((b) => b.w > 200).sort((a, b) => b.w * b.h - a.w * a.h)[0]
  const box = { x: big.x, y: big.y, width: big.w, height: big.h }
  const centre = { x: box.x + box.width / 2, y: box.y + box.height * 0.55 }
  const dolly = async (ticks) => {
    await page.mouse.move(centre.x, centre.y)
    for (let t = 0; t < ticks; t += 1) { await page.mouse.wheel(0, -100); await page.waitForTimeout(80) }
    await page.waitForTimeout(1200)
  }
  await page.getByRole('button', { name: 'Side', exact: true }).first().click()
  await page.waitForTimeout(1500)
  await dolly(11)
  const flap = page.locator('input[type="range"]').nth(4)
  for (const angle of [0, 45, 90, 135, 180]) {
    await setRange(flap, angle)
    await page.waitForTimeout(4500)
    await page.screenshot({ path: `${OUT}/side-${String(angle).padStart(3, '0')}.png`, clip: box })
    console.log('shot side', angle)
  }
} finally { await browser.close() }
