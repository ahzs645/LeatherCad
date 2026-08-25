import { Group, MeshStandardMaterial, Vector2 } from 'three'
import { describe, expect, it } from 'vitest'
import { ThreeFoldManager } from './fold-manager'
import { buildFoldLayerSlices, renderPhysicalPanelsForLayer } from './fold-physical-panels'
import { createSharedMaterials } from './shared-materials'

function createMaterials() {
  return {
    shared: createSharedMaterials(),
    leftMaterial: new MeshStandardMaterial(),
    rightMaterial: new MeshStandardMaterial(),
    leftTextureMaterial: new MeshStandardMaterial(),
    rightTextureMaterial: new MeshStandardMaterial(),
    assembledFrontMaterial: new MeshStandardMaterial(),
    assembledBackMaterial: new MeshStandardMaterial(),
    assembledSideMaterial: new MeshStandardMaterial(),
  }
}

describe('buildFoldLayerSlices', () => {
  it('anchors non-physical layers to the most recent physical layer', () => {
    const result = buildFoldLayerSlices(
      [
        { id: 'layer-1', name: 'Outer' } as never,
        { id: 'layer-2', name: 'Guides' } as never,
      ],
      [
        {
          id: 'shape-cut',
          type: 'line',
          lineTypeId: 'cut',
          layerId: 'layer-1',
          start: { x: 0, y: 0 },
          end: { x: 10, y: 0 },
        } as never,
        {
          id: 'shape-guide',
          type: 'line',
          lineTypeId: 'guide',
          layerId: 'layer-2',
          start: { x: 0, y: 2 },
          end: { x: 10, y: 2 },
        } as never,
      ],
      [
        { id: 'cut', role: 'cut' } as never,
        { id: 'guide', role: 'stitch' } as never,
      ],
    )

    expect(result.layerSlices).toHaveLength(2)
    expect(result.layerSlices[0].hasPhysicalGeometry).toBe(true)
    expect(result.layerSlices[1].hasPhysicalGeometry).toBe(false)
    expect(result.layerPhysicalAnchorId.get('layer-2')).toBe('layer-1')
  })
})

describe('renderPhysicalPanelsForLayer', () => {
  it('builds static and folding panel meshes from detected outline regions', () => {
    const staticSideGroup = new Group()
    const foldingSideGroup = new Group()
    const foldManager = new ThreeFoldManager()
    const lineTypeById = new Map([['cut', { id: 'cut', role: 'cut' } as never]])

    renderPhysicalPanelsForLayer({
      layerSlice: {
        layerId: 'layer-1',
        hasPhysicalGeometry: true,
        shapes: [
          {
            id: 'shape-a',
            type: 'line',
            lineTypeId: 'cut',
            layerId: 'layer-1',
            start: { x: 0, y: 0 },
            end: { x: 10, y: 0 },
          } as never,
          {
            id: 'shape-b',
            type: 'line',
            lineTypeId: 'cut',
            layerId: 'layer-1',
            start: { x: 10, y: 0 },
            end: { x: 10, y: 10 },
          } as never,
        ],
      },
      lineTypeById,
      outlinePolygons: [{
        layerId: 'layer-1',
        shapeIds: ['shape-a', 'shape-b'],
        polygon: [
          { x: 0, y: 0 },
          { x: 10, y: 0 },
          { x: 10, y: 10 },
          { x: 0, y: 10 },
          { x: 0, y: 0 },
        ],
      }],
      transform: { scale: 1, centerX: 5, centerY: 5 },
      documentBounds: { minX: 0, maxX: 10, minY: 0, maxY: 10 },
      foldStart: new Vector2(0, -5),
      foldEnd: new Vector2(0, 5),
      foldMid: new Vector2(0, 0),
      yOffset: 0,
      materials: createMaterials(),
      hasActiveTexture: false,
      texturedShapeIdSet: new Set(),
      staticSideGroup,
      foldingSideGroup,
      foldManager,
    })

    expect(staticSideGroup.children.length).toBeGreaterThan(0)
    expect(foldingSideGroup.children.length).toBeGreaterThan(0)
  })
})
