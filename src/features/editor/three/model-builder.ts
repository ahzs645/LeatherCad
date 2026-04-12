import { ShapeUtils, Vector2 } from 'three'
import type { FoldLine, Point } from '../cad/cad-types'
import { buildPieceMeshes } from './piece-mesh'
import {
  ensureMinSpan,
  padBounds,
} from './bridge/geometry-utils'
import { rebuildAssembledModel } from './assembled-model-builder'
import { rebuildFoldModel } from './fold-surface-builder'
import { buildBoundsFromShapes } from './model-builder-shared'
import type {
  BuildModelLayoutParams,
  BuildModelLayoutResult,
  ModelTransform,
} from './model-builder-types'
import type { OutlinePolygon } from './three-bridge-types'

export type { ModelTransform } from './model-builder-types'
export { rebuildAssembledModel, rebuildFoldModel }

function buildBoundsFromPieceMeshes(pieceMeshes: ReturnType<typeof buildPieceMeshes>) {
  if (pieceMeshes.length === 0) {
    return null
  }

  let minX = Number.POSITIVE_INFINITY
  let minY = Number.POSITIVE_INFINITY
  let maxX = Number.NEGATIVE_INFINITY
  let maxY = Number.NEGATIVE_INFINITY

  for (const piece of pieceMeshes) {
    minX = Math.min(minX, piece.bounds.minX)
    minY = Math.min(minY, piece.bounds.minY)
    maxX = Math.max(maxX, piece.bounds.maxX)
    maxY = Math.max(maxY, piece.bounds.maxY)
  }

  return { minX, minY, maxX, maxY }
}

function buildBoundsFromFoldLines(foldLines: FoldLine[]) {
  if (foldLines.length === 0) {
    return null
  }

  let minX = Number.POSITIVE_INFINITY
  let maxX = Number.NEGATIVE_INFINITY
  let minY = Number.POSITIVE_INFINITY
  let maxY = Number.NEGATIVE_INFINITY

  for (const foldLine of foldLines) {
    minX = Math.min(minX, foldLine.start.x, foldLine.end.x)
    maxX = Math.max(maxX, foldLine.start.x, foldLine.end.x)
    minY = Math.min(minY, foldLine.start.y, foldLine.end.y)
    maxY = Math.max(maxY, foldLine.start.y, foldLine.end.y)
  }

  if (!Number.isFinite(minX) || !Number.isFinite(maxX) || !Number.isFinite(minY) || !Number.isFinite(maxY)) {
    return null
  }

  return { minX, maxX, minY, maxY }
}

function buildChainsByShapeId(outlinePolygons: OutlinePolygon[]) {
  const chainsByShapeId = new Map<
    string,
    { id: string; shapeIds: string[]; polygon: Point[]; isClosed: true; area: number }
  >()

  for (const outline of outlinePolygons) {
    const chain = {
      id: outline.shapeIds[0] ?? outline.layerId,
      shapeIds: outline.shapeIds,
      polygon: outline.polygon,
      isClosed: true as const,
      area: Math.abs(ShapeUtils.area(outline.polygon.map((point) => new Vector2(point.x, point.y)))),
    }
    for (const shapeId of outline.shapeIds) {
      chainsByShapeId.set(shapeId, chain)
    }
  }

  return chainsByShapeId
}

export function buildModelLayout({
  patternPieces,
  outlinePolygons,
  shapes,
  foldLines,
}: BuildModelLayoutParams): BuildModelLayoutResult {
  const pieceMeshes = buildPieceMeshes(patternPieces, buildChainsByShapeId(outlinePolygons))

  let bounds = buildBoundsFromPieceMeshes(pieceMeshes)
  if (!bounds) {
    bounds = buildBoundsFromShapes(shapes)
  }
  if (bounds) {
    bounds = ensureMinSpan(bounds, 80)
  } else {
    const foldBounds = buildBoundsFromFoldLines(foldLines)
    if (foldBounds) {
      bounds = ensureMinSpan(padBounds(foldBounds, 60), 120)
    } else {
      bounds = { minX: -220, maxX: 220, minY: -140, maxY: 140 }
    }
  }

  const width = Math.max(bounds.maxX - bounds.minX, 1)
  const height = Math.max(bounds.maxY - bounds.minY, 1)
  const longest = Math.max(width, height, 1)
  const transform: ModelTransform = {
    scale: 1.65 / longest,
    centerX: (bounds.minX + bounds.maxX) / 2,
    centerY: (bounds.minY + bounds.maxY) / 2,
  }

  return {
    pieceMeshes,
    transform,
    documentBounds: bounds,
  }
}
