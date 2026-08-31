/**
 * The drape a piece is drawn with, and the bookkeeping that makes scrubbing a
 * fold angle feel like scrubbing rather than like waiting.
 *
 * A solve is expensive because it sweeps the leather from flat to the dialled
 * pose so contact can catch it on the way, and a rebuild runs one per folded
 * piece. Dragging a slider asks for a rebuild per input event, so the store
 * stands between the two with the three things that turn that into a scrub:
 *
 * - **A cache of finished solves.** The same piece at the same angles is the
 *   same leather; returning to a preset costs a map lookup.
 * - **A warm start.** Consecutive scrub states are neighbours, so a new solve
 *   begins from the last settled drape of the same geometry and sweeps only
 *   the angle that changed. Keyed so that anything else moving — the outline,
 *   a hole, the leather in the fold's way — starts from flat again, because a
 *   state resting on an obstacle that is no longer there is not a head start.
 * - **Somewhere else to run.** Given a solver, the store hands the work off
 *   and keeps drawing the previous drape until the answer lands. Without one
 *   it solves in place, which is what the tests and any non-browser caller do.
 */

import {
  hydrateFoldDrape,
  solveFoldDrapeData,
  type FoldDrapeData,
  type FoldDrapeParams,
  type FoldDrapeResult,
  type FoldDrapeWarmStart,
} from './assembled-fold-drape'

/** Finished solves kept for an instant answer, newest-used last. */
const MAX_CACHED_DRAPES = 64
/** Meshes kept as warm starts — one per piece in play, with room to spare. */
const MAX_WARM_STARTS = 16

export type FoldDrapeRequest = FoldDrapeParams & {
  /** Which piece is asking, so its solves supersede only each other. */
  pieceId: string
}

/** Somewhere a solve can run that is not here. */
export type FoldDrapeSolver = {
  solve(pieceId: string, params: FoldDrapeParams): Promise<FoldDrapeData | null>
  dispose(): void
}

export type FoldDrapeStore = {
  /**
   * The drape to draw for this request right now: the finished solve if there
   * is one, the previous drape of the same piece while a deferred solve runs,
   * or null when there is nothing settled yet and the caller should fall back
   * to its analytic fold.
   */
  resolve(request: FoldDrapeRequest): FoldDrapeResult | null
  dispose(): void
}

/**
 * FNV-1a in two lanes, over a signature of everything a key covers.
 *
 * The signatures run to kilobytes — a piece's outline, its holes, and every
 * other piece's slab — and they are rebuilt on every input event of a drag, so
 * they are hashed rather than kept. The key carries the piece id and the
 * vertex counts beside the hash, so two different pieces cannot collide even
 * in principle and two different outlines have to agree on their size first.
 */
function hashSignature(signature: string) {
  let low = 0x811c9dc5
  let high = 0x01000193
  for (let index = 0; index < signature.length; index += 1) {
    const code = signature.charCodeAt(index)
    low = Math.imul(low ^ code, 0x01000193)
    high = Math.imul(high ^ code, 0x85ebca6b)
  }
  return `${(low >>> 0).toString(36)}${(high >>> 0).toString(36)}`
}

/**
 * Everything about a request except what a scrub moves: the mesh a solve would
 * build and the world it would settle against.
 */
export function foldDrapeGeometryKey(request: FoldDrapeRequest) {
  const parts: (string | number)[] = [request.pieceId, request.thicknessMm]
  parts.push('outer', request.outer.length)
  for (const point of request.outer) parts.push(point.x, point.y)
  parts.push('holes', request.holes.length)
  for (const hole of request.holes) {
    parts.push(hole.length)
    for (const point of hole) parts.push(point.x, point.y)
  }
  parts.push('folds', request.folds.length)
  for (const fold of request.folds) {
    // Not the angle, and not the stiffness: those are what a warm start is
    // allowed to differ in.
    parts.push(
      fold.foldLineId,
      fold.start.x,
      fold.start.y,
      fold.end.x,
      fold.end.y,
      fold.bendRadiusMm,
      fold.swingSample.x,
      fold.swingSample.y,
      // Two of the crease's material properties decide the mesh as surely as
      // its geometry does: the neutral axis and the leather's thickness at the
      // fold are what set how wide a bend zone the lattice has to resolve.
      // Leave them out and dragging a Bend Controls slider is answered from
      // the cache with the drape the old value produced. Stiffness is not one
      // of them — it changes what the constraints cost, not where a vertex
      // sits — so it belongs in the scrub key below, where a change to it can
      // still warm-start from the drape next door instead of sweeping from
      // flat.
      fold.neutralAxisRatio ?? -1,
      fold.foldThicknessMm ?? -1,
    )
  }
  const obstacles = request.obstacles ?? []
  parts.push('obstacles', obstacles.length)
  for (const obstacle of obstacles) {
    parts.push(obstacle.positions.length, obstacle.triangles.length)
    for (const value of obstacle.positions) parts.push(value)
    for (const value of obstacle.triangles) parts.push(value)
  }
  return `${request.pieceId}|${request.outer.length}|${hashSignature(parts.join(','))}`
}

/**
 * What a scrub changes: the dialled pose, and the stiffness the crease answers
 * it with. Neither touches the mesh, so a solve for a new one of either can
 * still warm-start from the last — which is why they are keyed apart from the
 * geometry rather than folded into it.
 */
export function foldDrapeScrubKey(request: FoldDrapeRequest) {
  return request.folds
    .map((fold) => `${fold.foldLineId}:${fold.angleDeg}:${fold.stiffness ?? ''}`)
    .join(',')
}

/** A solve that ran here, or in the worker, or came back from the cache. */
export function createFoldDrapeStore(
  options: {
    /** Where deferred solves run. Absent means solve in place. */
    solver?: FoldDrapeSolver | null
    /** Called when a deferred solve lands and the view is now out of date. */
    onSettled?: () => void
  } = {},
): FoldDrapeStore {
  const { solver, onSettled } = options
  /** Finished solves by full key. A cached null is a piece that cannot drape. */
  const solved = new Map<string, FoldDrapeResult | null>()
  /** The newest settled drape per mesh: the warm start, and the stale frame. */
  const latest = new Map<string, FoldDrapeResult>()
  /** The key each piece is currently solving for, so it is asked only once. */
  const inFlight = new Map<string, string>()
  let disposed = false

  const remember = (key: string, geometryKey: string, result: FoldDrapeResult | null) => {
    solved.delete(key)
    solved.set(key, result)
    while (solved.size > MAX_CACHED_DRAPES) {
      const oldest = solved.keys().next()
      if (oldest.done) break
      solved.delete(oldest.value)
    }
    if (!result) {
      return
    }
    latest.delete(geometryKey)
    latest.set(geometryKey, result)
    while (latest.size > MAX_WARM_STARTS) {
      const oldest = latest.keys().next()
      if (oldest.done) break
      latest.delete(oldest.value)
    }
  }

  const warmStartFor = (geometryKey: string): FoldDrapeWarmStart | undefined => {
    const previous = latest.get(geometryKey)
    return previous
      ? {
          positions: previous.positions,
          restPositions: previous.restPositions,
          creases: previous.creases,
        }
      : undefined
  }

  return {
    resolve(request) {
      if (disposed) {
        return null
      }
      const geometryKey = foldDrapeGeometryKey(request)
      const key = `${geometryKey}@${foldDrapeScrubKey(request)}`
      if (solved.has(key)) {
        const cached = solved.get(key) ?? null
        // Touch it: a scrub that keeps returning to the same angles should
        // never evict them for the ones it passed through on the way.
        solved.delete(key)
        solved.set(key, cached)
        return cached
      }

      const params: FoldDrapeParams = { ...request, warmStart: warmStartFor(geometryKey) }
      if (!solver) {
        const data = solveFoldDrapeData(params)
        const result = data ? hydrateFoldDrape(data) : null
        remember(key, geometryKey, result)
        return result
      }

      if (inFlight.get(request.pieceId) !== key) {
        inFlight.set(request.pieceId, key)
        void solver
          .solve(request.pieceId, params)
          .then((data) => {
            if (disposed || inFlight.get(request.pieceId) !== key) {
              return
            }
            inFlight.delete(request.pieceId)
            remember(key, geometryKey, data ? hydrateFoldDrape(data) : null)
            onSettled?.()
          })
          .catch(() => {
            // Every rejection here is one of two things: the scrub moved on
            // and superseded this solve, or the solver failed. Neither wants a
            // rebuild — the first has a newer solve already running, and the
            // second would loop. Clearing the slot is enough: the next
            // rebuild asks again, and until then the previous drape stands.
            if (inFlight.get(request.pieceId) === key) {
              inFlight.delete(request.pieceId)
            }
          })
      }
      // Whatever this piece last settled at, one scrub step behind.
      return latest.get(geometryKey) ?? null
    },
    dispose() {
      disposed = true
      solver?.dispose()
      solved.clear()
      latest.clear()
      inFlight.clear()
    },
  }
}
