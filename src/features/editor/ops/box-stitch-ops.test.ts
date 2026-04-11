import { describe, expect, it } from 'vitest'
import type { Shape } from '../cad/cad-types'
import { extractBoxStitchGuideLines } from './box-stitch-ops'

function line(
  id: string,
  start: { x: number; y: number },
  end: { x: number; y: number },
): Shape {
  return {
    id,
    type: 'line',
    layerId: 'layer-1',
    lineTypeId: 'cut',
    start,
    end,
  }
}

describe('extractBoxStitchGuideLines', () => {
  it('pairs opposite candidate edges and projects guides inside the selection bounds', () => {
    const boundaryShapes = [
      line('top', { x: 10, y: 0 }, { x: 90, y: 0 }),
      line('bottom', { x: 20, y: 40 }, { x: 80, y: 40 }),
      line('left', { x: 0, y: 5 }, { x: 0, y: 35 }),
      line('right', { x: 100, y: 8 }, { x: 100, y: 30 }),
    ]

    const result = extractBoxStitchGuideLines(boundaryShapes, 6, 'layer-1', 'stitch')

    expect(result.extractedEdgeCount).toBe(4)
    expect(result.usedFallback).toBe(false)
    expect(result.guideLines).toHaveLength(4)
    expect(result.guideLines[0]?.start).toEqual({ x: 20, y: 6 })
    expect(result.guideLines[0]?.end).toEqual({ x: 80, y: 6 })
    expect(result.guideLines[1]?.start).toEqual({ x: 94, y: 8 })
    expect(result.guideLines[1]?.end).toEqual({ x: 94, y: 30 })
  })

  it('falls back to bounds-based guides when opposite candidates are missing', () => {
    const boundaryShapes = [
      line('top', { x: 0, y: 0 }, { x: 100, y: 0 }),
      line('bottom', { x: 0, y: 40 }, { x: 100, y: 40 }),
    ]

    const result = extractBoxStitchGuideLines(boundaryShapes, 5, 'layer-1', 'stitch')

    expect(result.extractedEdgeCount).toBe(2)
    expect(result.usedFallback).toBe(true)
    expect(result.guideLines).toHaveLength(4)
    expect(result.guideLines[2]?.start).toEqual({ x: 5, y: 35 })
    expect(result.guideLines[3]?.end).toEqual({ x: 5, y: 5 })
  })
})
