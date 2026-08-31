/**
 * The fold drape, solved somewhere that is not the thread drawing the frame.
 *
 * Every other check on the drape runs the solver in-process, where "off the
 * main thread" is not a thing that can be true or false. This is the one place
 * the worker actually exists: a real browser, the module the app ships, and
 * the question that matters — does the page keep running while the leather
 * settles?
 */

import { expect, test } from '@playwright/test'

type WorkerSolveReport = {
  workerUrls: string[]
  vertices: number
  /** How many timer ticks ran while the solves were in flight. */
  ticks: number
  elapsedMs: number
  error?: string
}

test('the fold drape solves in a worker while the page keeps running', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(String(error)))
  await page.goto('/')

  const report = await page.evaluate<WorkerSolveReport>(async () => {
    // The spec is typed for Node, so the page's own globals are named here
    // rather than pulled in as a DOM lib the rest of the suite does not want.
    const browser = globalThis as unknown as {
      Worker: new (url: string | URL, options?: { type?: string }) => unknown
      setInterval: (handler: () => void, ms: number) => number
      clearInterval: (id: number) => void
      performance: { now: () => number }
    }
    const workerUrls: string[] = []
    const NativeWorker = browser.Worker
    browser.Worker = function CountedWorker(url: string | URL, options?: { type?: string }) {
      workerUrls.push(String(url))
      return new NativeWorker(url, options)
    } as unknown as typeof NativeWorker

    try {
      // The dev server serves the app's own modules, so this is the module the
      // bridge builds its solver from, not a copy of it.
      const modulePath = '/src/features/editor/three/fold-drape-worker-solver.ts'
      const loaded: unknown = await import(/* @vite-ignore */ modulePath)
      const { createFoldDrapeWorkerSolver } = loaded as {
        createFoldDrapeWorkerSolver: () => {
          solve: (pieceId: string, params: unknown) => Promise<{ positions: Float32Array } | null>
          dispose: () => void
        } | null
      }
      const solver = createFoldDrapeWorkerSolver()
      if (!solver) {
        return { workerUrls, vertices: 0, ticks: 0, elapsedMs: 0, error: 'no worker solver' }
      }

      // A wallet-sized panel: big enough that solving it on the main thread
      // would be plainly visible as a stall.
      const params = (angleDeg: number) => ({
        outer: [
          { x: 0, y: 0 },
          { x: 200, y: 0 },
          { x: 200, y: 95 },
          { x: 0, y: 95 },
        ],
        holes: [],
        thicknessMm: 2,
        folds: [
          {
            foldLineId: 'fold-1',
            start: { x: 100, y: 0 },
            end: { x: 100, y: 95 },
            angleDeg,
            bendRadiusMm: 3,
            swingSample: { x: 150, y: 40 },
          },
        ],
      })

      let ticks = 0
      const ticker = browser.setInterval(() => {
        ticks += 1
      }, 5)
      const started = browser.performance.now()
      let vertices = 0
      // Cold solves, one after another: no warm start, so this is the most
      // expensive shape the scrub can ask for.
      for (const angleDeg of [30, 60, 90, 120, 150, 180]) {
        const data = await solver.solve('piece-1', params(angleDeg))
        vertices = data ? data.positions.length / 3 : 0
      }
      const elapsedMs = browser.performance.now() - started
      browser.clearInterval(ticker)
      solver.dispose()
      return { workerUrls, vertices, ticks, elapsedMs }
    } finally {
      browser.Worker = NativeWorker
    }
  })

  expect(report.error).toBeUndefined()
  // One worker, whatever the piece and however many solves.
  expect(report.workerUrls).toHaveLength(1)
  expect(report.workerUrls[0]).toContain('fold-drape')
  expect(report.vertices).toBeGreaterThan(50)
  // The decisive one: a main-thread solve would have swallowed these ticks,
  // because six settles of a panel this size take far longer than a frame.
  expect(report.elapsedMs).toBeGreaterThan(100)
  expect(report.ticks).toBeGreaterThan(10)
  expect(errors).toEqual([])
})
