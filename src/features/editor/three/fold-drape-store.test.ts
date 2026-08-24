import { describe, expect, it } from 'vitest'
import type { Point } from '../cad/cad-types'
import {
  solveFoldDrapeData,
  type DrapeFoldInput,
  type FoldDrapeData,
  type FoldDrapeParams,
} from './assembled-fold-drape'
import {
  createFoldDrapeStore,
  foldDrapeAngleKey,
  foldDrapeGeometryKey,
  type FoldDrapeRequest,
  type FoldDrapeSolver,
} from './fold-drape-store'

const SQUARE: Point[] = [
  { x: 0, y: 0 },
  { x: 40, y: 0 },
  { x: 40, y: 40 },
  { x: 0, y: 40 },
]

/** A slab standing where the flap is going, in the piece's own frame. */
const OBSTACLE = {
  positions: [5, 8, 22, 35, 8, 22, 5, 8, 38, 35, 8, 38],
  triangles: [0, 1, 3, 0, 3, 2],
}

function fold(angleDeg: number): DrapeFoldInput {
  return {
    foldLineId: 'fold-1',
    start: { x: 0, y: 20 },
    end: { x: 40, y: 20 },
    angleDeg,
    bendRadiusMm: 3,
    swingSample: { x: 20, y: 10 },
  }
}

function request(angleDeg: number, overrides: Partial<FoldDrapeRequest> = {}): FoldDrapeRequest {
  return {
    pieceId: 'piece-1',
    outer: SQUARE,
    holes: [],
    folds: [fold(angleDeg)],
    thicknessMm: 2,
    ...overrides,
  }
}

/**
 * A solver whose solves land when the test says so — the point of a deferred
 * store is what it draws in the meantime, and that only exists between the
 * request and the answer.
 */
function deferredSolver() {
  const calls: { pieceId: string; params: FoldDrapeParams }[] = []
  const waiting: {
    resolve: (data: FoldDrapeData | null) => void
    reject: (error: unknown) => void
  }[] = []
  let disposed = false
  const solver: FoldDrapeSolver = {
    solve(pieceId, params) {
      calls.push({ pieceId, params })
      return new Promise((resolve, reject) => waiting.push({ resolve, reject }))
    },
    dispose() {
      disposed = true
    },
  }
  return {
    solver,
    calls,
    disposed: () => disposed,
    /** Answer the oldest outstanding solve and let the store's callbacks run. */
    async land(data: FoldDrapeData | null) {
      waiting.shift()?.resolve(data)
      await Promise.resolve()
    },
    async fail(error: unknown) {
      waiting.shift()?.reject(error)
      await Promise.resolve()
    },
  }
}

function solveHere(angleDeg: number) {
  const data = solveFoldDrapeData(request(angleDeg))
  expect(data).not.toBeNull()
  return data!
}

describe('foldDrapeGeometryKey', () => {
  it('does not change with the angle, which is what a warm start crosses', () => {
    expect(foldDrapeGeometryKey(request(90))).toBe(foldDrapeGeometryKey(request(150)))
    expect(foldDrapeAngleKey(request(90))).not.toBe(foldDrapeAngleKey(request(150)))
  })

  it('changes when the leather in the fold’s way moves', () => {
    // The reason this matters: a state resting on a slab that is no longer
    // there is not a head start, it is leather hanging on nothing.
    const still = request(90, { obstacles: [OBSTACLE] })
    const moved = request(90, {
      obstacles: [{ ...OBSTACLE, positions: OBSTACLE.positions.map((value) => value + 1) }],
    })
    expect(foldDrapeGeometryKey(still)).not.toBe(foldDrapeGeometryKey(moved))
    expect(foldDrapeGeometryKey(still)).not.toBe(foldDrapeGeometryKey(request(90)))
  })

  it('separates two pieces cut to the same outline', () => {
    expect(foldDrapeGeometryKey(request(90))).not.toBe(
      foldDrapeGeometryKey(request(90, { pieceId: 'piece-2' })),
    )
  })
})

describe('createFoldDrapeStore', () => {
  it('answers a repeated request without solving again', () => {
    const store = createFoldDrapeStore()
    const first = store.resolve(request(90))
    expect(first).not.toBeNull()
    // The same object back is the proof: a second solve would build a new one.
    expect(store.resolve(request(90))).toBe(first)
    store.dispose()
  })

  it('hands the previous drape to the next solve as its warm start', async () => {
    const solver = deferredSolver()
    const store = createFoldDrapeStore({ solver: solver.solver })
    const at90 = solveHere(90)

    store.resolve(request(90))
    expect(solver.calls[0].params.warmStart).toBeUndefined()
    await solver.land(at90)

    store.resolve(request(120))
    expect(solver.calls[1].params.warmStart?.positions).toBe(at90.positions)
    expect(solver.calls[1].params.warmStart?.creases).toBe(at90.creases)
    store.dispose()
  })

  it('starts cold when the obstacles moved under a settled drape', async () => {
    const solver = deferredSolver()
    const store = createFoldDrapeStore({ solver: solver.solver })
    store.resolve(request(90))
    await solver.land(solveHere(90))

    store.resolve(request(120, { obstacles: [OBSTACLE] }))
    expect(solver.calls[1].params.warmStart).toBeUndefined()
    store.dispose()
  })

  it('keeps drawing the settled drape while the next angle solves', async () => {
    const solver = deferredSolver()
    let settled = 0
    const store = createFoldDrapeStore({ solver: solver.solver, onSettled: () => { settled += 1 } })

    // Nothing has settled yet, so there is nothing to draw and the caller
    // falls back to its analytic fold.
    expect(store.resolve(request(90))).toBeNull()
    expect(settled).toBe(0)
    await solver.land(solveHere(90))
    expect(settled).toBe(1)

    const drape90 = store.resolve(request(90))
    expect(drape90).not.toBeNull()
    // Mid-scrub: the new angle is not solved, so the leather stays one step
    // behind rather than snapping back to the rigid fold.
    expect(store.resolve(request(120))).toBe(drape90)
    await solver.land(solveHere(120))
    expect(settled).toBe(2)
    expect(store.resolve(request(120))).not.toBe(drape90)
    store.dispose()
  })

  it('asks once per angle however many rebuilds pass through', async () => {
    const solver = deferredSolver()
    const store = createFoldDrapeStore({ solver: solver.solver })
    store.resolve(request(90))
    store.resolve(request(90))
    store.resolve(request(90))
    expect(solver.calls).toHaveLength(1)
    await solver.land(solveHere(90))
    store.resolve(request(90))
    expect(solver.calls).toHaveLength(1)
    store.dispose()
  })

  it('lets the next rebuild retry a solve that failed', async () => {
    const solver = deferredSolver()
    let settled = 0
    const store = createFoldDrapeStore({ solver: solver.solver, onSettled: () => { settled += 1 } })
    store.resolve(request(90))
    await solver.fail(new Error('worker went away'))
    // No redraw was asked for — a failure that triggered one would rebuild
    // straight back into the same failing request.
    expect(settled).toBe(0)
    store.resolve(request(90))
    expect(solver.calls).toHaveLength(2)
    store.dispose()
  })

  it('remembers a piece that cannot drape at all', async () => {
    const solver = deferredSolver()
    const store = createFoldDrapeStore({ solver: solver.solver })
    store.resolve(request(90))
    await solver.land(null)
    expect(store.resolve(request(90))).toBeNull()
    expect(solver.calls).toHaveLength(1)
    store.dispose()
  })

  it('drops its solver with it', () => {
    const solver = deferredSolver()
    const store = createFoldDrapeStore({ solver: solver.solver })
    store.dispose()
    expect(solver.disposed()).toBe(true)
    expect(store.resolve(request(90))).toBeNull()
  })
})
