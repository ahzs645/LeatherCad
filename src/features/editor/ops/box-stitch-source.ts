import type { BoxStitchSource, Shape } from '../cad/cad-types'

export type BoxStitchSourceShape = Extract<Shape, { type: 'line' | 'arc' | 'bezier' }>

export function isBoxStitchSourceEligibleShape(shape: Shape): shape is BoxStitchSourceShape {
  return shape.type === 'line' || shape.type === 'arc' || shape.type === 'bezier'
}

export function isExtractedBoxStitchSourceValue(
  value: BoxStitchSourceShape['boxStitchSource'] | undefined,
): value is BoxStitchSource {
  return Boolean(
    value &&
      typeof value === 'object' &&
      'extracted' in value &&
      (value as { extracted?: unknown }).extracted === true,
  )
}

export function hasExtractedBoxStitchSource(
  shape: Shape,
): shape is BoxStitchSourceShape & { boxStitchSource: BoxStitchSource } {
  if (!isBoxStitchSourceEligibleShape(shape)) {
    return false
  }
  return isExtractedBoxStitchSourceValue(shape.boxStitchSource)
}
