import { describe, expect, it } from 'vitest'
import {
  buildDocumentBrowserModel,
  buildInspectorContext,
  buildQuickActions,
  buildRibbonModel,
} from './workbench-models'

describe('buildDocumentBrowserModel', () => {
  it('derives compact browser sections from existing editor state', () => {
    const nodes = buildDocumentBrowserModel({
      patternPieces: [
        {
          id: 'piece-1',
          name: 'Body Panel',
          code: 'A1',
          quantity: 2,
          includeInLayout: true,
          layerId: 'layer-1',
        } as never,
      ],
      pieceLabels: [
        {
          id: 'piece-label-1',
          pieceId: 'piece-1',
          kind: 'piece',
          visible: true,
        } as never,
      ],
      seamAllowances: [
        {
          id: 'sa-1',
          pieceId: 'piece-1',
          enabled: true,
          defaultOffsetMm: 4,
        } as never,
      ],
      pieceNotches: [
        {
          id: 'notch-1',
          pieceId: 'piece-1',
          style: 'single',
        } as never,
      ],
      piecePlacementLabels: [
        {
          id: 'placement-1',
          pieceId: 'piece-1',
          name: 'Pocket',
          kind: 'alignment',
        } as never,
      ],
      seamConnections: [
        {
          id: 'connection-1',
          kind: 'butt',
          from: { pieceId: 'piece-1', edgeIndex: 0 },
          to: { pieceId: 'piece-2', edgeIndex: 1 },
        } as never,
      ],
      selectedPieceIds: ['piece-1'],
      layers: [
        { id: 'layer-1', name: 'Front', visible: true, locked: false, stackLevel: 0 } as never,
        { id: 'layer-2', name: 'Back', visible: false, locked: true, stackLevel: 1 } as never,
      ],
      activeLayerId: 'layer-1',
      sketchGroups: [
        { id: 'sketch-1', name: 'Reference', linkMode: 'mirror', visible: true } as never,
      ],
      activeSketchGroupId: 'sketch-1',
      tracingOverlays: [
        { id: 'trace-1', name: 'Blueprint', kind: 'image', visible: false, locked: true } as never,
      ],
      activeTracingOverlayId: 'trace-1',
      avatars: [{ id: 'avatar-1', name: 'Mannequin' } as never],
      threeTextureSource: { sourceUrl: 'https://textures.example/leather' } as never,
    })

    expect(nodes.map((node) => node.label)).toEqual(['Pieces', 'Layers', 'Sketches', 'Tracing', '3D Assets'])
    expect(nodes[0]?.children?.[0]?.selected).toBe(true)
    expect(nodes[0]?.children?.[0]?.children?.map((child) => child.kind)).toEqual([
      'piece-label',
      'seam-allowance',
      'notch',
      'placement-label',
      'seam-connection',
    ])
    expect(nodes[1]?.children?.[1]?.dimmed).toBe(true)
    expect(nodes[4]?.children?.[1]?.meta).toBe('configured')
  })

  it('groups standard LCC semantic layers under one material-layer parent', () => {
    const nodes = buildDocumentBrowserModel({
      patternPieces: [],
      pieceLabels: [],
      seamAllowances: [],
      pieceNotches: [],
      piecePlacementLabels: [],
      seamConnections: [],
      selectedPieceIds: [],
      layers: [
        { id: 'layer-1', name: 'Cut/Holes', visible: true, locked: false, stackLevel: 0 } as never,
        { id: 'layer-2', name: 'Fold/Crease', visible: true, locked: false, stackLevel: 1 } as never,
        { id: 'layer-3', name: 'Marking', visible: true, locked: false, stackLevel: 2 } as never,
        { id: 'layer-4', name: 'Stitching', visible: true, locked: false, stackLevel: 3 } as never,
        { id: 'layer-5', name: 'Dimensions', visible: true, locked: false, stackLevel: 4 } as never,
      ],
      activeLayerId: 'layer-1',
      sketchGroups: [],
      activeSketchGroupId: null,
      tracingOverlays: [],
      activeTracingOverlayId: null,
      avatars: [],
      threeTextureSource: null,
    })

    expect(nodes[1]?.meta).toBe('1')
    expect(nodes[1]?.children?.[0]?.kind).toBe('layer-group')
    expect(nodes[1]?.children?.[0]?.label).toBe('Material Layer 1')
    expect(nodes[1]?.children?.[0]?.children?.map((child) => child.label)).toEqual([
      'Cut/Holes',
      'Fold/Crease',
      'Marking',
      'Stitching',
      'Dimensions',
    ])
  })
})

describe('buildInspectorContext', () => {
  it('prefers hardware and stitch selections over broader shape state', () => {
    const context = buildInspectorContext({
      selectedShapes: [{ id: 'shape-1', type: 'line' } as never],
      selectedPatternPiece: { id: 'piece-1', name: 'Body Panel', layerId: 'layer-1' } as never,
      selectedStitchHole: { id: 'stitch-1', sequence: 5, holeType: 'round' } as never,
      selectedHardwareMarker: { id: 'hardware-1', kind: 'snap', label: 'Snap A' } as never,
    })

    expect(context.kind).toBe('hardware')
    expect(context.title).toBe('Snap A')
  })

  it('returns an explicit empty-state context when nothing is selected', () => {
    expect(
      buildInspectorContext({
        selectedShapes: [],
        selectedPatternPiece: null,
        selectedStitchHole: null,
        selectedHardwareMarker: null,
      }),
    ).toEqual({
      kind: 'empty',
      title: 'Nothing selected',
      description: 'Use the browser, tool rail, or canvas to focus a working context.',
    })
  })
})

describe('buildRibbonModel', () => {
  it('groups commands by workbench tab and respects disabled state', () => {
    const groups = buildRibbonModel({
      activeTab: 'modify',
      canUndo: false,
      canRedo: true,
      canPaste: false,
      selectedShapeCount: 0,
      selectedPatternPiece: false,
      selectedStitchHole: false,
    })

    expect(groups.map((group) => group.id)).toEqual([
      'modify-history',
      'modify-clipboard',
      'modify-transform',
    ])
    expect(groups[0]?.items.find((item) => item.id === 'undo')?.disabled).toBe(true)
    expect(groups[1]?.items.find((item) => item.id === 'paste')?.disabled).toBe(true)
  })
})

describe('buildQuickActions', () => {
  it('keeps the header actions compact and status-aware', () => {
    expect(buildQuickActions({ canUndo: false, canRedo: true })).toEqual([
      { id: 'save-json', label: 'Save', icon: 'save' },
      { id: 'undo', label: 'Undo', icon: 'undo', disabled: true },
      { id: 'redo', label: 'Redo', icon: 'redo', disabled: false },
      { id: 'help', label: 'Help', icon: 'help' },
    ])
  })
})
