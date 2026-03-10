import { describe, expect, it } from 'vitest'
import { shouldUseOutlineRegions } from './physical-layer-heuristics'

describe('shouldUseOutlineRegions', () => {
  it('rejects tiny closed regions when larger cut geometry remains open', () => {
    expect(shouldUseOutlineRegions({
      cutShapes: [
        { id: 'open-cut', type: 'line', lineTypeId: 'cut' } as never,
        { id: 'hole-a', type: 'line', lineTypeId: 'cut' } as never,
        { id: 'hole-b', type: 'line', lineTypeId: 'cut' } as never,
      ],
      layerOutlines: [
        {
          layerId: 'layer-1',
          shapeIds: ['hole-a', 'hole-b'],
          polygon: [
            { x: 0, y: 0 },
            { x: 3, y: 0 },
            { x: 3, y: 3 },
            { x: 0, y: 3 },
            { x: 0, y: 0 },
          ],
        },
      ],
      outlineRegions: [
        {
          outer: {
            layerId: 'layer-1',
            shapeIds: ['hole-a', 'hole-b'],
            polygon: [
              { x: 0, y: 0 },
              { x: 3, y: 0 },
              { x: 3, y: 3 },
              { x: 0, y: 3 },
              { x: 0, y: 0 },
            ],
          },
          holes: [],
        },
      ],
      fallbackBoundsArea: 500,
    })).toBe(false)
  })

  it('keeps using outline regions when the closed contour is substantial', () => {
    expect(shouldUseOutlineRegions({
      cutShapes: [
        { id: 'open-cut', type: 'line', lineTypeId: 'cut' } as never,
        { id: 'outer-a', type: 'line', lineTypeId: 'cut' } as never,
        { id: 'outer-b', type: 'line', lineTypeId: 'cut' } as never,
      ],
      layerOutlines: [
        {
          layerId: 'layer-1',
          shapeIds: ['outer-a', 'outer-b'],
          polygon: [
            { x: 0, y: 0 },
            { x: 18, y: 0 },
            { x: 18, y: 12 },
            { x: 0, y: 12 },
            { x: 0, y: 0 },
          ],
        },
      ],
      outlineRegions: [
        {
          outer: {
            layerId: 'layer-1',
            shapeIds: ['outer-a', 'outer-b'],
            polygon: [
              { x: 0, y: 0 },
              { x: 18, y: 0 },
              { x: 18, y: 12 },
              { x: 0, y: 12 },
              { x: 0, y: 0 },
            ],
          },
          holes: [],
        },
      ],
      fallbackBoundsArea: 500,
    })).toBe(true)
  })
})
