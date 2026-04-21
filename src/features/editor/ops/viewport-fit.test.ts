import { describe, expect, it } from 'vitest'
import { fitViewportToBounds } from './viewport-fit'

describe('fitViewportToBounds', () => {
  it('centers bounds and scales them inside the viewport margin', () => {
    const viewport = fitViewportToBounds({ minX: 0, minY: 0, width: 100, height: 50 }, { width: 300, height: 200 })

    expect(viewport.scale).toBeCloseTo(2.2)
    expect(viewport.x).toBeCloseTo(40)
    expect(viewport.y).toBeCloseTo(45)
  })
})
