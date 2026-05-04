import { sampleShapePoints } from '../cad/cad-geometry'
import type { FoldLine, Shape } from '../cad/cad-types'
import type { OutlinePolygon } from './three-bridge'

export function buildFinalProductDocumentBounds(
  shapes: Shape[],
  foldLines: FoldLine[],
  outlinePolygons: OutlinePolygon[],
) {
  let minX = Number.POSITIVE_INFINITY
  let maxX = Number.NEGATIVE_INFINITY
  let minY = Number.POSITIVE_INFINITY
  let maxY = Number.NEGATIVE_INFINITY

  const includePoint = (point: { x: number; y: number }) => {
    minX = Math.min(minX, point.x)
    maxX = Math.max(maxX, point.x)
    minY = Math.min(minY, point.y)
    maxY = Math.max(maxY, point.y)
  }

  for (const outline of outlinePolygons) {
    outline.polygon.forEach(includePoint)
  }
  for (const shape of shapes) {
    sampleShapePoints(shape, shape.type === 'line' ? 1 : 20).forEach(includePoint)
  }
  for (const foldLine of foldLines) {
    includePoint(foldLine.start)
    includePoint(foldLine.end)
  }

  if (!Number.isFinite(minX) || !Number.isFinite(maxX) || !Number.isFinite(minY) || !Number.isFinite(maxY)) {
    return { minX: -220, maxX: 220, minY: -140, maxY: 140 }
  }

  const width = Math.max(maxX - minX, 80)
  const height = Math.max(maxY - minY, 80)
  const centerX = (minX + maxX) / 2
  const centerY = (minY + maxY) / 2
  return {
    minX: centerX - width / 2,
    maxX: centerX + width / 2,
    minY: centerY - height / 2,
    maxY: centerY + height / 2,
  }
}
