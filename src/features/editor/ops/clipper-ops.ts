/**
 * Clipper-lib integration for boolean operations and proper path offsetting.
 *
 * Uses the Vatti clipping algorithm via clipper-lib for:
 *  - Union, Intersection, Difference, XOR on polygon selections
 *  - Path offsetting with miter/round/square joins (replaces naive perpendicular offset)
 */

import ClipperLib from 'clipper-lib'
import type { Point, Shape } from '../cad/cad-types'
import {
  shapesToPolygons,
  polygonToLineShapes,
  shapeToPolyline,
  type Polygon,
} from './polygon-ops'

// ---------------------------------------------------------------------------
// Clipper coordinate scaling (clipper-lib uses integer arithmetic)
// ---------------------------------------------------------------------------

const CLIPPER_SCALE = 1000 // 1mm = 1000 clipper units (sub-micron precision)

function toClipperPath(polygon: Polygon): ClipperLib.IntPoint[] {
  return polygon.map((p) => ({
    X: Math.round(p.x * CLIPPER_SCALE),
    Y: Math.round(p.y * CLIPPER_SCALE),
  }))
}

function fromClipperPath(path: ClipperLib.IntPoint[]): Polygon {
  return path.map((p) => ({
    x: p.X / CLIPPER_SCALE,
    y: p.Y / CLIPPER_SCALE,
  }))
}

function fromClipperPaths(paths: ClipperLib.IntPoint[][]): Polygon[] {
  return paths.map(fromClipperPath)
}

// ---------------------------------------------------------------------------
// Boolean operations
// ---------------------------------------------------------------------------

export type BooleanOp = 'union' | 'intersection' | 'difference' | 'xor'

const CLIPPER_OPS: Record<BooleanOp, number> = {
  union: ClipperLib.ClipType.ctUnion,
  intersection: ClipperLib.ClipType.ctIntersection,
  difference: ClipperLib.ClipType.ctDifference,
  xor: ClipperLib.ClipType.ctXor,
}

/**
 * Performs a boolean operation on two sets of shapes.
 *
 * - `subjectShapes`: The primary shapes (kept for difference)
 * - `clipShapes`: The secondary shapes (subtracted for difference)
 * - `op`: The boolean operation type
 *
 * Returns an array of result polygons.
 */
export function booleanOpPolygons(
  subjectPolygons: Polygon[],
  clipPolygons: Polygon[],
  op: BooleanOp,
): Polygon[] {
  const clipper = new ClipperLib.Clipper()

  for (const poly of subjectPolygons) {
    const path = toClipperPath(poly)
    clipper.AddPath(path, ClipperLib.PolyType.ptSubject, true)
  }

  for (const poly of clipPolygons) {
    const path = toClipperPath(poly)
    clipper.AddPath(path, ClipperLib.PolyType.ptClip, true)
  }

  const solution: ClipperLib.IntPoint[][] = []
  clipper.Execute(
    CLIPPER_OPS[op],
    solution,
    ClipperLib.PolyFillType.pftNonZero,
    ClipperLib.PolyFillType.pftNonZero,
  )

  return fromClipperPaths(solution)
}

/**
 * High-level boolean operation on selected shapes.
 *
 * For union: all shapes combined.
 * For difference: first group (subject) minus second group (clip).
 * For intersection/xor: first group vs second group.
 *
 * Groups are split by layerId: shapes on the first layer encountered are subjects,
 * shapes on subsequent layers are clips. If all on same layer, first half = subject.
 */
export function booleanOpOnShapes(
  shapes: Shape[],
  selectedShapeIds: Set<string>,
  op: BooleanOp,
  activeLayerId: string,
  activeLineTypeId: string,
): {
  ok: boolean
  message: string
  nextShapes: Shape[]
  created: Shape[]
} {
  const selectedShapes = shapes.filter((s) => selectedShapeIds.has(s.id))
  if (selectedShapes.length < 2) {
    return {
      ok: false,
      message: 'Select at least 2 shapes for boolean operations',
      nextShapes: shapes,
      created: [],
    }
  }

  // Split into subject and clip groups
  let subjectShapes: Shape[]
  let clipShapes: Shape[]

  if (op === 'union') {
    // For union, all shapes are subjects
    subjectShapes = selectedShapes
    clipShapes = []
  } else {
    // Split by layer: first layer = subject, rest = clip
    const layers = [...new Set(selectedShapes.map((s) => s.layerId))]
    if (layers.length >= 2) {
      subjectShapes = selectedShapes.filter((s) => s.layerId === layers[0])
      clipShapes = selectedShapes.filter((s) => s.layerId !== layers[0])
    } else {
      // Same layer: first half = subject, second half = clip
      const mid = Math.ceil(selectedShapes.length / 2)
      subjectShapes = selectedShapes.slice(0, mid)
      clipShapes = selectedShapes.slice(mid)
    }
  }

  const subjectPolys = shapesToPolygons(subjectShapes)
  const clipPolys = shapesToPolygons(clipShapes)

  if (subjectPolys.length === 0) {
    return {
      ok: false,
      message: 'Could not build polygons from subject shapes',
      nextShapes: shapes,
      created: [],
    }
  }

  const resultPolys = booleanOpPolygons(subjectPolys, clipPolys, op)

  if (resultPolys.length === 0) {
    return {
      ok: false,
      message: 'Boolean operation produced no result',
      nextShapes: shapes,
      created: [],
    }
  }

  // Convert result polygons to line shapes
  const layerId = activeLayerId || selectedShapes[0].layerId
  const lineTypeId = activeLineTypeId || selectedShapes[0].lineTypeId
  const groupId = selectedShapes[0].groupId

  const created: Shape[] = []
  for (const poly of resultPolys) {
    if (poly.length < 3) continue
    created.push(...polygonToLineShapes(poly, layerId, lineTypeId, groupId, true))
  }

  // Remove original selected shapes, add new ones
  const nextShapes = shapes.filter((s) => !selectedShapeIds.has(s.id)).concat(created)

  return {
    ok: true,
    message: `Boolean ${op}: created ${created.length} shapes from ${resultPolys.length} polygon(s)`,
    nextShapes,
    created,
  }
}

// ---------------------------------------------------------------------------
// Path offsetting (proper seam allowance)
// ---------------------------------------------------------------------------

export type OffsetJoinType = 'miter' | 'round' | 'square'

const JOIN_TYPE_MAP: Record<OffsetJoinType, number> = {
  miter: ClipperLib.JoinType.jtMiter,
  round: ClipperLib.JoinType.jtRound,
  square: ClipperLib.JoinType.jtSquare,
}

/**
 * Offsets a polygon by a distance using Clipper's ClipperOffset.
 *
 * Positive offset = expand outward (for CCW polygon)
 * Negative offset = shrink inward
 *
 * joinType controls corner treatment:
 *  - miter: sharp corners
 *  - round: rounded corners
 *  - square: flat corners
 */
export function offsetPolygon(
  polygon: Polygon,
  offsetMm: number,
  joinType: OffsetJoinType = 'round',
  miterLimit = 2.0,
  arcTolerance = 0.25,
): Polygon[] {
  const co = new ClipperLib.ClipperOffset(miterLimit, arcTolerance * CLIPPER_SCALE)
  const path = toClipperPath(polygon)

  co.AddPath(
    path,
    JOIN_TYPE_MAP[joinType],
    ClipperLib.EndType.etClosedPolygon,
  )

  const solution: ClipperLib.IntPoint[][] = []
  co.Execute(solution, offsetMm * CLIPPER_SCALE)

  return fromClipperPaths(solution)
}

/**
 * Offsets an open polyline (not closed) by a distance.
 * Useful for offsetting individual open shapes like lines/arcs/beziers.
 */
export function offsetOpenPath(
  points: Point[],
  offsetMm: number,
  joinType: OffsetJoinType = 'round',
  miterLimit = 2.0,
  arcTolerance = 0.25,
): Polygon[] {
  const co = new ClipperLib.ClipperOffset(miterLimit, arcTolerance * CLIPPER_SCALE)
  const path = toClipperPath(points)

  co.AddPath(
    path,
    JOIN_TYPE_MAP[joinType],
    ClipperLib.EndType.etOpenRound,
  )

  const solution: ClipperLib.IntPoint[][] = []
  co.Execute(solution, offsetMm * CLIPPER_SCALE)

  return fromClipperPaths(solution)
}

/**
 * Creates proper offset geometry for selected shapes using Clipper.
 *
 * Replaces the naive perpendicular offset in advanced-pattern-ops.ts
 * with Clipper's robust polygon offset that handles:
 *  - Self-intersection removal
 *  - Corner treatment (miter/round/square)
 *  - Closed polygon detection
 */
export function clipperOffsetForSelection(
  shapes: Shape[],
  selectedShapeIds: Set<string>,
  offsetMm: number,
  joinType: OffsetJoinType,
  lineTypeId: string,
): {
  ok: boolean
  message: string
  created: Shape[]
} {
  if (selectedShapeIds.size === 0) {
    return { ok: false, message: 'Select shapes to offset', created: [] }
  }

  if (Math.abs(offsetMm) < 0.001) {
    return { ok: false, message: 'Offset distance must be non-zero', created: [] }
  }

  const selectedShapes = shapes.filter((s) => selectedShapeIds.has(s.id) && s.type !== 'text')

  // Try to chain into closed polygons first
  const polygons = shapesToPolygons(selectedShapes)
  const created: Shape[] = []

  if (polygons.length > 0) {
    for (const poly of polygons) {
      // Check if polygon is closed (first point ~= last point)
      const isClosed =
        poly.length >= 3 &&
        Math.hypot(poly[0].x - poly[poly.length - 1].x, poly[0].y - poly[poly.length - 1].y) < 1.0

      let resultPolys: Polygon[]
      if (isClosed) {
        resultPolys = offsetPolygon(poly, offsetMm, joinType)
      } else {
        resultPolys = offsetOpenPath(poly, offsetMm, joinType)
      }

      for (const resultPoly of resultPolys) {
        if (resultPoly.length < 2) continue
        const layerId = selectedShapes[0]?.layerId ?? ''
        const lt = lineTypeId || (selectedShapes[0]?.lineTypeId ?? '')
        const groupId = selectedShapes[0]?.groupId
        created.push(
          ...polygonToLineShapes(resultPoly, layerId, lt, groupId, isClosed),
        )
      }
    }
  } else {
    // Fallback: offset each shape individually as open paths
    for (const shape of selectedShapes) {
      const points = shapeToPolyline(shape)
      if (points.length < 2) continue

      const resultPolys = offsetOpenPath(points, offsetMm, joinType)
      for (const resultPoly of resultPolys) {
        if (resultPoly.length < 2) continue
        created.push(
          ...polygonToLineShapes(resultPoly, shape.layerId, lineTypeId || shape.lineTypeId, shape.groupId, false),
        )
      }
    }
  }

  if (created.length === 0) {
    return { ok: false, message: 'Offset produced no geometry', created: [] }
  }

  return {
    ok: true,
    message: `Created ${created.length} offset shape(s)`,
    created,
  }
}

/**
 * Builds a Clipper-based seam allowance SVG path for a shape.
 * Replaces the naive buildSeamAllowancePath in pattern-ops.ts.
 */
export function buildClipperSeamPath(shape: Shape, offsetMm: number): string | null {
  if (!Number.isFinite(offsetMm) || Math.abs(offsetMm) < 0.001) {
    return null
  }

  const points = shapeToPolyline(shape)
  if (points.length < 2) return null

  const resultPolys = offsetOpenPath(points, offsetMm, 'round')
  if (resultPolys.length === 0) return null

  // Use the largest result polygon
  let bestPoly = resultPolys[0]
  let bestLen = bestPoly.length
  for (let i = 1; i < resultPolys.length; i++) {
    if (resultPolys[i].length > bestLen) {
      bestPoly = resultPolys[i]
      bestLen = bestPoly.length
    }
  }

  const commands = bestPoly.map(
    (p, i) => `${i === 0 ? 'M' : 'L'} ${Number(p.x.toFixed(3))} ${Number(p.y.toFixed(3))}`,
  )
  return commands.join(' ')
}
