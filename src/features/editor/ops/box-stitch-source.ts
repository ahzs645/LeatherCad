import type { BoxStitchSource, Shape } from '../cad/cad-types'

export type BoxStitchSourceShape = Exclude<Shape, { type: 'text' }>

export function isBoxStitchSourceEligibleShape(shape: Shape): shape is BoxStitchSourceShape {
  return shape.type !== 'text'
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
