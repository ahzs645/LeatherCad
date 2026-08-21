import { chromium } from '@playwright/test'
const OUT='/tmp/claude-0/-home-user/498c0a13-9c03-5421-b4c5-d8f589a8e3fa/scratchpad/shots'
const b = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args:['--no-sandbox','--use-gl=swiftshader','--enable-unsafe-swiftshader'] })
const ctx = await b.newContext({ viewport: { width: 1600, height: 950 } })
const page = await ctx.newPage()
const errors=[]
page.on('pageerror', e=>errors.push(String(e).slice(0,160)))
await page.goto('http://127.0.0.1:5199/workbench/split', { waitUntil:'networkidle' })
await page.waitForTimeout(3000)
const modes = await page.locator('.workbench-mode-toggle button').allTextContents()
console.log('mode buttons:', JSON.stringify(modes))
console.log('active:', await page.locator('.workbench-mode-toggle button.active').textContent().catch(()=>null))
const m = await page.evaluate(() => {
  const box = (s) => { const el = document.querySelector(s); if (!el) return null; const r = el.getBoundingClientRect(); return { w: Math.round(r.width), h: Math.round(r.height) } }
  const main = document.querySelector('.workbench-main')
  return {
    twoD: box('.workbench-2d-surface'), threeD: box('.workbench-3d-surface'),
    peekToggle: !!document.querySelector('.workbench-peek-toggle'),
    mainClass: main?.className,
    cols: main ? getComputedStyle(main).gridTemplateColumns : null,
    threeClass: document.querySelector('.workbench-3d-surface')?.className,
    shellWidth: Math.round(main?.getBoundingClientRect().width ?? 0),
  }
})
console.log('surfaces:', JSON.stringify(m))
await page.screenshot({ path: `${OUT}/both-mode.png` })
console.log('errors:', errors.slice(0,4))
await b.close()
