/**
 * Geometry for a seam side: turning span references into the run of boundary
 * the seam actually covers, and sampling along it by arc length.
 *
 * Shared by the stitch compiler and the assembly diagnostics so both measure a
 * seam the same way. Measuring only `connection.from` would report a 110mm
 * panel side against a 380mm gusset edge as a 270mm mismatch, when the seam
 * actually runs three panel sides against that one gusset edge.
 */

import type { PieceEdgeSpan, SeamConnection } from '../cad/cad-types'
import { edgeAtIndex, edgesForShape, type PieceMeshData, type PieceOutlineEdge } from '../three/piece-mesh'
import { resolveSeamSpans, type SeamSide } from './seam-spans'

/**
 * One contiguous stretch of boundary a seam runs along: an edge plus the portion
 * of it in play. A span that names an authored shape expands to every sampled
 * edge of that shape, so a curved side contributes its whole arc rather than one
 * 1/48 chord.
 */
export type SeamSideStretch = {
  edge: PieceOutlineEdge
  t0: number
  t1: number
  lengthMm: number
}

export function stretchesForSpan(piece: PieceMeshData, span: PieceEdgeSpan): SeamSideStretch[] {
  const t0 = Math.min(Math.max(span.t0 ?? 0, 0), 1)
  const t1 = Math.min(Math.max(span.t1 ?? 1, 0), 1)
  const shapeEdges = span.boundaryShapeId ? edgesForShape(piece, span.boundaryShapeId) : []
  const edges = shapeEdges.length > 0 ? shapeEdges : [edgeAtIndex(piece, span.edgeIndex)].filter(Boolean) as PieceOutlineEdge[]
  if (edges.length === 0) {
    return []
  }

  // A partial span applies to the side as a whole, so distribute it across the
  // side's arc length rather than clipping each sampled chord identically.
  const totalMm = edges.reduce((sum, edge) => sum + edge.lengthMm, 0)
  if (totalMm <= 0) {
    return []
  }
  const startMm = totalMm * Math.min(t0, t1)
  const endMm = totalMm * Math.max(t0, t1)

  const stretches: SeamSideStretch[] = []
  let cursorMm = 0
  for (const edge of edges) {
    const edgeStartMm = cursorMm
    const edgeEndMm = cursorMm + edge.lengthMm
    cursorMm = edgeEndMm
    const overlapStart = Math.max(edgeStartMm, startMm)
    const overlapEnd = Math.min(edgeEndMm, endMm)
    if (overlapEnd <= overlapStart) {
      continue
    }
    stretches.push({
      edge,
      t0: (overlapStart - edgeStartMm) / edge.lengthMm,
      t1: (overlapEnd - edgeStartMm) / edge.lengthMm,
      lengthMm: overlapEnd - overlapStart,
    })
  }
  return stretches
}

export function resolveSeamSide(
  pieceMeshesById: Map<string, PieceMeshData>,
  spans: PieceEdgeSpan[],
): { stretches: SeamSideStretch[]; lengthMm: number; pieceIds: string[] } | null {
  const stretches: SeamSideStretch[] = []
  const pieceIds: string[] = []
  for (const span of spans) {
    const piece = pieceMeshesById.get(span.pieceId)
    if (!piece) {
      return null
    }
    if (!pieceIds.includes(span.pieceId)) {
      pieceIds.push(span.pieceId)
    }
    const spanStretches = stretchesForSpan(piece, span)
    if (spanStretches.length === 0) {
      return null
    }
    stretches.push(...(span.reversed ? [...spanStretches].reverse().map(flipStretch) : spanStretches))
  }
  if (stretches.length === 0) {
    return null
  }
  return {
    stretches,
    lengthMm: stretches.reduce((sum, stretch) => sum + stretch.lengthMm, 0),
    pieceIds,
  }
}

export function flipStretch(stretch: SeamSideStretch): SeamSideStretch {
  return { ...stretch, t0: stretch.t1, t1: stretch.t0 }
}

/** The point at arc-length `distanceMm` along a side, with the edge it sits on. */
export function sampleSide(stretches: SeamSideStretch[], distanceMm: number) {
  let remaining = distanceMm
  for (const stretch of stretches) {
    if (remaining <= stretch.lengthMm || stretch === stretches[stretches.length - 1]) {
      const local = stretch.lengthMm <= 0 ? 0 : Math.min(Math.max(remaining / stretch.lengthMm, 0), 1)
      return { stretch, t: stretch.t0 + (stretch.t1 - stretch.t0) * local }
    }
    remaining -= stretch.lengthMm
  }
  const last = stretches[stretches.length - 1]
  return { stretch: last, t: last.t1 }
}


export type ResolvedSeamSide = NonNullable<ReturnType<typeof resolveSeamSide>>

/** Resolve one side of a seam straight from the connection. */
export function resolveConnectionSide(
  pieceMeshesById: Map<string, PieceMeshData>,
  connection: SeamConnection,
  side: SeamSide,
) {
  return resolveSeamSide(pieceMeshesById, resolveSeamSpans(connection, side))
}

/**
 * The two ends of a seam side, in stitching order. Used to tell a seam that runs
 * the same way on both sides from one that crosses.
 */
export function seamSideEndpoints(side: ResolvedSeamSide) {
  const first = side.stretches[0]
  const last = side.stretches[side.stretches.length - 1]
  const at = (stretch: SeamSideStretch, t: number) => ({
    x: stretch.edge.start.x + (stretch.edge.end.x - stretch.edge.start.x) * t,
    y: stretch.edge.start.y + (stretch.edge.end.y - stretch.edge.start.y) * t,
  })
  return { start: at(first, first.t0), end: at(last, last.t1) }
}

/** Midpoint of a seam side, for pointing a diagnostic at something visible. */
export function seamSideMidpoint(side: ResolvedSeamSide) {
  const { stretch, t } = sampleSide(side.stretches, side.lengthMm / 2)
  return {
    x: stretch.edge.start.x + (stretch.edge.end.x - stretch.edge.start.x) * t,
    y: stretch.edge.start.y + (stretch.edge.end.y - stretch.edge.start.y) * t,
  }
}
