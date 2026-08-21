import type { PatternPiece, Point } from '../cad/cad-types'
import type { OutlineChain } from '../ops/outline-detection'

export type PieceOutlineEdge = {
  index: number
  start: Point
  end: Point
  midpoint: Point
  lengthMm: number
}

/**
 * The run of boundary edges contributed by one authored shape. Carried through
 * from the outline chain so a seam can name a whole side — including a curved
 * one, which samples to ~48 consecutive edges.
 */
export type PieceShapeSegment = {
  shapeId: string
  firstEdgeIndex: number
  lastEdgeIndex: number
}

export type PieceMeshData = {
  pieceId: string
  name: string
  outer: Point[]
  holes: Point[][]
  shapeSegments: PieceShapeSegment[]
  bounds: {
    minX: number
    minY: number
    maxX: number
    maxY: number
    width: number
    height: number
  }
  center: Point
  edges: PieceOutlineEdge[]
}

function pointsEqual(a: Point, b: Point, epsilon = 1e-6) {
  return Math.abs(a.x - b.x) <= epsilon && Math.abs(a.y - b.y) <= epsilon
}

export function normalizeClosedPolygon(points: Point[]) {
  if (points.length >= 2 && pointsEqual(points[0], points[points.length - 1])) {
    return points.slice(0, -1)
  }
  return [...points]
}

function boundsFromPolygon(points: Point[]) {
  let minX = Number.POSITIVE_INFINITY
  let minY = Number.POSITIVE_INFINITY
  let maxX = Number.NEGATIVE_INFINITY
  let maxY = Number.NEGATIVE_INFINITY

  for (const point of points) {
    minX = Math.min(minX, point.x)
    minY = Math.min(minY, point.y)
    maxX = Math.max(maxX, point.x)
    maxY = Math.max(maxY, point.y)
  }

  if (!Number.isFinite(minX) || !Number.isFinite(minY) || !Number.isFinite(maxX) || !Number.isFinite(maxY)) {
    return null
  }

  return {
    minX,
    minY,
    maxX,
    maxY,
    width: maxX - minX,
    height: maxY - minY,
  }
}

function buildEdges(points: Point[]): PieceOutlineEdge[] {
  const polygon = normalizeClosedPolygon(points)
  const edges: PieceOutlineEdge[] = []
  for (let index = 0; index < polygon.length; index += 1) {
    const start = polygon[index]
    const end = polygon[(index + 1) % polygon.length]
    const dx = end.x - start.x
    const dy = end.y - start.y
    const lengthMm = Math.hypot(dx, dy)
    if (lengthMm <= 1e-6) {
      continue
    }
    edges.push({
      index,
      start,
      end,
      midpoint: {
        x: (start.x + end.x) / 2,
        y: (start.y + end.y) / 2,
      },
      lengthMm,
    })
  }
  return edges
}

export function buildPieceMeshData(
  piece: PatternPiece,
  chainsByShapeId: Map<string, OutlineChain>,
): PieceMeshData | null {
  const outerChain = chainsByShapeId.get(piece.boundaryShapeId)
  if (!outerChain?.isClosed) {
    return null
  }

  const outer = normalizeClosedPolygon(outerChain.polygon)
  if (outer.length < 3) {
    return null
  }

  const holes = piece.internalShapeIds
    .map((shapeId) => chainsByShapeId.get(shapeId))
    .filter((chain): chain is OutlineChain => Boolean(chain?.isClosed))
    .map((chain) => normalizeClosedPolygon(chain.polygon))
    .filter((polygon) => polygon.length >= 3)

  const bounds = boundsFromPolygon(outer)
  if (!bounds) {
    return null
  }

  const shapeSegments = outerChain.segments
    .filter((segment) => segment.endIndex > segment.startIndex)
    .map((segment) => ({
      shapeId: segment.shapeId,
      firstEdgeIndex: segment.startIndex,
      lastEdgeIndex: segment.endIndex - 1,
    }))

  return {
    pieceId: piece.id,
    name: piece.name,
    shapeSegments,
    outer,
    holes,
    bounds,
    center: {
      x: bounds.minX + bounds.width / 2,
      y: bounds.minY + bounds.height / 2,
    },
    edges: buildEdges(outer),
  }
}

export function buildPieceMeshes(
  pieces: PatternPiece[],
  chainsByShapeId: Map<string, OutlineChain>,
) {
  return pieces
    .map((piece) => buildPieceMeshData(piece, chainsByShapeId))
    .filter((piece): piece is PieceMeshData => piece !== null)
}


/** Edge lookup by polygon index. `edges` is sparse — degenerate edges are
 *  dropped — so array position and edge index are not interchangeable. */
export function edgeAtIndex(piece: PieceMeshData, edgeIndex: number): PieceOutlineEdge | null {
  return piece.edges.find((edge) => edge.index === edgeIndex) ?? null
}

/** Every boundary edge belonging to one authored shape, in polygon order. */
export function edgesForShape(piece: PieceMeshData, shapeId: string): PieceOutlineEdge[] {
  const segment = piece.shapeSegments.find((entry) => entry.shapeId === shapeId)
  if (!segment) {
    return []
  }
  return piece.edges.filter(
    (edge) => edge.index >= segment.firstEdgeIndex && edge.index <= segment.lastEdgeIndex,
  )
}
