import { describe, expect, it } from 'vitest'
import { pinchViewport } from './useCanvasTouchGestures'

describe('pinch viewport', () => {
  const start = { distance: 100, mid: { x: 200, y: 150 }, viewport: { x: 50, y: 30, scale: 2 } }

  it('keeps the world point under the fingers while zooming', () => {
    const next = pinchViewport(start, 200, { x: 200, y: 150 })
    expect(next.scale).toBe(4)
    const worldBefore = { x: (200 - 50) / 2, y: (150 - 30) / 2 }
    expect((200 - next.x) / next.scale).toBeCloseTo(worldBefore.x)
    expect((150 - next.y) / next.scale).toBeCloseTo(worldBefore.y)
  })

  it('pans with the midpoint when the finger distance is unchanged', () => {
    const next = pinchViewport(start, 100, { x: 260, y: 120 })
    expect(next.scale).toBe(2)
    expect(next.x).toBeCloseTo(110)
    expect(next.y).toBeCloseTo(0)
  })

  it('clamps extreme zoom', () => {
    expect(pinchViewport(start, 1e6, start.mid).scale).toBe(400)
    expect(pinchViewport(start, 0.0001, start.mid).scale).toBe(0.02)
  })
})
