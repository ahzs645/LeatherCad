import { describe, expect, it } from 'vitest'
import type { DocFile } from '../cad/cad-types'
import { exportGarmentInterchangeDocument } from './io-garment'
import { createDefaultLineTypes } from '../cad/line-types'
import { DEFAULT_THREE_PREVIEW_SETTINGS } from '../editor-constants'

describe('exportGarmentInterchangeDocument', () => {
  it('exports ordered piece geometry, seams, and 3D placements', () => {
    const lineTypes = createDefaultLineTypes()
    const cutLineTypeId = lineTypes.find((lineType) => lineType.role === 'cut')?.id ?? lineTypes[0].id
    const doc: DocFile = {
      version: 1,
      units: 'mm',
      layers: [{ id: 'layer-1', name: 'Main', visible: true, locked: false }],
      activeLayerId: 'layer-1',
      sketchGroups: [],
      activeSketchGroupId: null,
      lineTypes,
      activeLineTypeId: cutLineTypeId,
      objects: [
        { id: 'a', type: 'line', layerId: 'layer-1', lineTypeId: cutLineTypeId, start: { x: 0, y: 0 }, end: { x: 30, y: 0 } },
        { id: 'b', type: 'line', layerId: 'layer-1', lineTypeId: cutLineTypeId, start: { x: 30, y: 0 }, end: { x: 30, y: 20 } },
        { id: 'c', type: 'line', layerId: 'layer-1', lineTypeId: cutLineTypeId, start: { x: 30, y: 20 }, end: { x: 0, y: 20 } },
        { id: 'd', type: 'line', layerId: 'layer-1', lineTypeId: cutLineTypeId, start: { x: 0, y: 20 }, end: { x: 0, y: 0 } },
      ],
      foldLines: [],
      stitchHoles: [],
      constraints: [],
      patternPieces: [
        {
          id: 'piece-1',
          name: 'Front',
          boundaryShapeId: 'a',
          internalShapeIds: [],
          layerId: 'layer-1',
          quantity: 1,
          onFold: false,
          orientation: 'any',
          allowFlip: true,
          includeInLayout: true,
          locked: false,
        },
      ],
      pieceGrainlines: [],
      pieceLabels: [],
      piecePlacementLabels: [],
      piecePlacements3d: [
        {
          pieceId: 'piece-1',
          translationMm: { x: 12, y: 4, z: -8 },
          rotationDeg: { x: 0, y: 15, z: 90 },
          flipped: true,
        },
      ],
      seamConnections: [
        {
          id: 'seam-1',
          from: { pieceId: 'piece-1', edgeIndex: 1 },
          to: { pieceId: 'piece-1', edgeIndex: 3 },
          kind: 'hinge',
        },
      ],
      seamAllowances: [],
      pieceNotches: [],
      hardwareMarkers: [],
      snapSettings: { enabled: true, grid: true, gridStep: 10, endpoints: true, midpoints: true, guides: true, hardware: true },
      showAnnotations: true,
      tracingOverlays: [],
      projectMemo: '',
      stitchAlwaysShapeIds: [],
      stitchThreadColor: '#fb923c',
      threePreviewSettings: DEFAULT_THREE_PREVIEW_SETTINGS,
      avatars: [],
      threeTextureSource: null,
      threeTextureShapeIds: [],
      showCanvasRuler: true,
      showDimensions: false,
      dimensionLines: [],
      printAreas: [],
    }

    const exported = exportGarmentInterchangeDocument(doc)

    expect(exported.metadata.source).toBe('LeatherCad')
    expect(exported.pieces).toHaveLength(1)
    expect(exported.pieces[0].vertices).toHaveLength(4)
    expect(exported.pieces[0].edges).toHaveLength(4)
    expect(exported.pieces[0].placement3d.translationMm.x).toBe(12)
    expect(exported.pieces[0].placement3d.flipped).toBe(true)
    expect(exported.seams[0].kind).toBe('hinge')
  })
})
