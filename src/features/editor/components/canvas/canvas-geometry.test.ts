import { describe, expect, it } from 'vitest'
import { resolveAdaptiveTextFontSize, resolveTextShapeFontSize, shapeBounds, shapeHandleEntries, withPreviewApplied } from './canvas-geometry'
import type { CubicShape, EllipseShape } from '../../cad/cad-types'

const cubic: CubicShape = { id: 'cubic', type: 'cubic', layerId: 'layer', lineTypeId: 'cut', start: { x: 0, y: 0 }, control1: { x: 0, y: 100 }, control2: { x: 100, y: 100 }, end: { x: 100, y: 0 } }
const ellipse: EllipseShape = { id: 'ellipse', type: 'ellipse', layerId: 'layer', lineTypeId: 'cut', center: { x: 0, y: 0 }, radiusX: 20, radiusY: 10, rotationDeg: 45, startAngleDeg: 0, sweepDeg: 360 }

describe('native curve canvas geometry', () => {
  it('uses analytic extrema for culling rather than control or axis endpoints', () => {
    expect(shapeBounds(cubic)).toEqual({ minX: 0, minY: 0, maxX: 100, maxY: 75 })
    const bounds = shapeBounds(ellipse)
    expect(bounds.maxX).toBeCloseTo(Math.sqrt(250), 8)
    expect(bounds.minY).toBeCloseTo(-Math.sqrt(250), 8)
  })

  it('exposes both cubic controls and ellipse center; locked geometry has no drag handles', () => {
    expect(shapeHandleEntries(cubic).map(entry => entry.key)).toEqual(['start', 'control1', 'control2', 'end'])
    expect(shapeHandleEntries(ellipse)).toEqual([{ key: 'center', point: ellipse.center }])
    expect(shapeHandleEntries({ ...cubic, locked: true })).toEqual([])
  })

  it('moves analytic ellipses and previews cubic control-following exactly', () => {
    const moved = withPreviewApplied(ellipse, { kind: 'move', shapeIds: ['ellipse'], deltaX: 10, deltaY: -5 })
    expect(moved).toMatchObject({ type: 'ellipse', center: { x: 10, y: -5 } })
    expect(moved.type === 'ellipse' && moved.radiusX).toBeCloseTo(20)
    const preview = { kind: 'handle' as const, shapeId: 'cubic', pointKey: 'start' as const, point: { x: 5, y: 7 } }
    expect(withPreviewApplied(cubic, { ...preview, followControl: true })).toMatchObject({ start: { x: 5, y: 7 }, control1: { x: 5, y: 107 }, control2: cubic.control2 })
    expect(withPreviewApplied(cubic, { ...preview, followControl: false })).toMatchObject({ start: { x: 5, y: 7 }, control1: cubic.control1 })
  })
})

describe('resolveAdaptiveTextFontSize', () => {
  it('raises small text to the screen minimum when zoomed out', () => {
    expect(resolveAdaptiveTextFontSize(2, 1)).toBe(11)
    expect(resolveAdaptiveTextFontSize(2, 2)).toBe(5.5)
  })

  it('preserves authored size while it is inside the readable screen range', () => {
    expect(resolveAdaptiveTextFontSize(12, 1)).toBe(12)
  })

  it('does not let high zoom force text above the screen cap', () => {
    expect(resolveAdaptiveTextFontSize(2, 10)).toBe(1.4)
    expect(resolveAdaptiveTextFontSize(12, 40)).toBe(0.35)
  })

  it('allows callers to tune the screen-space range', () => {
    expect(resolveAdaptiveTextFontSize(2, 1, 9, 16)).toBe(9)
    expect(resolveAdaptiveTextFontSize(20, 1, 9, 16)).toBe(16)
  })
})

describe('resolveTextShapeFontSize', () => {
  it('renders text at the size it was authored, whatever the zoom', () => {
    // Drawn content, not an annotation: it prints at this size, so the canvas
    // has to show it at this size.
    expect(resolveTextShapeFontSize(3.53)).toBe(3.53)
    expect(resolveTextShapeFontSize(12)).toBe(12)
  })

  it('keeps lines set 1.2x apart from colliding, which adapting does not', () => {
    // An imported sheet's label block: 3.53mm type on 4.23mm line spacing.
    const authored = 3.53
    const spacingMm = 4.23

    // At every zoom the drawn size is the authored size, so the gap holds.
    for (const scale of [0.2, 1, 1.73, 8, 40]) {
      expect(resolveTextShapeFontSize(authored)).toBeLessThan(spacingMm)
      // The adaptive rule, by contrast, overflows the line box as soon as the
      // 11px floor bites — which is anything under a ~3x zoom.
      if (scale < 3) {
        expect(resolveAdaptiveTextFontSize(authored, scale)).toBeGreaterThan(spacingMm)
      }
    }
  })

  it('falls back to a sane size for a missing or nonsense one', () => {
    expect(resolveTextShapeFontSize(0)).toBe(2)
    expect(resolveTextShapeFontSize(Number.NaN)).toBe(2)
    expect(resolveTextShapeFontSize(-4)).toBe(2)
  })
})
