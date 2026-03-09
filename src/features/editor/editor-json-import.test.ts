import { describe, expect, it } from 'vitest'
import { parseImportedJsonDocument } from './editor-json-import'
import { createDefaultLineTypes } from './cad/line-types'

describe('parseImportedJsonDocument', () => {
  it('preserves seam connections, piece placements, avatars, and preview settings', () => {
    const lineTypes = createDefaultLineTypes()
    const cutLineTypeId = lineTypes.find((entry) => entry.role === 'cut')?.id ?? lineTypes[0].id
    const raw = JSON.stringify({
      version: 1,
      units: 'mm',
      layers: [{ id: 'layer-1', name: 'Main', visible: true, locked: false }],
      activeLayerId: 'layer-1',
      lineTypes,
      activeLineTypeId: cutLineTypeId,
      objects: [
        { id: 'a', type: 'line', layerId: 'layer-1', lineTypeId: cutLineTypeId, start: { x: 0, y: 0 }, end: { x: 40, y: 0 } },
        { id: 'b', type: 'line', layerId: 'layer-1', lineTypeId: cutLineTypeId, start: { x: 40, y: 0 }, end: { x: 40, y: 30 } },
        { id: 'c', type: 'line', layerId: 'layer-1', lineTypeId: cutLineTypeId, start: { x: 40, y: 30 }, end: { x: 0, y: 30 } },
        { id: 'd', type: 'line', layerId: 'layer-1', lineTypeId: cutLineTypeId, start: { x: 0, y: 30 }, end: { x: 0, y: 0 } },
      ],
      foldLines: [],
      stitchHoles: [],
      constraints: [],
      patternPieces: [
        {
          id: 'piece-1',
          name: 'Body',
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
          translationMm: { x: 10, y: 20, z: 30 },
          rotationDeg: { x: 0, y: 15, z: 90 },
          flipped: true,
        },
      ],
      seamConnections: [
        {
          id: 'seam-1',
          from: { pieceId: 'piece-1', edgeIndex: 0 },
          to: { pieceId: 'piece-1', edgeIndex: 2 },
          kind: 'aligned',
          reversed: true,
          stitchSpacingMm: 4,
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
      stitchThreadColor: '#f97316',
      threePreviewSettings: {
        mode: 'avatar',
        explodedFactor: 1.2,
        thicknessMm: 2.1,
        showSeams: true,
        showEdgeLabels: true,
        showStressOverlay: false,
        avatarId: 'avatar-1',
      },
      avatars: [
        {
          id: 'avatar-1',
          name: 'Dress form',
          sourceUrl: 'https://example.com/avatar.glb',
          scaleMm: 1680,
        },
      ],
      threeTextureSource: null,
      threeTextureShapeIds: [],
      showCanvasRuler: true,
      showDimensions: false,
      dimensionLines: [],
      printAreas: [],
    })

    const imported = parseImportedJsonDocument(raw)

    expect(imported.doc.piecePlacements3d?.[0].rotationDeg.z).toBe(90)
    expect(imported.doc.piecePlacements3d?.[0].flipped).toBe(true)
    expect(imported.doc.seamConnections?.[0].kind).toBe('aligned')
    expect(imported.doc.seamConnections?.[0].reversed).toBe(true)
    expect(imported.doc.threePreviewSettings?.mode).toBe('avatar')
    expect(imported.doc.threePreviewSettings?.avatarId).toBe('avatar-1')
    expect(imported.doc.avatars?.[0].sourceUrl).toBe('https://example.com/avatar.glb')
  })
})
