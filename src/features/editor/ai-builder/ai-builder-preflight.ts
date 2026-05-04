import type {
  DocFile,
  LineType,
  PatternPiece,
  PieceEdgeSpan,
  Point,
  SeamConnection,
  StitchHole,
} from '../cad/cad-types'
import {
  getPatternPieceChain,
  pointAlongPolyline,
  resolvePatternPieceChains,
} from '../ops/pattern-piece-ops'
import type { AiBuilderLeatherRef, AiBuilderPreflightIssue } from './ai-builder-types'
import { makeLeatherRef } from './ai-builder-refs'

const DEFAULT_SEAM_TOLERANCE_MM = 1

function pushIssue(
  issues: AiBuilderPreflightIssue[],
  severity: AiBuilderPreflightIssue['severity'],
  code: string,
  message: string,
  ref?: string,
) {
  issues.push({ severity, code, message, ref })
}

function lineTypeById(lineTypes: LineType[]) {
  return Object.fromEntries(lineTypes.map((lineType) => [lineType.id, lineType]))
}

function segmentIntersection(a: Point, b: Point, c: Point, d: Point) {
  const abx = b.x - a.x
  const aby = b.y - a.y
  const cdx = d.x - c.x
  const cdy = d.y - c.y
  const denominator = abx * cdy - aby * cdx
  if (Math.abs(denominator) < 1e-9) {
    return false
  }
  const acx = c.x - a.x
  const acy = c.y - a.y
  const t = (acx * cdy - acy * cdx) / denominator
  const u = (acx * aby - acy * abx) / denominator
  return t > 1e-6 && t < 1 - 1e-6 && u > 1e-6 && u < 1 - 1e-6
}

function polygonSelfIntersects(points: Point[]) {
  if (points.length < 5) {
    return false
  }

  for (let i = 0; i < points.length - 1; i += 1) {
    for (let j = i + 1; j < points.length - 1; j += 1) {
      const adjacent = Math.abs(i - j) <= 1 || (i === 0 && j === points.length - 2)
      if (adjacent) {
        continue
      }
      if (segmentIntersection(points[i], points[i + 1], points[j], points[j + 1])) {
        return true
      }
    }
  }

  return false
}

function pieceRef(piece: PatternPiece) {
  return makeLeatherRef('pattern_piece', piece.id)
}

function seamRef(connection: SeamConnection) {
  return makeLeatherRef('seam_connection', connection.id)
}

function edgeSpanLength(piece: PatternPiece, connectionSide: PieceEdgeSpan | SeamConnection['from'], polygon: Point[]) {
  const edgeIndex = Math.max(0, Math.min(polygon.length - 2, connectionSide.edgeIndex))
  const t0 = 't0' in connectionSide ? connectionSide.t0 : undefined
  const t1 = 't1' in connectionSide ? connectionSide.t1 : undefined
  const sampledStart = pointAlongPolyline(polygon, edgeIndex, t0 ?? 0)
  const sampledEnd = pointAlongPolyline(polygon, edgeIndex, t1 ?? 1)
  if (!sampledStart || !sampledEnd) {
    return null
  }
  const length = Math.hypot(sampledEnd.point.x - sampledStart.point.x, sampledEnd.point.y - sampledStart.point.y)
  return {
    pieceId: piece.id,
    edgeIndex,
    length,
  }
}

function checkPatternPieces(doc: DocFile, issues: AiBuilderPreflightIssue[]) {
  const pieces = doc.patternPieces ?? []
  if (pieces.length === 0) {
    pushIssue(issues, 'info', 'no-pattern-pieces', 'No pattern pieces are defined yet.')
    return
  }

  const chains = resolvePatternPieceChains(doc.objects, doc.lineTypes)
  for (const piece of pieces) {
    const chain = getPatternPieceChain(piece, chains.byShapeId)
    if (!chain) {
      pushIssue(issues, 'error', 'open-piece-boundary', `${piece.name} does not resolve to a closed boundary.`, pieceRef(piece))
      continue
    }
    if (polygonSelfIntersects(chain.polygon)) {
      pushIssue(issues, 'error', 'self-intersecting-piece', `${piece.name} boundary appears to self-intersect.`, pieceRef(piece))
    }
  }
}

function checkSeamConnections(doc: DocFile, issues: AiBuilderPreflightIssue[]) {
  const pieces = doc.patternPieces ?? []
  const seams = doc.seamConnections ?? []
  if (seams.length === 0) {
    return
  }

  const chains = resolvePatternPieceChains(doc.objects, doc.lineTypes)
  const piecesById = new Map(pieces.map((piece) => [piece.id, piece]))
  for (const connection of seams) {
    const fromPiece = piecesById.get(connection.from.pieceId)
    const toPiece = piecesById.get(connection.to.pieceId)
    if (!fromPiece || !toPiece) {
      pushIssue(issues, 'error', 'invalid-seam-piece', `${connection.id} references a missing pattern piece.`, seamRef(connection))
      continue
    }
    const fromChain = getPatternPieceChain(fromPiece, chains.byShapeId)
    const toChain = getPatternPieceChain(toPiece, chains.byShapeId)
    if (!fromChain || !toChain) {
      pushIssue(issues, 'warning', 'seam-open-piece-boundary', `${connection.id} cannot be length-checked because one piece boundary is open.`, seamRef(connection))
      continue
    }
    const fromLength = edgeSpanLength(fromPiece, connection.fromSpan ?? connection.from, fromChain.polygon)
    const toLength = edgeSpanLength(toPiece, connection.toSpan ?? connection.to, toChain.polygon)
    if (!fromLength || !toLength) {
      pushIssue(issues, 'warning', 'seam-edge-unavailable', `${connection.id} references an edge that cannot be measured.`, seamRef(connection))
      continue
    }
    const delta = Math.abs(fromLength.length - toLength.length)
    const tolerance = connection.toleranceMm ?? DEFAULT_SEAM_TOLERANCE_MM
    if (delta > tolerance) {
      pushIssue(
        issues,
        'warning',
        'seam-length-mismatch',
        `${connection.id} edge lengths differ by ${delta.toFixed(1)}mm, above ${tolerance.toFixed(1)}mm tolerance.`,
        seamRef(connection),
      )
    }
  }
}

function checkStitches(doc: DocFile, issues: AiBuilderPreflightIssue[]) {
  const lineTypes = lineTypeById(doc.lineTypes)
  const stitchShapes = doc.objects.filter((shape) => lineTypes[shape.lineTypeId]?.role === 'stitch')
  if (stitchShapes.length === 0) {
    pushIssue(issues, 'info', 'no-stitch-paths', 'No stitch paths are defined yet.')
    return
  }

  const holesByShape = new Map<string, StitchHole[]>()
  for (const hole of doc.stitchHoles ?? []) {
    holesByShape.set(hole.shapeId, [...(holesByShape.get(hole.shapeId) ?? []), hole])
  }

  for (const shape of stitchShapes) {
    const holes = holesByShape.get(shape.id) ?? []
    if (holes.length < 2) {
      pushIssue(issues, 'warning', 'stitch-path-without-holes', `${shape.id} has fewer than two generated stitch holes.`, makeLeatherRef('shape', shape.id))
    }
  }
}

function checkFolds(doc: DocFile, issues: AiBuilderPreflightIssue[]) {
  for (const foldLine of doc.foldLines) {
    const radius = foldLine.radiusMm ?? 0
    const thickness = foldLine.thicknessMm ?? 0
    if (thickness > 0 && radius < thickness * 0.25) {
      pushIssue(
        issues,
        'warning',
        'tight-fold-radius',
        `${foldLine.name} radius is small for ${thickness.toFixed(1)}mm material thickness.`,
        makeLeatherRef('fold', foldLine.id),
      )
    }
  }
}

function checkExportReadiness(doc: DocFile, issues: AiBuilderPreflightIssue[]) {
  const lineTypes = lineTypeById(doc.lineTypes)
  const roleCounts = new Map<string, number>()
  for (const shape of doc.objects) {
    const role = lineTypes[shape.lineTypeId]?.role ?? 'cut'
    roleCounts.set(role, (roleCounts.get(role) ?? 0) + 1)
  }
  if ((roleCounts.get('cut') ?? 0) === 0) {
    pushIssue(issues, 'error', 'missing-cut-lines', 'No cut-line geometry exists for export.')
  }
  if ((doc.printAreas ?? []).some((area) => area.scalePercent <= 0)) {
    pushIssue(issues, 'error', 'invalid-print-scale', 'A print area has an invalid scale percentage.')
  }
}

export function runAiBuilderPreflight(doc: DocFile, _refs: AiBuilderLeatherRef[] = []): AiBuilderPreflightIssue[] {
  void _refs
  const issues: AiBuilderPreflightIssue[] = []
  checkPatternPieces(doc, issues)
  checkSeamConnections(doc, issues)
  checkStitches(doc, issues)
  checkFolds(doc, issues)
  checkExportReadiness(doc, issues)
  return issues
}
