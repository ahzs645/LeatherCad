import { describe, expect, it } from 'vitest'
import type { StitchHole } from '../cad/cad-types'
import { createStitchHolePrimitive, resolveStitchHoleRenderAngleDeg } from './stitch-hole-render'

function makeStitchHole(overrides: Partial<StitchHole> = {}): StitchHole {
  return {
    id: 'hole-1',
    shapeId: 'shape-1',
    point: { x: 10, y: 20 },
    angleDeg: 15,
    holeType: 'slit',
    sequence: 0,
    widthMm: 1.2,
    heightMm: 3.4,
    tiltDeg: 30,
    renderShape: 'diamond',
    ...overrides,
  }
}

describe('stitch-hole-render', () => {
  it('uses the inverted tilt to resolve the final render angle', () => {
    const normal = makeStitchHole({ tiltDeg: 25, inverted: false })
    const inverted = makeStitchHole({ tiltDeg: 25, inverted: true })

    expect(resolveStitchHoleRenderAngleDeg(normal)).toBe(40)
    expect(resolveStitchHoleRenderAngleDeg(inverted)).toBe(-10)
  })

  it('renders native diamond holes as closed polygons', () => {
    const primitive = createStitchHolePrimitive(makeStitchHole({ renderShape: 'diamond' }))

    expect(primitive.kind).toBe('polygon')
    if (primitive.kind !== 'polygon') {
      throw new Error('expected polygon primitive')
    }
    expect(primitive.points).toHaveLength(4)
  })

  it('renders round holes as circles using the configured diameter', () => {
    const primitive = createStitchHolePrimitive(
      makeStitchHole({
        holeType: 'round',
        renderShape: 'round',
        diameterMm: 1.6,
        widthMm: undefined,
        heightMm: undefined,
      }),
    )

    expect(primitive.kind).toBe('circle')
    if (primitive.kind !== 'circle') {
      throw new Error('expected circle primitive')
    }
    expect(primitive.radiusMm).toBeCloseTo(0.8)
  })

  it('forces dots mode to export circles even for slit-style holes', () => {
    const primitive = createStitchHolePrimitive(makeStitchHole({ renderShape: 'french' }), {
      mode: 'dots',
      dotRadiusMm: 0.7,
    })

    expect(primitive.kind).toBe('circle')
    if (primitive.kind !== 'circle') {
      throw new Error('expected circle primitive')
    }
    expect(primitive.radiusMm).toBeCloseTo(0.7)
  })

  it('forces single-line mode to export centerline segments', () => {
    const primitive = createStitchHolePrimitive(makeStitchHole({ renderShape: 'diamond' }), {
      mode: 'single-lines',
    })

    expect(primitive.kind).toBe('segment')
    if (primitive.kind !== 'segment') {
      throw new Error('expected segment primitive')
    }
    expect(primitive.start).not.toEqual(primitive.end)
  })

  it('uses native single-line output for source-app zero-width blades', () => {
    const primitive = createStitchHolePrimitive(makeStitchHole({ renderShape: 'diamond', widthMm: 0 }))

    expect(primitive.kind).toBe('segment')
    if (primitive.kind !== 'segment') {
      throw new Error('expected segment primitive')
    }
    expect(primitive.strokeWidthMm).toBeGreaterThan(0)
  })
})
