import { describe, expect, it } from 'vitest'
import type { LineType, Shape } from '../cad/cad-types'
import { findNearestStitchAnchor } from './stitch-hole-ops'

const lineTypesById: Record<string, LineType> = {
  cut: {
    id: 'cut',
    name: 'Cut',
    role: 'cut',
    style: 'solid',
    color: '#000000',
    visible: true,
  },
  stitch: {
    id: 'stitch',
    name: 'Stitch',
    role: 'stitch',
    style: 'solid',
    color: '#00ff00',
    visible: true,
  },
}

function lineShape(id: string, lineTypeId: string, y: number): Shape {
  return {
    id,
    type: 'line',
    layerId: 'layer-1',
    lineTypeId,
    start: { x: 0, y },
    end: { x: 100, y },
  }
}

describe('findNearestStitchAnchor', () => {
  it('falls back to non-stitch geometry when enabled', () => {
    const anchor = findNearestStitchAnchor(
      { x: 40, y: 2 },
      [lineShape('cut-line', 'cut', 0)],
      lineTypesById,
      10,
      { allowNonStitchShapes: true },
    )

    expect(anchor?.shapeId).toBe('cut-line')
    expect(anchor?.point.x).toBe(40)
    expect(anchor?.point.y).toBe(0)
  })

  it('still prefers stitch geometry over other nearby shapes', () => {
    const anchor = findNearestStitchAnchor(
      { x: 40, y: 1.5 },
      [lineShape('cut-line', 'cut', 0), lineShape('stitch-line', 'stitch', 2)],
      lineTypesById,
      10,
      { allowNonStitchShapes: true },
    )

    expect(anchor?.shapeId).toBe('stitch-line')
    expect(anchor?.point.x).toBe(40)
    expect(anchor?.point.y).toBe(2)
  })
})
