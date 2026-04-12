import { Vector2 } from 'three'
import { sampleShapePoints } from '../cad/cad-geometry'
import type { Shape } from '../cad/cad-types'
import type { ModelTransform } from './model-builder-types'

export function projectPoint(point: { x: number; y: number }, transform: ModelTransform) {
  return new Vector2(
    (point.x - transform.centerX) * transform.scale,
    -(point.y - transform.centerY) * transform.scale,
  )
}

export function buildBoundsFromShapes(shapes: Shape[]) {
  if (shapes.length === 0) {
    return null
  }

  let minX = Number.POSITIVE_INFINITY
  let maxX = Number.NEGATIVE_INFINITY
  let minY = Number.POSITIVE_INFINITY
  let maxY = Number.NEGATIVE_INFINITY

  for (const shape of shapes) {
    for (const point of sampleShapePoints(shape, shape.type === 'line' ? 1 : 20)) {
      minX = Math.min(minX, point.x)
      maxX = Math.max(maxX, point.x)
      minY = Math.min(minY, point.y)
      maxY = Math.max(maxY, point.y)
    }
  }

  if (!Number.isFinite(minX) || !Number.isFinite(maxX) || !Number.isFinite(minY) || !Number.isFinite(maxY)) {
    return null
  }

  return { minX, maxX, minY, maxY }
}
