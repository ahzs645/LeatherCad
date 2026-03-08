import { describe, it, expect } from 'vitest'
import {
  detectAutoConstraints,
  DEFAULT_AUTO_CONSTRAINT_SETTINGS,
  type AutoConstraintSettings,
} from './auto-constraint-ops'
import type { Shape } from '../cad/cad-types'

function makeLine(id: string, x1: number, y1: number, x2: number, y2: number): Shape {
  return {
    id,
    type: 'line',
    layerId: 'l1',
    lineTypeId: 'lt1',
    start: { x: x1, y: y1 },
    end: { x: x2, y: y2 },
  }
}

const settings = DEFAULT_AUTO_CONSTRAINT_SETTINGS

describe('detectAutoConstraints', () => {
  it('returns empty when disabled', () => {
    const disabled: AutoConstraintSettings = { ...settings, enabled: false }
    const result = detectAutoConstraints(
      makeLine('new', 0, 0, 10, 0.1),
      [],
      disabled,
    )
    expect(result).toEqual([])
  })

  it('detects near-horizontal line', () => {
    const nearHoriz = makeLine('new', 0, 0, 100, 1) // ~0.57 degrees
    const result = detectAutoConstraints(nearHoriz, [], settings)
    const horiz = result.find((s) => s.glyph === 'H')
    expect(horiz).toBeDefined()
    expect(horiz!.constraint.type).toBe('horizontal')
    expect(horiz!.confidence).toBeGreaterThan(0)
  })

  it('does not detect horizontal for significantly angled line', () => {
    const angled = makeLine('new', 0, 0, 10, 10) // 45 degrees
    const result = detectAutoConstraints(angled, [], settings)
    const horiz = result.find((s) => s.glyph === 'H')
    expect(horiz).toBeUndefined()
  })

  it('detects near-vertical line', () => {
    const nearVert = makeLine('new', 0, 0, 0.5, 100) // ~0.29 degrees from vertical
    const result = detectAutoConstraints(nearVert, [], settings)
    const vert = result.find((s) => s.glyph === 'V')
    expect(vert).toBeDefined()
    expect(vert!.constraint.type).toBe('vertical')
  })

  it('detects parallel lines', () => {
    const existing = makeLine('e1', 0, 0, 10, 0)
    const newLine = makeLine('new', 0, 5, 10, 5.2) // nearly parallel
    const result = detectAutoConstraints(newLine, [existing], settings)
    const parallel = result.find((s) => s.glyph === '‖')
    expect(parallel).toBeDefined()
    expect(parallel!.constraint.type).toBe('parallel')
  })

  it('detects perpendicular lines', () => {
    const existing = makeLine('e1', 0, 0, 10, 0) // horizontal
    const newLine = makeLine('new', 5, 0, 5.1, 10) // nearly vertical (89.4 degrees)
    const result = detectAutoConstraints(newLine, [existing], settings)
    const perp = result.find((s) => s.glyph === '⊥')
    expect(perp).toBeDefined()
    expect(perp!.constraint.type).toBe('perpendicular')
  })

  it('detects equal length lines', () => {
    const existing = makeLine('e1', 0, 0, 10, 0) // length 10
    const newLine = makeLine('new', 0, 5, 10.05, 5) // length ~10.05 (within 2%)
    const result = detectAutoConstraints(newLine, [existing], settings)
    const eq = result.find((s) => s.glyph === '=')
    expect(eq).toBeDefined()
    expect(eq!.constraint.type).toBe('equal-length')
  })

  it('limits suggestions to 3', () => {
    // Create many existing shapes that could match
    const existing: Shape[] = []
    for (let i = 0; i < 10; i++) {
      existing.push(makeLine(`e${i}`, i * 20, 0, i * 20 + 10.01, 0))
    }
    const newLine = makeLine('new', 50, 5, 60.01, 5.1)
    const result = detectAutoConstraints(newLine, existing, settings)
    expect(result.length).toBeLessThanOrEqual(3)
  })

  it('sorts by confidence descending', () => {
    const existing = makeLine('e1', 0, 0, 10, 0)
    const newLine = makeLine('new', 0, 5, 10.01, 5.1) // nearly parallel + equal length
    const result = detectAutoConstraints(newLine, [existing], settings)
    if (result.length >= 2) {
      expect(result[0].confidence).toBeGreaterThanOrEqual(result[1].confidence)
    }
  })
})
