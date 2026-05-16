import { describe, expect, it } from 'vitest'
import {
  generateGoldenRatioGuides,
  generateMandalaCircleTemplate,
  generateMandalaDivisionLines,
  generateMandalaGuideCircle,
  generateWhiteSilverGuides,
  mirrorMandalaItem,
} from './mandala-ops'
import type { LineShape } from '../cad/cad-types'

describe('mandala guide generators', () => {
  it('can generate circle templates separately from division lines', () => {
    const center = { x: 0, y: 0 }
    const circle = generateMandalaCircleTemplate(center, 100, 'layer-1', 'guide')
    const divisions = generateMandalaDivisionLines(center, 100, 8, 'layer-1', 'guide')

    expect(circle).toHaveLength(4)
    expect(circle.every((shape) => shape.type === 'arc')).toBe(true)
    expect(divisions).toHaveLength(8)
    expect(divisions.every((shape) => shape.type === 'line')).toBe(true)
  })

  it('keeps the legacy combined guide output available', () => {
    const guides = generateMandalaGuideCircle({ x: 0, y: 0 }, 50, 6, 'layer-1', 'guide')
    expect(guides).toHaveLength(10)
  })

  it('places golden ratio guides at size/phi (~0.618) from each edge', () => {
    const guides = generateGoldenRatioGuides({ x: 0, y: 0 }, 100, 'layer-1', 'guide')
    expect(guides).toHaveLength(4)
    const phi = 1.618
    const expectedOffset = 100 / phi
    const leftFromEdge = guides[0].start.x - -50
    expect(leftFromEdge).toBeCloseTo(expectedOffset, 2)
  })

  it('places white-silver (√2) guides at size/√2 (~0.707) from each edge', () => {
    const guides = generateWhiteSilverGuides({ x: 0, y: 0 }, 100, 'layer-1', 'guide')
    expect(guides).toHaveLength(4)
    const expectedOffset = 100 / Math.SQRT2
    const leftFromEdge = guides[0].start.x - -50
    expect(leftFromEdge).toBeCloseTo(expectedOffset, 2)
  })

  it('white-silver and golden guides produce different positions', () => {
    const silver = generateWhiteSilverGuides({ x: 0, y: 0 }, 100, 'layer-1', 'guide')
    const golden = generateGoldenRatioGuides({ x: 0, y: 0 }, 100, 'layer-1', 'guide')
    expect(silver[0].start.x).not.toBeCloseTo(golden[0].start.x, 1)
  })
})

describe('mirrorMandalaItem', () => {
  it('mirrors a line across the X axis (axis angle 0)', () => {
    const line: LineShape = {
      id: 'l',
      type: 'line',
      layerId: 'layer-1',
      lineTypeId: 'guide',
      start: { x: 10, y: 20 },
      end: { x: 50, y: 40 },
    }
    const mirrored = mirrorMandalaItem(line, { x: 0, y: 0 }, 0)
    expect(mirrored.type).toBe('line')
    if (mirrored.type !== 'line') return
    expect(mirrored.start.x).toBeCloseTo(10, 4)
    expect(mirrored.start.y).toBeCloseTo(-20, 4)
    expect(mirrored.end.x).toBeCloseTo(50, 4)
    expect(mirrored.end.y).toBeCloseTo(-40, 4)
  })

  it('mirroring twice is identity', () => {
    const line: LineShape = {
      id: 'l',
      type: 'line',
      layerId: 'layer-1',
      lineTypeId: 'guide',
      start: { x: 12, y: 34 },
      end: { x: 56, y: 78 },
    }
    const once = mirrorMandalaItem(line, { x: 0, y: 0 }, 30)
    const twice = mirrorMandalaItem(once, { x: 0, y: 0 }, 30)
    if (twice.type !== 'line') throw new Error('unexpected shape type')
    expect(twice.start.x).toBeCloseTo(line.start.x, 3)
    expect(twice.start.y).toBeCloseTo(line.start.y, 3)
    expect(twice.end.x).toBeCloseTo(line.end.x, 3)
    expect(twice.end.y).toBeCloseTo(line.end.y, 3)
  })
})
