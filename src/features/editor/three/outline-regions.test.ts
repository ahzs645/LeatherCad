import { describe, expect, it } from 'vitest'
import { buildOutlineRegions } from './outline-regions'

describe('buildOutlineRegions', () => {
  it('treats contained outlines as holes for the enclosing outer polygon', () => {
    const regions = buildOutlineRegions([
      {
        layerId: 'layer-1',
        shapeIds: ['outer'],
        polygon: [
          { x: 0, y: 0 },
          { x: 20, y: 0 },
          { x: 20, y: 20 },
          { x: 0, y: 20 },
          { x: 0, y: 0 },
        ],
      },
      {
        layerId: 'layer-1',
        shapeIds: ['hole'],
        polygon: [
          { x: 6, y: 6 },
          { x: 12, y: 6 },
          { x: 12, y: 12 },
          { x: 6, y: 12 },
          { x: 6, y: 6 },
        ],
      },
      {
        layerId: 'layer-1',
        shapeIds: ['separate'],
        polygon: [
          { x: 30, y: 0 },
          { x: 36, y: 0 },
          { x: 36, y: 6 },
          { x: 30, y: 6 },
          { x: 30, y: 0 },
        ],
      },
    ])

    expect(regions).toHaveLength(2)
    expect(regions[0].outer.shapeIds).toEqual(['outer'])
    expect(regions[0].holes.map((hole) => hole.shapeIds)).toEqual([['hole']])
    expect(regions[1].outer.shapeIds).toEqual(['separate'])
    expect(regions[1].holes).toHaveLength(0)
  })

  it('applies even-odd containment so islands inside holes become separate outers', () => {
    const regions = buildOutlineRegions([
      {
        layerId: 'layer-1',
        shapeIds: ['outer'],
        polygon: [
          { x: 0, y: 0 },
          { x: 20, y: 0 },
          { x: 20, y: 20 },
          { x: 0, y: 20 },
          { x: 0, y: 0 },
        ],
      },
      {
        layerId: 'layer-1',
        shapeIds: ['hole'],
        polygon: [
          { x: 4, y: 4 },
          { x: 16, y: 4 },
          { x: 16, y: 16 },
          { x: 4, y: 16 },
          { x: 4, y: 4 },
        ],
      },
      {
        layerId: 'layer-1',
        shapeIds: ['island'],
        polygon: [
          { x: 7, y: 7 },
          { x: 13, y: 7 },
          { x: 13, y: 13 },
          { x: 7, y: 13 },
          { x: 7, y: 7 },
        ],
      },
    ])

    expect(regions).toHaveLength(2)
    expect(regions[0].outer.shapeIds).toEqual(['outer'])
    expect(regions[0].holes.map((hole) => hole.shapeIds)).toEqual([['hole']])
    expect(regions[1].outer.shapeIds).toEqual(['island'])
    expect(regions[1].holes).toHaveLength(0)
  })
})
