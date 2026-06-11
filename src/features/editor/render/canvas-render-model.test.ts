import { describe, expect, it } from 'vitest'
import type { Shape } from '../cad/cad-types'
import { buildCanvasRenderModel } from './canvas-render-model'

const line = (id: string, layerId: string, x: number): Shape => ({
  id,
  type: 'line',
  layerId,
  lineTypeId: 'cut',
  start: { x, y: 0 },
  end: { x: x + 10, y: 0 },
})

const baseParams = {
  lineTypesById: {
    cut: { id: 'cut', name: 'Cut', role: 'cut' as const, visible: true, locked: false, style: 'solid' as const },
  },
  selectedShapeIdSet: new Set<string>(),
  sketchWorkspaceMode: 'pattern' as const,
  shapeStrokeOpacity: 1,
  highlightActiveLayerId: null,
  displayLayerColorsById: {},
  fallbackLayerStroke: '#111827',
  stitchStrokeColor: '#0f766e',
  foldStrokeColor: '#7c3aed',
  cutStrokeColor: '#111827',
}

describe('buildCanvasRenderModel', () => {
  it('returns culled and stack-sorted shape entities for the 2D renderer', () => {
    const model = buildCanvasRenderModel({
      visibleShapes: [
        line('front', 'front-layer', 20),
        line('back', 'back-layer', 10),
        line('outside', 'front-layer', 500),
      ],
      linkedShapes: [
        line('linked-front', 'front-layer', 40),
        line('linked-back', 'back-layer', 30),
      ],
      ...baseParams,
      layerStackLevels: {
        'front-layer': 2,
        'back-layer': 0,
      },
      viewBounds: { minX: 0, minY: -50, maxX: 100, maxY: 50 },
      detailPadding: 0,
      interactionPreview: null,
      visibleStitchHoles: [],
      visibleHardwareMarkers: [],
      foldLines: [],
      pieceGrainlineSegments: [],
      pieceNotchLines: [],
      piecePlacementGuides: [],
    })

    expect(model.layers.editableShapes.map((entry) => entry.id)).toEqual(['back', 'front'])
    expect(model.layers.linkedShapes.map((entry) => entry.id)).toEqual(['linked-back', 'linked-front'])
    expect(model.shapeLayers.editable).toBe(model.layers.editableShapes)
    expect(model.shapeLayers.linked).toBe(model.layers.linkedShapes)
    expect(model.shapeLayers.all.map((entry) => `${entry.role}:${entry.id}`)).toEqual([
      'linked:linked-back',
      'linked:linked-front',
      'editable:back',
      'editable:front',
    ])
  })

  it('applies move previews as preview render entities', () => {
    const model = buildCanvasRenderModel({
      visibleShapes: [line('moving', 'layer', 0)],
      linkedShapes: [],
      ...baseParams,
      layerStackLevels: { layer: 0 },
      viewBounds: { minX: 0, minY: 0, maxX: 100, maxY: 100 },
      detailPadding: 20,
      interactionPreview: {
        kind: 'move',
        shapeIds: ['moving'],
        deltaX: 5,
        deltaY: 7,
      },
      visibleStitchHoles: [],
      visibleHardwareMarkers: [],
      foldLines: [],
      pieceGrainlineSegments: [],
      pieceNotchLines: [],
      piecePlacementGuides: [],
    })

    expect(model.layers.previewShapes).toHaveLength(1)
    expect(model.layers.previewShapes[0].shape.start).toEqual({ x: 5, y: 7 })
    expect(model.layers.previewShapes[0].paint.className).toContain('shape-live-preview')
    expect(model.shapeLayers.preview).toBe(model.layers.previewShapes)
    expect(model.shapeLayers.all.map((entry) => entry.role)).toEqual(['editable', 'preview'])
  })

  it('includes non-shape entities in the combined render stream', () => {
    const model = buildCanvasRenderModel({
      visibleShapes: [line('shape', 'layer', 0)],
      linkedShapes: [],
      ...baseParams,
      layerStackLevels: { layer: 0 },
      viewBounds: { minX: -10, minY: -10, maxX: 100, maxY: 100 },
      detailPadding: 0,
      interactionPreview: {
        kind: 'selection-box',
        start: { x: 0, y: 0 },
        end: { x: 20, y: 20 },
        mode: 'contained',
      },
      visibleStitchHoles: [{
        id: 'hole',
        shapeId: 'shape',
        point: { x: 5, y: 5 },
        sequence: 0,
        diameterMm: 1,
        holeType: 'round',
        renderShape: 'round',
      }],
      visibleHardwareMarkers: [{
        id: 'snap',
        kind: 'snap',
        label: 'Snap',
        point: { x: 8, y: 8 },
        holeDiameterMm: 2,
      }],
      foldLines: [{ id: 'fold', start: { x: 0, y: 1 }, end: { x: 30, y: 1 } }],
      pieceGrainlineSegments: [{ pieceId: 'piece', start: { x: 0, y: 2 }, end: { x: 30, y: 2 } }],
      pieceNotchLines: [{ id: 'notch', pieceId: 'piece', start: { x: 0, y: 3 }, end: { x: 5, y: 3 }, showOnSeam: false }],
      piecePlacementGuides: [],
    })

    expect(model.entities.all.map((entry) => entry.kind)).toContain('shape')
    expect(model.entities.all.map((entry) => entry.kind)).toContain('stitch-hole')
    expect(model.entities.all.map((entry) => entry.kind)).toContain('hardware-marker')
    expect(model.entities.all.map((entry) => entry.kind)).toContain('fold-line')
    expect(model.entities.all.map((entry) => entry.kind)).toContain('selection-box')
    expect(model.entities.selectionBoxes[0].payload.mode).toBe('contained')
  })

  it('turns transient command previews into preview entities', () => {
    const preview = line('trimmed', 'layer', 3)
    const model = buildCanvasRenderModel({
      visibleShapes: [line('trimmed', 'layer', 0)],
      linkedShapes: [],
      ...baseParams,
      layerStackLevels: { layer: 0 },
      viewBounds: { minX: -10, minY: -10, maxX: 100, maxY: 10 },
      detailPadding: 0,
      interactionPreview: null,
      transientPreviewShapes: [preview],
      visibleStitchHoles: [],
      visibleHardwareMarkers: [],
      foldLines: [],
      pieceGrainlineSegments: [],
      pieceNotchLines: [],
      piecePlacementGuides: [],
    })

    expect(model.layers.previewShapes).toHaveLength(1)
    expect(model.layers.editableShapes[0].paint.previewSource).toBe(true)
    expect(model.layers.previewShapes[0].shape.start.x).toBe(3)
  })

  it('resolves paint metadata for editable entities', () => {
    const selectedShapeIdSet = new Set(['selected'])
    const model = buildCanvasRenderModel({
      visibleShapes: [line('selected', 'layer', 0), line('dimmed', 'other-layer', 20)],
      linkedShapes: [],
      ...baseParams,
      selectedShapeIdSet,
      highlightActiveLayerId: 'layer',
      layerStackLevels: { layer: 0, 'other-layer': 1 },
      viewBounds: { minX: -10, minY: -10, maxX: 100, maxY: 10 },
      detailPadding: 0,
      interactionPreview: null,
      visibleStitchHoles: [],
      visibleHardwareMarkers: [],
      foldLines: [],
      pieceGrainlineSegments: [],
      pieceNotchLines: [],
      piecePlacementGuides: [],
    })

    expect(model.layers.editableShapes[0].paint.selected).toBe(true)
    expect(model.layers.editableShapes[0].paint.className).toContain('shape-selected')
    expect(model.layers.editableShapes[1].paint.opacity).toBeLessThan(1)
  })
})
