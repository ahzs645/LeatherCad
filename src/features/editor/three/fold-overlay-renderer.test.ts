import { Group, Line, Points, Vector2 } from 'three'
import { describe, expect, it } from 'vitest'
import { renderFoldGuides, renderLayerOverlays } from './fold-overlay-renderer'

describe('renderLayerOverlays', () => {
  it('splits line and stitch overlays across the fold axis', () => {
    const staticSideGroup = new Group()
    const foldingSideGroup = new Group()

    renderLayerOverlays({
      layerSlice: {
        layerId: 'layer-1',
        shapes: [
          {
            id: 'shape-1',
            type: 'line',
            lineTypeId: 'cut',
            layerId: 'layer-1',
            start: { x: 0, y: 5 },
            end: { x: 10, y: 5 },
          } as never,
        ],
      },
      lineTypes: [{ id: 'cut', role: 'cut' } as never],
      layers: [{ id: 'layer-1', name: 'Main' } as never],
      stitchHoles: [
        {
          id: 'hole-1',
          shapeId: 'shape-1',
          point: { x: 2, y: 5 },
          sequence: 1,
        } as never,
        {
          id: 'hole-2',
          shapeId: 'shape-1',
          point: { x: 8, y: 5 },
          sequence: 2,
        } as never,
      ],
      transform: { scale: 1, centerX: 5, centerY: 5 },
      foldStart: new Vector2(0, -5),
      foldEnd: new Vector2(0, 5),
      foldMid: new Vector2(0, 0),
      threadColor: '#ff8800',
      yOffset: 0,
      staticSideGroup,
      foldingSideGroup,
    })

    expect(staticSideGroup.children.some((child) => child instanceof Line || child instanceof Points)).toBe(true)
    expect(foldingSideGroup.children.some((child) => child instanceof Line || child instanceof Points)).toBe(true)
  })
})

describe('renderFoldGuides', () => {
  it('adds one dashed guide per fold line', () => {
    const foldGuideGroup = new Group()

    renderFoldGuides({
      foldLines: [
        {
          id: 'fold-1',
          start: { x: 0, y: 0 },
          end: { x: 0, y: 10 },
        } as never,
        {
          id: 'fold-2',
          start: { x: 5, y: 0 },
          end: { x: 5, y: 10 },
        } as never,
      ],
      transform: { scale: 1, centerX: 0, centerY: 0 },
      guideYOffset: 0.25,
      foldGuideGroup,
    })

    expect(foldGuideGroup.children).toHaveLength(2)
    expect(foldGuideGroup.children.every((child) => child instanceof Line)).toBe(true)
  })
})
