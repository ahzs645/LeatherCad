import { describe, expect, it } from 'vitest'
import {
  generateMandalaCircleTemplate,
  generateMandalaDivisionLines,
  generateMandalaGuideCircle,
} from './mandala-ops'

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
})
