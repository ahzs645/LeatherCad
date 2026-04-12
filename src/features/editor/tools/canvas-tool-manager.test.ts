import { describe, expect, it } from 'vitest'
import type { Layer, LineType, Shape, StitchHole } from '../cad/cad-types'
import { executeToolCommand, executeToolPointerDown, getToolHint } from './tool-executor'
import { DefaultEditorToolSession } from './tool-session'
import type { ToolRuntime } from './tool-types'

function createLineType(id: string, role: LineType['role']): LineType {
  return {
    id,
    name: id,
    role,
    style: 'solid',
    color: '#000000',
    visible: true,
  }
}

describe('tool executor', () => {
  it('places stitch holes on nearby cut geometry when no stitch line exists', () => {
    const cutShape: Shape = {
      id: 'shape-cut',
      type: 'line',
      layerId: 'layer-1',
      lineTypeId: 'cut',
      start: { x: 0, y: 0 },
      end: { x: 100, y: 0 },
    }
    const lineTypesById: Record<string, LineType> = {
      cut: createLineType('cut', 'cut'),
      stitch: createLineType('stitch', 'stitch'),
    }
    const layers: Layer[] = [{ id: 'layer-1', name: 'Layer 1', visible: true, locked: false }]
    let stitchHoles: StitchHole[] = []
    let selectedStitchHoleId: string | null = null
    let status = ''
    const toolSession = new DefaultEditorToolSession()

    const runtime: ToolRuntime = {
      draftPoints: [],
      activeLayerId: 'layer-1',
      activeLineTypeId: 'cut',
      activeSketchGroup: null,
      viewportScale: 1,
      stitchHoleDefaults: {
        holeType: 'round',
        renderShape: 'round',
        diameterMm: 1.2,
        widthMm: 1.2,
        heightMm: 1.2,
        tiltDeg: 0,
        inverted: false,
      },
      hardwarePreset: 'custom',
      customHardwareDiameterMm: 4,
      customHardwareSpacingMm: 0,
      textDraftValue: '',
      textFontFamily: 'sans-serif',
      textFontSizeMm: 12,
      textTransformMode: 'none',
      textRadiusMm: 40,
      textSweepDeg: 140,
      stitchTargetShapes: [cutShape],
      patternPieces: [],
      lineTypesById,
      shapesById: { [cutShape.id]: cutShape },
      layers,
      stitchHoles,
      pieceNotches: [],
      seamConnections: [],
      setDraftPoints: () => undefined,
      clearDraft: () => undefined,
      setStatus: (nextStatus: string) => {
        status = nextStatus
      },
      setShapes: () => undefined,
      setFoldLines: () => undefined,
      setStitchHoles: (updater) => {
        stitchHoles = typeof updater === 'function' ? updater(stitchHoles) : updater
      },
      setSelectedStitchHoleId: (value) => {
        selectedStitchHoleId = value
      },
      setPieceNotches: () => undefined,
      setSeamConnections: () => undefined,
      setHardwareMarkers: () => undefined,
      setSelectedHardwareMarkerId: () => undefined,
      ensureActiveLayerWritable: () => true,
      ensureActiveLineTypeWritable: () => true,
      toolSession,
    }

    executeToolPointerDown('stitch-hole', { x: 40, y: 2 }, runtime)

    expect(stitchHoles).toHaveLength(1)
    expect(stitchHoles[0].shapeId).toBe(cutShape.id)
    expect(stitchHoles[0].point.x).toBe(40)
    expect(stitchHoles[0].point.y).toBe(0)
    expect(selectedStitchHoleId).toBe(stitchHoles[0].id)
    expect(status).toBe('Stitch hole placed on cut path (round)')
  })

  it('tracks seam selection in session state', () => {
    const toolSession = new DefaultEditorToolSession()
    const shapeA: Shape = {
      id: 'shape-a',
      type: 'line',
      layerId: 'layer-1',
      lineTypeId: 'cut',
      start: { x: 0, y: 0 },
      end: { x: 100, y: 0 },
    }
    const shapeB: Shape = {
      id: 'shape-b',
      type: 'line',
      layerId: 'layer-1',
      lineTypeId: 'cut',
      start: { x: 100, y: 0 },
      end: { x: 100, y: 80 },
    }
    const shapeC: Shape = {
      id: 'shape-c',
      type: 'line',
      layerId: 'layer-1',
      lineTypeId: 'cut',
      start: { x: 100, y: 80 },
      end: { x: 0, y: 80 },
    }
    const shapeD: Shape = {
      id: 'shape-d',
      type: 'line',
      layerId: 'layer-1',
      lineTypeId: 'cut',
      start: { x: 0, y: 80 },
      end: { x: 0, y: 0 },
    }
    const patternPieces = [
      {
        id: 'piece-a',
        name: 'Piece A',
        boundaryShapeId: shapeA.id,
        internalShapeIds: [],
        layerId: 'layer-1',
        seamAllowanceMm: 0,
        quantity: 1,
        materialSide: 'either' as const,
        orientation: 'any' as const,
        allowFlip: true,
        includeInLayout: true,
        locked: false,
      },
    ]
    let seamConnections = [] as ToolRuntime['seamConnections']
    let status = ''

    const runtime: ToolRuntime = {
      draftPoints: [],
      activeLayerId: 'layer-1',
      activeLineTypeId: 'cut',
      activeSketchGroup: null,
      viewportScale: 1,
      stitchHoleDefaults: { holeType: 'round' },
      hardwarePreset: 'custom',
      customHardwareDiameterMm: 4,
      customHardwareSpacingMm: 0,
      textDraftValue: '',
      textFontFamily: 'sans-serif',
      textFontSizeMm: 12,
      textTransformMode: 'none',
      textRadiusMm: 40,
      textSweepDeg: 140,
      stitchTargetShapes: [shapeA, shapeB, shapeC, shapeD],
      patternPieces,
      lineTypesById: { cut: createLineType('cut', 'cut') },
      shapesById: {
        [shapeA.id]: shapeA,
        [shapeB.id]: shapeB,
        [shapeC.id]: shapeC,
        [shapeD.id]: shapeD,
      },
      layers: [{ id: 'layer-1', name: 'Layer 1', visible: true, locked: false }],
      stitchHoles: [],
      pieceNotches: [],
      seamConnections,
      setDraftPoints: () => undefined,
      clearDraft: () => undefined,
      setStatus: (nextStatus) => {
        status = nextStatus
      },
      setShapes: () => undefined,
      setFoldLines: () => undefined,
      setStitchHoles: () => undefined,
      setSelectedStitchHoleId: () => undefined,
      setPieceNotches: () => undefined,
      setSeamConnections: (updater) => {
        seamConnections = typeof updater === 'function' ? updater(seamConnections) : updater
        runtime.seamConnections = seamConnections
      },
      setHardwareMarkers: () => undefined,
      setSelectedHardwareMarkerId: () => undefined,
      ensureActiveLayerWritable: () => true,
      ensureActiveLineTypeWritable: () => true,
      toolSession,
    }

    executeToolPointerDown('seam', { x: 5, y: 0 }, runtime)

    expect(toolSession.getPendingSeamSelection()).toEqual({
      pieceId: 'piece-a',
      pieceName: 'Piece A',
      edgeIndex: 0,
    })
    expect(status).toContain('Seam start set')
  })

  it('parses typed circle radius commands through the tool executor', () => {
    const toolSession = new DefaultEditorToolSession()
    const shapes: Shape[] = []
    const runtime: ToolRuntime = {
      draftPoints: [{ x: 10, y: 10 }],
      activeLayerId: 'layer-1',
      activeLineTypeId: 'cut',
      activeSketchGroup: null,
      viewportScale: 1,
      stitchHoleDefaults: { holeType: 'round' },
      hardwarePreset: 'custom',
      customHardwareDiameterMm: 4,
      customHardwareSpacingMm: 0,
      textDraftValue: '',
      textFontFamily: 'sans-serif',
      textFontSizeMm: 12,
      textTransformMode: 'none',
      textRadiusMm: 40,
      textSweepDeg: 140,
      stitchTargetShapes: [],
      patternPieces: [],
      lineTypesById: { cut: createLineType('cut', 'cut') },
      shapesById: {},
      layers: [{ id: 'layer-1', name: 'Layer 1', visible: true, locked: false }],
      stitchHoles: [],
      pieceNotches: [],
      seamConnections: [],
      setDraftPoints: () => undefined,
      clearDraft: () => undefined,
      setStatus: () => undefined,
      setShapes: (updater) => {
        const nextShapes = typeof updater === 'function' ? updater(shapes) : updater
        shapes.splice(0, shapes.length, ...nextShapes)
      },
      setFoldLines: () => undefined,
      setStitchHoles: () => undefined,
      setSelectedStitchHoleId: () => undefined,
      setPieceNotches: () => undefined,
      setSeamConnections: () => undefined,
      setHardwareMarkers: () => undefined,
      setSelectedHardwareMarkerId: () => undefined,
      ensureActiveLayerWritable: () => true,
      ensureActiveLineTypeWritable: () => true,
      toolSession,
    }

    const result = executeToolCommand('circle', '15', runtime)

    expect(result).toBe('Circle radius applied')
    expect(shapes.length).toBeGreaterThan(20)
    expect(getToolHint('circle', [{ x: 10, y: 10 }])).toBe('Circle: pick radius point (or type radius)')
  })
})
