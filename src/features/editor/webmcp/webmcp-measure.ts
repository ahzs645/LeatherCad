/**
 * What the agent is allowed to know about the pattern on screen.
 *
 * Every number here is measured off resolved geometry — the same outline
 * chains and piece meshes the canvas and the 3D preview read — rather than off
 * whatever JSON produced it. That matters for an agent loop: the model writes
 * geometry, then reads back what the app actually made of it, so a piece whose
 * boundary failed to close reports as unresolved instead of reporting the
 * dimensions the model asked for.
 */

import type { DocFile, Point, StitchHole } from '../cad/cad-types'
import { pointInPolygon } from '../ops/outline-detection'
import { resolvePatternPieceChains } from '../ops/pattern-piece-ops'
import { buildPieceMeshes } from '../three/piece-mesh-data'

export type PieceMeasurement = {
  pieceId: string
  name: string
  quantity: number
  material?: string
  onFold: boolean
  widthMm: number
  heightMm: number
  boundsMm: { minX: number; minY: number; maxX: number; maxY: number }
  centerMm: Point
  cutAreaMm2: number
  perimeterMm: number
  cutoutCount: number
  stitchHoleCount: number
}

export type DocumentSummary = {
  documentName: string
  units: 'mm'
  layerCount: number
  shapeCount: number
  patternPieceCount: number
  unresolvedPieceCount: number
  foldCount: number
  stitchHoleCount: number
  hardwareMarkerCount: number
  seamConnectionCount: number
  totalCutAreaMm2: number
  totalStitchRunMm: number
  pieces: PieceMeasurement[]
}

function polygonAreaMm2(polygon: Point[]): number {
  if (polygon.length < 3) {
    return 0
  }
  let sum = 0
  for (let index = 0; index < polygon.length; index += 1) {
    const current = polygon[index]
    const next = polygon[(index + 1) % polygon.length]
    sum += current.x * next.y - next.x * current.y
  }
  return Math.abs(sum) / 2
}

function polygonPerimeterMm(polygon: Point[]): number {
  if (polygon.length < 2) {
    return 0
  }
  let total = 0
  for (let index = 0; index < polygon.length; index += 1) {
    const current = polygon[index]
    const next = polygon[(index + 1) % polygon.length]
    total += Math.hypot(next.x - current.x, next.y - current.y)
  }
  return total
}

/**
 * Thread is bought by the metre, so the run a pattern will actually be sewn
 * along is worth reporting. Measured hole to hole within each stitched shape —
 * consecutive holes on one shape are one run, and a gap between shapes is a
 * new run rather than a leap across the piece.
 */
export function measureStitchRunMm(stitchHoles: StitchHole[]): number {
  const byShape = new Map<string, StitchHole[]>()
  for (const hole of stitchHoles) {
    const existing = byShape.get(hole.shapeId)
    if (existing) {
      existing.push(hole)
    } else {
      byShape.set(hole.shapeId, [hole])
    }
  }

  let total = 0
  for (const holes of byShape.values()) {
    const ordered = [...holes].sort((a, b) => a.sequence - b.sequence)
    for (let index = 1; index < ordered.length; index += 1) {
      const previous = ordered[index - 1].point
      const current = ordered[index].point
      total += Math.hypot(current.x - previous.x, current.y - previous.y)
    }
  }
  return total
}

export function measurePatternPieces(doc: DocFile): PieceMeasurement[] {
  const pieces = doc.patternPieces ?? []
  if (pieces.length === 0) {
    return []
  }

  const { byShapeId } = resolvePatternPieceChains(doc.objects, doc.lineTypes)
  const meshes = buildPieceMeshes(pieces, byShapeId)
  const meshById = new Map(meshes.map((mesh) => [mesh.pieceId, mesh]))

  // Stitch holes are counted by where they sit, not by which shape they hang
  // off. A stitch line is its own shape, and whether it belongs to a piece is a
  // question about the leather it is punched through.
  const holePoints = (doc.stitchHoles ?? []).map((hole) => hole.point)

  const measurements: PieceMeasurement[] = []
  for (const piece of pieces) {
    const mesh = meshById.get(piece.id)
    if (!mesh) {
      // The boundary did not resolve into a closed chain, so there is nothing
      // honest to measure. Reported as zeroes with the name intact so the
      // agent can see which piece failed rather than seeing it vanish.
      measurements.push({
        pieceId: piece.id,
        name: piece.name,
        quantity: piece.quantity,
        material: piece.material,
        onFold: piece.onFold,
        widthMm: 0,
        heightMm: 0,
        boundsMm: { minX: 0, minY: 0, maxX: 0, maxY: 0 },
        centerMm: { x: 0, y: 0 },
        cutAreaMm2: 0,
        perimeterMm: 0,
        cutoutCount: 0,
        stitchHoleCount: 0,
      })
      continue
    }

    const cutoutArea = mesh.holes.reduce((sum, hole) => sum + polygonAreaMm2(hole), 0)
    const stitchHoleCount = holePoints.filter((point) => pointInPolygon(point, mesh.outer)).length

    measurements.push({
      pieceId: piece.id,
      name: piece.name,
      quantity: piece.quantity,
      material: piece.material,
      onFold: piece.onFold,
      widthMm: mesh.bounds.width,
      heightMm: mesh.bounds.height,
      boundsMm: {
        minX: mesh.bounds.minX,
        minY: mesh.bounds.minY,
        maxX: mesh.bounds.maxX,
        maxY: mesh.bounds.maxY,
      },
      centerMm: mesh.center,
      cutAreaMm2: Math.max(0, polygonAreaMm2(mesh.outer) - cutoutArea),
      perimeterMm: polygonPerimeterMm(mesh.outer),
      cutoutCount: mesh.holes.length,
      stitchHoleCount,
    })
  }

  return measurements
}

export function summarizeDocument(doc: DocFile): DocumentSummary {
  const pieces = measurePatternPieces(doc)
  const stitchHoles = doc.stitchHoles ?? []
  return {
    documentName: doc.documentName ?? 'Untitled',
    units: 'mm',
    layerCount: doc.layers.length,
    shapeCount: doc.objects.length,
    patternPieceCount: pieces.length,
    unresolvedPieceCount: pieces.filter((piece) => piece.perimeterMm === 0).length,
    foldCount: doc.foldLines.length,
    stitchHoleCount: stitchHoles.length,
    hardwareMarkerCount: (doc.hardwareMarkers ?? []).length,
    seamConnectionCount: (doc.seamConnections ?? []).length,
    totalCutAreaMm2: pieces.reduce(
      (sum, piece) => sum + piece.cutAreaMm2 * Math.max(1, piece.quantity),
      0,
    ),
    totalStitchRunMm: measureStitchRunMm(stitchHoles),
    pieces,
  }
}
