import { describe, expect, it } from 'vitest'
import type { Layer, LineType, Point, Shape, StitchHole } from '../cad/cad-types'
import { CanvasToolManager, type ToolRuntime } from './canvas-tool-manager'

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

describe('CanvasToolManager stitch tool', () => {
  it('places stitch holes on nearby cut geometry when no stitch line exists', () => {
    const manager = new CanvasToolManager()
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

    const runtime: ToolRuntime = {
      draftPoints: [],
      activeLayerId: 'layer-1',
      activeLineTypeId: 'cut',
      activeSketchGroup: null,
      viewportScale: 1,
      stitchHoleType: 'round',
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
      toolManager: manager,
      pointPicked: (_point: Point) => undefined,
    }

    manager.pointerDown('stitch-hole', { x: 40, y: 2 }, runtime)

    expect(stitchHoles).toHaveLength(1)
    expect(stitchHoles[0].shapeId).toBe(cutShape.id)
    expect(stitchHoles[0].point.x).toBe(40)
    expect(stitchHoles[0].point.y).toBe(0)
    expect(selectedStitchHoleId).toBe(stitchHoles[0].id)
    expect(status).toBe('Stitch hole placed on cut path (round)')
  })
})
