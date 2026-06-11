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
  seamGuides: [],
  annotationLabels: [],
  dimensionLines: [],
  showAnnotations: true,
  showDimensions: true,
  showOpenPathLabels: false,
  viewportScale: 1,
  displayUnit: 'mm' as const,
  snapIndicator: null,
  markedSnapPoints: [],
  angleGuideLines: [],
  pieceEdgeLabels: [],
  constraintSuggestions: [],
  outlineChains: [],
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

  it('culls annotation and dimension overlays through render entities', () => {
    const model = buildCanvasRenderModel({
      visibleShapes: [line('shape', 'layer', 0)],
      linkedShapes: [],
      ...baseParams,
      layerStackLevels: { layer: 0 },
      viewBounds: { minX: 0, minY: 0, maxX: 60, maxY: 60 },
      detailPadding: 0,
      interactionPreview: null,
      visibleStitchHoles: [],
      visibleHardwareMarkers: [],
      foldLines: [],
      seamGuides: [
        { id: 'seam-visible', shapeId: 'shape', d: 'M 0 0 L 10 0', labelPoint: { x: 5, y: 5 }, offsetMm: 3 },
        { id: 'seam-outside', shapeId: 'shape', d: 'M 100 100 L 110 100', labelPoint: { x: 100, y: 100 }, offsetMm: 4 },
      ],
      annotationLabels: [
        { id: 'label-visible', text: 'Front', point: { x: 10, y: 10 } },
        { id: 'label-outside', text: 'Back', point: { x: 200, y: 200 } },
      ],
      dimensionLines: [
        { id: 'dim-visible', start: { x: 5, y: 20 }, end: { x: 25, y: 20 }, offsetMm: 5, layerId: 'layer', lineTypeId: 'cut' },
        { id: 'dim-outside', start: { x: 100, y: 100 }, end: { x: 120, y: 100 }, offsetMm: 5, layerId: 'layer', lineTypeId: 'cut' },
      ],
      pieceGrainlineSegments: [],
      pieceNotchLines: [],
      piecePlacementGuides: [],
    })

    expect(model.entities.seamGuides.map((entry) => [entry.id, entry.paint.labelVisible])).toEqual([
      ['seam-visible', true],
      ['seam-outside', false],
    ])
    expect(model.entities.annotationLabels.map((entry) => entry.id)).toEqual(['label-visible'])
    expect(model.entities.dimensionLines.map((entry) => entry.id)).toEqual(['dim-visible'])
    expect(model.entities.dimensionLines[0].payload.label?.text).toBe('20.0mm')
  })

  it('groups render entities in explicit draw-order buckets and carries paint metadata', () => {
    const model = buildCanvasRenderModel({
      visibleShapes: [line('shape', 'layer', 0)],
      linkedShapes: [],
      ...baseParams,
      layerStackLevels: { layer: 0 },
      viewBounds: { minX: -10, minY: -10, maxX: 100, maxY: 100 },
      detailPadding: 0,
      interactionPreview: null,
      visibleStitchHoles: [{
        id: 'hole',
        shapeId: 'shape',
        point: { x: 2, y: 2 },
        sequence: 0,
        diameterMm: 1,
        holeType: 'round',
        renderShape: 'round',
      }],
      visibleHardwareMarkers: [{
        id: 'snap',
        kind: 'snap',
        label: 'Snap',
        point: { x: 4, y: 4 },
        holeDiameterMm: 2,
      }],
      foldLines: [],
      seamGuides: [{ id: 'seam', shapeId: 'shape', d: 'M 0 0 L 10 0', labelPoint: { x: 4, y: 4 }, offsetMm: 2.5 }],
      annotationLabels: [{ id: 'piece-label', text: 'Piece', point: { x: 6, y: 6 }, fontSizeMm: 4 }],
      dimensionLines: [],
      pieceGrainlineSegments: [],
      pieceNotchLines: [],
      piecePlacementGuides: [],
    })

    expect(model.entities.all.map((entry) => entry.kind)).toEqual([
      'shape',
      'seam-guide',
      'stitch-hole',
      'hardware-marker',
      'annotation-label',
      'dimension-label',
    ])
    expect(model.groups.base.map((entry) => entry.kind)).toEqual(['shape'])
    expect(model.groups.guide.map((entry) => entry.kind)).toEqual(['seam-guide'])
    expect(model.groups.detail.map((entry) => entry.kind)).toEqual(['stitch-hole', 'hardware-marker'])
    expect(model.groups.annotation.map((entry) => entry.kind)).toEqual(['annotation-label', 'dimension-label'])
    expect(model.entities.seamGuides[0].paint.lineClassName).toBe('seam-guide-line')
    expect(model.entities.seamGuides[0].paint.labelText).toBe('2.5mm seam')
    expect(model.entities.annotationLabels[0].paint.className).toBe('annotation-label')
    expect(model.entities.dimensionLabels[0].paint.className).toBe('dimension-label')
  })

  it('moves piece edge labels, constraint glyphs, and open path labels into annotation entities', () => {
    const model = buildCanvasRenderModel({
      visibleShapes: [line('shape', 'layer', 0)],
      linkedShapes: [],
      ...baseParams,
      showOpenPathLabels: true,
      layerStackLevels: { layer: 0 },
      viewBounds: { minX: -10, minY: -10, maxX: 100, maxY: 100 },
      detailPadding: 0,
      interactionPreview: null,
      pieceEdgeLabels: [{ id: 'edge-a', x: 8, y: 8, label: 'A', active: true }],
      constraintSuggestions: [{
        constraint: { id: 'constraint', type: 'horizontal', shapeId: 'shape' },
        label: 'Horizontal',
        glyph: 'H',
        glyphPoint: { x: 12, y: 12 },
        confidence: 0.8,
      }],
      outlineChains: [{
        id: 'open-chain',
        shapeIds: ['shape'],
        polygon: [{ x: 0, y: 0 }, { x: 20, y: 0 }],
        isClosed: false,
        area: 0,
      }],
      visibleStitchHoles: [],
      visibleHardwareMarkers: [],
      foldLines: [],
      pieceGrainlineSegments: [],
      pieceNotchLines: [],
      piecePlacementGuides: [],
    })

    expect(model.entities.pieceEdgeLabels[0].payload.label).toBe('A')
    expect(model.entities.constraintGlyphs[0].payload.opacity).toBeCloseTo(0.9)
    expect(model.entities.outlineChainLabels[0].payload.text).toBe('Open Path')
    expect(model.groups.annotation.map((entry) => entry.kind)).toContain('piece-edge-label')
    expect(model.groups.annotation.map((entry) => entry.kind)).toContain('constraint-glyph')
    expect(model.groups.annotation.map((entry) => entry.kind)).toContain('outline-chain-label')
  })

  it('includes snap anchors and angle guides as overlay entities', () => {
    const model = buildCanvasRenderModel({
      visibleShapes: [line('shape', 'layer', 0)],
      linkedShapes: [],
      ...baseParams,
      layerStackLevels: { layer: 0 },
      viewBounds: { minX: -10, minY: -10, maxX: 100, maxY: 100 },
      detailPadding: 0,
      interactionPreview: null,
      snapIndicator: { point: { x: 8, y: 8 }, reason: 'endpoint' },
      markedSnapPoints: [{ point: { x: 4, y: 4 }, reason: 'midpoint', markedAt: 1 }],
      angleGuideLines: [{ id: 'angle-guide', start: { x: 0, y: 0 }, end: { x: 40, y: 40 } }],
      visibleStitchHoles: [],
      visibleHardwareMarkers: [],
      foldLines: [],
      pieceGrainlineSegments: [],
      pieceNotchLines: [],
      piecePlacementGuides: [],
    })

    expect(model.entities.angleGuides).toHaveLength(1)
    expect(model.entities.snapAnchors.map((entry) => entry.payload.active)).toEqual([false, true])
    expect(model.entities.all.map((entry) => entry.kind)).toEqual([
      'shape',
      'dimension-label',
      'angle-guide',
      'snap-anchor',
      'snap-anchor',
    ])
  })
})
