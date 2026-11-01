import { describe, expect, it } from 'vitest'
import type { Shape } from '../cad/cad-types'
import { applyPrintCalibration, buildPrintPlan } from './print-preview'

const panel: Shape[] = [
  { id: 'x', type: 'line', layerId: 'main', lineTypeId: 'cut', start: { x: -12, y: 8 }, end: { x: 88, y: 8 } },
  { id: 'y', type: 'line', layerId: 'main', lineTypeId: 'cut', start: { x: -12, y: 8 }, end: { x: -12, y: 108 } },
]

describe('physical print coverage', () => {
  it.each([50, 100, 125, 200])('keeps a 100mm panel at %s percent instead of fitting it to paper', scalePercent => {
    const plan = buildPrintPlan(panel, { paper: 'a4', marginMm: 10, overlapMm: 5, tileX: 1, tileY: 1, scalePercent })!
    expect(100 / plan.tiles[0].width * (plan.paperWidthMm - 20)).toBeCloseTo(scalePercent, 10)
    expect(100 / plan.tiles[0].height * (plan.paperHeightMm - 20)).toBeCloseTo(scalePercent, 10)
    expect(plan.tiles[0].minX).toBe(-12)
    expect(plan.tiles[0].minY).toBe(8)
  })

  it('uses a constant page size and physical overlap across every tile', () => {
    const plan = buildPrintPlan(panel, { paper: 'letter', orientation: 'landscape', marginMm: 10, overlapMm: 7, tileX: 3, tileY: 2, scalePercent: 125 })!
    expect([plan.paperWidthMm, plan.paperHeightMm]).toEqual([279.4, 215.9])
    const [first, second, third, nextRow] = plan.tiles
    expect(first.width).toBeCloseTo(second.width)
    expect(second.width).toBeCloseTo(third.width)
    expect((first.minX + first.width - second.minX) * 1.25).toBeCloseTo(7, 10)
    expect((second.minX + second.width - third.minX) * 1.25).toBeCloseTo(7, 10)
    expect((first.minY + first.height - nextRow.minY) * 1.25).toBeCloseTo(7, 10)
    expect(plan.contentWidthMm).toBeCloseTo((279.4 - 20) * 3 - 14)
  })

  it('bounds excessive margins and overlap to positive advancing tiles', () => {
    const plan = buildPrintPlan(panel, { paper: 'a4', marginMm: 999, overlapMm: 999, tileX: 2, tileY: 1, scalePercent: 100 })!
    expect(plan.tiles[0].width).toBeGreaterThan(0)
    expect(plan.tiles[1].minX).toBeGreaterThan(plan.tiles[0].minX)
  })

  it('includes circular arc extrema between defining points without viewport padding', () => {
    const point = (degrees: number) => ({ x: 50 * Math.cos(degrees * Math.PI / 180), y: 50 * Math.sin(degrees * Math.PI / 180) })
    const arc: Shape = { id: 'arc', type: 'arc', layerId: 'main', lineTypeId: 'cut', start: point(20), mid: point(100), end: point(160) }
    const plan = buildPrintPlan([arc], { paper: 'a4', marginMm: 10, overlapMm: 5, tileX: 1, tileY: 1, scalePercent: 100 })!
    expect(plan.sourceBounds.minY + plan.sourceBounds.height).toBeCloseTo(50, 2)
    expect(plan.sourceBounds.width).toBeLessThan(100)
  })
})


describe('calibrated physical tile coverage', () => {
  it.each(['portrait', 'landscape'] as const)('preserves physical overlap with unequal X/Y calibration in %s', orientation => {
    const plan = buildPrintPlan(panel, { paper: 'a4', orientation, marginMm: 10, overlapMm: 10, tileX: 3, tileY: 2, scalePercent: 125, calibrationXPercent: 110, calibrationYPercent: 90 })!
    const xScale = 1.25 * (orientation === 'landscape' ? 0.9 : 1.1)
    const yScale = 1.25 * (orientation === 'landscape' ? 1.1 : 0.9)
    expect(plan.effectiveScaleX).toBeCloseTo(xScale, 12)
    expect(plan.effectiveScaleY).toBeCloseTo(yScale, 12)
    const [first, second, third, nextRow] = plan.tiles
    expect(first.width * xScale).toBeCloseTo(plan.paperWidthMm - 20, 10)
    expect(first.height * yScale).toBeCloseTo(plan.paperHeightMm - 20, 10)
    expect((first.minX + first.width - second.minX) * xScale).toBeCloseTo(10, 10)
    expect((second.minX + second.width - third.minX) * xScale).toBeCloseTo(10, 10)
    expect((first.minY + first.height - nextRow.minY) * yScale).toBeCloseTo(10, 10)
    expect(second.minX).toBeLessThan(first.minX + first.width)
    expect(nextRow.minY).toBeLessThan(first.minY + first.height)
  })

  it('recalibrates a default plan without shifting its origin or compounding scale', () => {
    const base = buildPrintPlan(panel, { paper: 'letter', marginMm: 10, overlapMm: 10, tileX: 2, tileY: 2, scalePercent: 100 })!
    const once = applyPrintCalibration(base, 110, 90), twice = applyPrintCalibration(once, 110, 90)
    expect(twice).toEqual(once)
    expect(once.tiles[0].minX).toBe(base.tiles[0].minX)
    expect(once.tiles[0].minY).toBe(base.tiles[0].minY)
    expect(once.tiles[0].width).toBeCloseTo((215.9 - 20) / 1.1, 10)
  })
})
