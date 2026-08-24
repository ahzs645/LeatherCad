/**
 * The worker the fold drape solves in, and the per-piece request queues in
 * front of it.
 *
 * The engine already hosts exactly this shape of work, so none of it is
 * hand-rolled: `createWorkerSteadySolverPlugin` speaks the request-correlated
 * protocol to the worker, and a `createSolveHost` per piece adds the two
 * things a scrub needs on top — a short debounce, so a drag's intermediate
 * angles are dropped rather than queued, and latest-request-wins supersession,
 * so a piece is never solving for an angle the slider has already left.
 *
 * One worker serves every piece. Pieces get their own hosts because
 * supersession is per piece — two folded pieces in one rebuild are two
 * separate questions, and neither should cancel the other.
 */

import {
  createSolveHost,
  createWorkerSteadySolverPlugin,
  SolveSuperseded,
  type SolveHost,
  type SteadySolverSession,
} from '@atelier/sim'
import {
  solveFoldDrapeData,
  type FoldDrapeData,
  type FoldDrapeParams,
} from './assembled-fold-drape'
import type { FoldDrapeSolver } from './fold-drape-store'

/**
 * How long a piece waits for the drag to stop moving before it solves.
 *
 * Long enough that a fast drag issues one solve rather than one per input
 * event, short enough to be under a frame and a half — the drape is meant to
 * arrive just behind the slider, not after it.
 */
const SCRUB_DEBOUNCE_MS = 24

type DrapeSession = SteadySolverSession<FoldDrapeParams, FoldDrapeData | null>
type DrapeHost = SolveHost<FoldDrapeParams, FoldDrapeData | null>

/** A superseded or aborted solve is the scrub working, not the worker failing. */
function isCancellation(error: unknown) {
  return (
    error instanceof SolveSuperseded ||
    (error instanceof Error && error.name === 'AbortError')
  )
}

/**
 * A solver backed by a worker, or null where there are no workers to have —
 * a test environment, or a server-rendered pass, both of which fall back to
 * solving in place.
 */
export function createFoldDrapeWorkerSolver(): FoldDrapeSolver | null {
  if (typeof Worker === 'undefined') {
    return null
  }

  let session: Promise<DrapeSession> | null = null
  const hosts = new Map<string, Promise<DrapeHost>>()
  let disposed = false
  // A worker that cannot be reached at all must not cost the drape entirely:
  // the solve is the same function either way, so fall back to running it here
  // rather than leaving the piece on its analytic fold forever.
  let solveHere = false

  const sessionFor = () => {
    if (!session) {
      const plugin = createWorkerSteadySolverPlugin<null, FoldDrapeParams, FoldDrapeData | null>({
        id: 'leathercad-fold-drape',
        createWorker: () =>
          new Worker(new URL('./fold-drape.worker.ts', import.meta.url), { type: 'module' }),
      })
      session = plugin.prepare(null, {})
    }
    return session
  }

  const hostFor = (pieceId: string) => {
    const existing = hosts.get(pieceId)
    if (existing) {
      return existing
    }
    const created = sessionFor().then((prepared) =>
      createSolveHost<FoldDrapeParams, FoldDrapeData | null>(
        {
          solve: (query, opts) => prepared.solve(query, opts),
          // The session outlives every host in front of it, so a piece's host
          // going away must not take the worker with it.
          dispose: () => {},
        },
        { debounceMs: SCRUB_DEBOUNCE_MS },
      ),
    )
    hosts.set(pieceId, created)
    return created
  }

  return {
    async solve(pieceId, params) {
      if (disposed) {
        return null
      }
      if (solveHere) {
        return solveFoldDrapeData(params)
      }
      try {
        const host = await hostFor(pieceId)
        return await host.solve(params)
      } catch (error) {
        if (isCancellation(error) || disposed) {
          throw error
        }
        solveHere = true
        hosts.clear()
        session = null
        return solveFoldDrapeData(params)
      }
    },
    dispose() {
      disposed = true
      const pending = [...hosts.values()]
      hosts.clear()
      for (const host of pending) {
        void host.then((prepared) => prepared.dispose()).catch(() => {})
      }
      const prepared = session
      session = null
      void prepared?.then((instance) => instance.dispose()).catch(() => {})
    },
  }
}
