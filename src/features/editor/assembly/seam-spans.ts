import type { PatternPiece, PieceEdgeRef, PieceEdgeSpan, SeamConnection } from '../cad/cad-types'
import {
  edgeRangeForShape,
  shapeIdForEdgeIndex,
  type OutlineChain,
} from '../ops/outline-detection'
import { getPatternPieceChain } from '../ops/pattern-piece-ops'

/**
 * One normalised side of a seam.
 *
 * Everything that consumes seams — the stitch compiler, diagnostics, the 3D
 * overlays, the inspector — should go through here rather than reading
 * `from`/`fromSpan`/`fromSpans` itself. Three representations exist for
 * backwards compatibility; exactly one is canonical at read time.
 */
export type SeamSide = 'from' | 'to'

export const FULL_SPAN = { t0: 0, t1: 1 } as const

export function spanFromRef(ref: PieceEdgeRef, reversed?: boolean): PieceEdgeSpan {
  return {
    pieceId: ref.pieceId,
    edgeIndex: ref.edgeIndex,
    boundaryShapeId: ref.boundaryShapeId,
    t0: FULL_SPAN.t0,
    t1: FULL_SPAN.t1,
    reversed,
  }
}

/**
 * The spans on one side of a seam, newest representation first:
 * the explicit list, then the single span, then the bare edge reference.
 */
export function resolveSeamSpans(connection: SeamConnection, side: SeamSide): PieceEdgeSpan[] {
  const list = side === 'from' ? connection.fromSpans : connection.toSpans
  if (list && list.length > 0) {
    return list
  }
  const single = side === 'from' ? connection.fromSpan : connection.toSpan
  if (single) {
    return [single]
  }
  const ref = side === 'from' ? connection.from : connection.to
  return [spanFromRef(ref)]
}

/** Both sides at once, for the common case of walking a seam end to end. */
export function resolveSeamSides(connection: SeamConnection) {
  return {
    from: resolveSeamSpans(connection, 'from'),
    to: resolveSeamSpans(connection, 'to'),
  }
}

/** Every piece a seam touches, in from-then-to order, without duplicates. */
export function seamPieceIds(connection: SeamConnection): string[] {
  const seen = new Set<string>()
  const ordered: string[] = []
  for (const span of [...resolveSeamSpans(connection, 'from'), ...resolveSeamSpans(connection, 'to')]) {
    if (seen.has(span.pieceId)) continue
    seen.add(span.pieceId)
    ordered.push(span.pieceId)
  }
  return ordered
}

/**
 * Rebuild the `from`/`to`/`fromSpan`/`toSpan` mirror fields from span lists, so
 * a multi-span seam still reads correctly to anything that only knows the
 * original single-edge shape.
 */
export function withMirroredSingleRefs(
  connection: SeamConnection,
  fromSpans: PieceEdgeSpan[],
  toSpans: PieceEdgeSpan[],
): SeamConnection {
  const firstFrom = fromSpans[0]
  const firstTo = toSpans[0]
  return {
    ...connection,
    from: firstFrom
      ? { pieceId: firstFrom.pieceId, edgeIndex: firstFrom.edgeIndex, boundaryShapeId: firstFrom.boundaryShapeId }
      : connection.from,
    to: firstTo
      ? { pieceId: firstTo.pieceId, edgeIndex: firstTo.edgeIndex, boundaryShapeId: firstTo.boundaryShapeId }
      : connection.to,
    fromSpan: firstFrom,
    toSpan: firstTo,
    fromSpans: fromSpans.length > 1 ? fromSpans : undefined,
    toSpans: toSpans.length > 1 ? toSpans : undefined,
  }
}

export type SeamSpanRepair = {
  span: PieceEdgeSpan
  /** The stored index no longer matched the shape and was rewritten. */
  repaired: boolean
}

/**
 * Re-derive a span's `edgeIndex` from its `boundaryShapeId` against the current
 * geometry.
 *
 * This is the whole point of carrying the shape id: a fillet or an inserted
 * vertex shifts every index after the edit, and a seam authored before the edit
 * would otherwise silently point at a different side. When the shape is still on
 * the boundary we trust it and rewrite the index; when it is gone (or the chain
 * carries no shape attribution) we leave the index alone.
 */
export function repairSpanEdgeIndex(span: PieceEdgeSpan, chain: OutlineChain | null): SeamSpanRepair {
  if (!chain || !span.boundaryShapeId) {
    return { span, repaired: false }
  }
  const range = edgeRangeForShape(chain, span.boundaryShapeId)
  if (!range) {
    return { span, repaired: false }
  }
  if (span.edgeIndex >= range.firstEdgeIndex && span.edgeIndex <= range.lastEdgeIndex) {
    return { span, repaired: false }
  }
  return { span: { ...span, edgeIndex: range.firstEdgeIndex }, repaired: true }
}

/**
 * Fill in a missing `boundaryShapeId` from the current geometry. Lets seams
 * authored before shape ids existed pick one up the first time they are read
 * against a document whose chains carry attribution.
 */
export function backfillSpanShapeId(span: PieceEdgeSpan, chain: OutlineChain | null): PieceEdgeSpan {
  if (span.boundaryShapeId || !chain) {
    return span
  }
  const shapeId = shapeIdForEdgeIndex(chain, span.edgeIndex)
  return shapeId ? { ...span, boundaryShapeId: shapeId } : span
}

export type SeamRepairResult = {
  connections: SeamConnection[]
  repairedSeamIds: string[]
}

/**
 * Bring a document's seams back into agreement with its geometry: backfill shape
 * ids where they are missing, and rewrite indices that have drifted away from
 * the shape they name.
 */
export function reconcileSeamConnections(params: {
  seamConnections: SeamConnection[]
  patternPieces: PatternPiece[]
  chainsByShapeId: Map<string, OutlineChain>
}): SeamRepairResult {
  const pieceById = new Map(params.patternPieces.map((piece) => [piece.id, piece]))
  const chainCache = new Map<string, OutlineChain | null>()
  const chainFor = (pieceId: string) => {
    if (!chainCache.has(pieceId)) {
      const piece = pieceById.get(pieceId)
      chainCache.set(pieceId, piece ? getPatternPieceChain(piece, params.chainsByShapeId) : null)
    }
    return chainCache.get(pieceId) ?? null
  }

  const repairedSeamIds: string[] = []
  const connections = params.seamConnections.map((connection) => {
    let touched = false
    const fix = (spans: PieceEdgeSpan[]) =>
      spans.map((span) => {
        const chain = chainFor(span.pieceId)
        const withShape = backfillSpanShapeId(span, chain)
        const { span: repaired, repaired: didRepair } = repairSpanEdgeIndex(withShape, chain)
        if (didRepair || withShape !== span) {
          touched = true
        }
        return repaired
      })

    const fromSpans = fix(resolveSeamSpans(connection, 'from'))
    const toSpans = fix(resolveSeamSpans(connection, 'to'))
    if (!touched) {
      return connection
    }
    repairedSeamIds.push(connection.id)
    return withMirroredSingleRefs(connection, fromSpans, toSpans)
  })

  return { connections, repairedSeamIds }
}

/** Human-readable seam label, used where a document tree or list needs a name. */
export function describeSeamConnection(
  connection: SeamConnection,
  pieceNameById: Map<string, string>,
): string {
  if (connection.name) {
    return connection.name
  }
  const nameFor = (spans: PieceEdgeSpan[]) => {
    const pieceIds = Array.from(new Set(spans.map((span) => span.pieceId)))
    const names = pieceIds.map((pieceId) => pieceNameById.get(pieceId) ?? 'Unknown piece')
    const suffix = spans.length > 1 ? ` (${spans.length} edges)` : ''
    return `${names.join(' + ')}${suffix}`
  }
  return `${nameFor(resolveSeamSpans(connection, 'from'))} → ${nameFor(resolveSeamSpans(connection, 'to'))}`
}

/** Seams ordered the way they are sewn: by `sequence`, then by array order. */
export function seamsInSewOrder(connections: SeamConnection[]): SeamConnection[] {
  return connections
    .map((connection, index) => ({ connection, index }))
    .sort((left, right) => {
      const leftSequence = left.connection.sequence ?? Number.POSITIVE_INFINITY
      const rightSequence = right.connection.sequence ?? Number.POSITIVE_INFINITY
      if (leftSequence !== rightSequence) {
        return leftSequence - rightSequence
      }
      return left.index - right.index
    })
    .map((entry) => entry.connection)
}
