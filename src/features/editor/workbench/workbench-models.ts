import type { Shape, StitchHole, HardwareMarker, PatternPiece } from '../cad/cad-types'
import type {
  DocumentBrowserModelParams,
  DocumentBrowserNode,
  InspectorContext,
  RibbonCommandGroup,
  QuickAction,
  WorkbenchRibbonTab,
} from './workbench-types'

const LCC_SEMANTIC_LAYER_NAMES = new Set([
  'Cut/Holes',
  'Fold/Crease',
  'Marking',
  'Stitching',
  'Dimensions',
])

function buildLayerChildren(
  layers: DocumentBrowserModelParams['layers'],
  activeLayerId: string,
) {
  return layers.map((layer, index) => ({
    id: `layer:${layer.id}`,
    kind: 'layer' as const,
    label: layer.name,
    meta: `z${layer.stackLevel ?? index}`,
    selected: activeLayerId === layer.id,
    dimmed: !layer.visible,
  }))
}

export function buildDocumentBrowserModel(params: DocumentBrowserModelParams): DocumentBrowserNode[] {
  const {
    patternPieces,
    pieceLabels,
    seamAllowances,
    pieceNotches,
    piecePlacementLabels,
    seamConnections,
    selectedPieceIds,
    layers,
    activeLayerId,
    sketchGroups,
    activeSketchGroupId,
    tracingOverlays,
    activeTracingOverlayId,
    avatars,
    threeTextureSource,
  } = params

  const pieceSection: DocumentBrowserNode = {
    id: 'section-pieces',
    kind: 'section',
    label: 'Pieces',
    meta: `${patternPieces.length}`,
    children: patternPieces.map((piece) => ({
      id: `piece:${piece.id}`,
      kind: 'piece',
      label: piece.name,
      meta: piece.code ?? `${piece.quantity}x`,
      selected: selectedPieceIds.includes(piece.id),
      dimmed: !piece.includeInLayout,
      children: [
        ...pieceLabels
          .filter((label) => label.pieceId === piece.id && label.kind === 'piece')
          .map((label) => ({
            id: `piece-label:${piece.id}:${label.id}`,
            kind: 'piece-label' as const,
            label: 'Piece Label',
            meta: label.visible ? 'visible' : 'hidden',
            selected: selectedPieceIds.includes(piece.id),
          })),
        ...pieceLabels
          .filter((label) => label.pieceId === piece.id && label.kind === 'pattern')
          .map((label) => ({
            id: `pattern-label:${piece.id}:${label.id}`,
            kind: 'pattern-label' as const,
            label: 'Pattern Label',
            meta: label.visible ? 'visible' : 'hidden',
            selected: selectedPieceIds.includes(piece.id),
          })),
        ...seamAllowances
          .filter((entry) => entry.pieceId === piece.id)
          .map((entry) => ({
            id: `seam-allowance:${piece.id}:${entry.id}`,
            kind: 'seam-allowance' as const,
            label: 'Seam Allowance',
            meta: entry.enabled ? `${entry.defaultOffsetMm}mm` : 'disabled',
            selected: selectedPieceIds.includes(piece.id),
          })),
        ...pieceNotches
          .filter((entry) => entry.pieceId === piece.id)
          .map((entry, index) => ({
            id: `notch:${piece.id}:${entry.id}`,
            kind: 'notch' as const,
            label: `Notch ${index + 1}`,
            meta: entry.style,
            selected: selectedPieceIds.includes(piece.id),
          })),
        ...piecePlacementLabels
          .filter((entry) => entry.pieceId === piece.id)
          .map((entry) => ({
            id: `placement-label:${piece.id}:${entry.id}`,
            kind: 'placement-label' as const,
            label: entry.name,
            meta: entry.kind,
            selected: selectedPieceIds.includes(piece.id),
          })),
        ...seamConnections
          .filter((entry) => entry.from.pieceId === piece.id || entry.to.pieceId === piece.id)
          .map((entry, index) => ({
            id: `seam-connection:${piece.id}:${entry.id}`,
            kind: 'seam-connection' as const,
            label: `Connection ${index + 1}`,
            meta: entry.kind,
            selected: selectedPieceIds.includes(piece.id),
          })),
      ],
    })),
  }

  const layerChildren = buildLayerChildren(layers, activeLayerId)
  const isFlatLccSemanticLayerStack =
    layers.length > 0 && layers.every((layer) => LCC_SEMANTIC_LAYER_NAMES.has(layer.name))

  const layerSection: DocumentBrowserNode = {
    id: 'section-layers',
    kind: 'section',
    label: 'Layers',
    meta: isFlatLccSemanticLayerStack ? '1' : `${layers.length}`,
    children: isFlatLccSemanticLayerStack
      ? [{
          id: 'layer-group:lcc-material-1',
          kind: 'layer-group',
          label: 'Material Layer 1',
          meta: `${layers.length} sublayers`,
          selected: layerChildren.some((child) => child.selected),
          dimmed: layerChildren.every((child) => child.dimmed),
          children: layerChildren,
        }]
      : layerChildren,
  }

  const sketchSection: DocumentBrowserNode = {
    id: 'section-sketches',
    kind: 'section',
    label: 'Sketches',
    meta: `${sketchGroups.length}`,
    children: sketchGroups.map((group) => ({
      id: `sketch:${group.id}`,
      kind: 'sketch',
      label: group.name,
      meta: group.linkMode ?? 'local',
      selected: activeSketchGroupId === group.id,
      dimmed: !group.visible,
    })),
  }

  const tracingSection: DocumentBrowserNode = {
    id: 'section-tracing',
    kind: 'section',
    label: 'Tracing',
    meta: `${tracingOverlays.length}`,
    children: tracingOverlays.map((overlay) => ({
      id: `tracing:${overlay.id}`,
      kind: 'tracing-overlay',
      label: overlay.name,
      meta: overlay.kind,
      selected: activeTracingOverlayId === overlay.id,
      dimmed: !overlay.visible,
    })),
  }

  const assetChildren: DocumentBrowserNode[] = [
    {
      id: 'preview-settings',
      kind: 'preview-settings',
      label: 'Preview Settings',
      meta: 'global',
    },
    {
      id: 'texture-source',
      kind: 'texture-source',
      label: 'Texture Source',
      meta: threeTextureSource?.sourceUrl ? 'configured' : 'default',
    },
    ...avatars.map((avatar) => ({
      id: `avatar:${avatar.id}`,
      kind: 'avatar' as const,
      label: avatar.name,
      meta: avatar.id,
    })),
  ]

  return [
    pieceSection,
    layerSection,
    sketchSection,
    tracingSection,
    {
      id: 'section-assets',
      kind: 'section',
      label: '3D Assets',
      meta: `${assetChildren.length}`,
      children: assetChildren,
    },
  ]
}

export function buildInspectorContext(params: {
  selectedShapes: Shape[]
  selectedPatternPiece: PatternPiece | null
  selectedStitchHole: StitchHole | null
  selectedHardwareMarker: HardwareMarker | null
}): InspectorContext {
  const { selectedShapes, selectedPatternPiece, selectedStitchHole, selectedHardwareMarker } = params

  if (selectedHardwareMarker) {
    return {
      kind: 'hardware',
      title: selectedHardwareMarker.label || 'Hardware Marker',
      description: `${selectedHardwareMarker.kind} on layer`,
      hardwareMarker: selectedHardwareMarker,
    }
  }

  if (selectedStitchHole) {
    return {
      kind: 'stitch-hole',
      title: `Stitch Hole ${selectedStitchHole.sequence}`,
      description: selectedStitchHole.holeType,
      stitchHole: selectedStitchHole,
    }
  }

  if (selectedPatternPiece) {
    return {
      kind: 'piece',
      title: selectedPatternPiece.name,
      description: `Pattern piece on layer ${selectedPatternPiece.layerId}`,
      piece: selectedPatternPiece,
    }
  }

  if (selectedShapes.length === 1) {
    return {
      kind: 'shape',
      title: `${selectedShapes[0].type} shape`,
      description: selectedShapes[0].id,
      shape: selectedShapes[0],
    }
  }

  if (selectedShapes.length > 1) {
    return {
      kind: 'shape-multi',
      title: `${selectedShapes.length} shapes selected`,
      description: 'Multi-selection',
      shapes: selectedShapes,
    }
  }

  return {
    kind: 'empty',
    title: 'Nothing selected',
    description: 'Use the browser, tool rail, or canvas to focus a working context.',
  }
}

export function buildRibbonModel(params: {
  activeTab: WorkbenchRibbonTab
  canUndo: boolean
  canRedo: boolean
  canPaste: boolean
  selectedShapeCount: number
  selectedPatternPiece: boolean
  selectedStitchHole: boolean
}): RibbonCommandGroup[] {
  const { activeTab, canUndo, canRedo, canPaste, selectedShapeCount, selectedPatternPiece, selectedStitchHole } = params

  const groupsByTab: Record<WorkbenchRibbonTab, RibbonCommandGroup[]> = {
    draft: [
      {
        id: 'draft-view',
        title: 'View',
        items: [
          { id: 'fit-view', label: 'Fit', icon: 'fit' },
          { id: 'reset-view', label: 'Reset', icon: 'reset' },
          { id: 'toggle-ruler', label: 'Ruler', icon: 'ruler' },
          { id: 'toggle-dimensions', label: 'Dims', icon: 'dimensions' },
        ],
      },
      {
        id: 'draft-grid',
        title: 'Draft',
        items: [
          { id: 'load-preset', label: 'Preset', icon: 'preset' },
          { id: 'load-compact-clasp-preset', label: 'Compact', icon: 'preset' },
          { id: 'toggle-annotations', label: 'Notes', icon: 'notes' },
        ],
      },
    ],
    modify: [
      {
        id: 'modify-history',
        title: 'History',
        items: [
          { id: 'undo', label: 'Undo', icon: 'undo', disabled: !canUndo },
          { id: 'redo', label: 'Redo', icon: 'redo', disabled: !canRedo },
        ],
      },
      {
        id: 'modify-clipboard',
        title: 'Clipboard',
        items: [
          { id: 'copy', label: 'Copy', icon: 'copy', disabled: selectedShapeCount === 0 },
          { id: 'paste', label: 'Paste', icon: 'paste', disabled: !canPaste },
          { id: 'delete', label: 'Delete', icon: 'delete', disabled: selectedShapeCount === 0 },
        ],
      },
      {
        id: 'modify-transform',
        title: 'Transform',
        items: [
          { id: 'move-distance', label: 'Move', icon: 'move', disabled: selectedShapeCount === 0 },
          { id: 'rotate-ccw-5', label: 'Rot -5', icon: 'rotate', disabled: selectedShapeCount === 0 },
          { id: 'rotate-ccw-1', label: 'Rot -1', icon: 'rotate', disabled: selectedShapeCount === 0 },
          { id: 'rotate-cw-1', label: 'Rot +1', icon: 'rotate', disabled: selectedShapeCount === 0 },
          { id: 'rotate-cw-5', label: 'Rot +5', icon: 'rotate', disabled: selectedShapeCount === 0 },
          { id: 'specify-rotation', label: 'Rotate...', icon: 'rotate', disabled: selectedShapeCount === 0 },
          { id: 'scale-down-5', label: 'Scale -5%', icon: 'scale', disabled: selectedShapeCount === 0 },
          { id: 'scale-down-1', label: 'Scale -1%', icon: 'scale', disabled: selectedShapeCount === 0 },
          { id: 'scale-up-1', label: 'Scale +1%', icon: 'scale', disabled: selectedShapeCount === 0 },
          { id: 'scale-up-5', label: 'Scale +5%', icon: 'scale', disabled: selectedShapeCount === 0 },
          { id: 'specify-scale', label: 'Scale...', icon: 'scale', disabled: selectedShapeCount === 0 },
          { id: 'specify-scale-x', label: 'Scale X...', icon: 'scale', disabled: selectedShapeCount === 0 },
          { id: 'specify-scale-y', label: 'Scale Y...', icon: 'scale', disabled: selectedShapeCount === 0 },
          { id: 'set-rotation-pivot', label: 'Set Pivot', icon: 'inspect', disabled: selectedShapeCount === 0 },
          { id: 'clear-rotation-pivot', label: 'Clear Pivot', icon: 'clear' },
          { id: 'set-snap-point', label: 'Set Snap', icon: 'inspect', disabled: selectedShapeCount === 0 },
          { id: 'clear-snap-point', label: 'Clear Snap', icon: 'clear' },
          { id: 'resize-shape', label: 'Resize', icon: 'resize', disabled: selectedShapeCount === 0 },
        ],
      },
      {
        id: 'modify-geometry',
        title: 'Geometry',
        items: [
          { id: 'arc-to-bezier', label: 'Arc→Bez', icon: 'convert', disabled: selectedShapeCount === 0 },
          { id: 'cad-offset', label: 'Offset', icon: 'offset', disabled: selectedShapeCount === 0 },
          { id: 'cad-trim', label: 'Trim', icon: 'trim' },
          { id: 'cad-extend', label: 'Extend', icon: 'trim' },
          { id: 'cad-mirror', label: 'Mirror', icon: 'mirror', disabled: selectedShapeCount === 0 },
          { id: 'extend-trim', label: 'Line Trim', icon: 'trim', disabled: selectedShapeCount < 2 },
          { id: 'mirror-shapes', label: 'Mirror', icon: 'mirror', disabled: selectedShapeCount === 0 },
          { id: 'line-symmetry', label: 'Line Sym', icon: 'mirror', disabled: selectedShapeCount === 0 },
          { id: 'bezier-cp-symmetric', label: 'Symm CP', icon: 'bezier-cp', disabled: selectedShapeCount < 2 },
          { id: 'toggle-bezier-lines', label: 'Bezier Guides', icon: 'bezier-cp' },
        ],
      },
    ],
    piece: [
      {
        id: 'piece-main',
        title: 'Piece',
        items: [
          { id: 'create-piece', label: 'Create', icon: 'piece', disabled: selectedShapeCount === 0 },
          { id: 'open-piece', label: 'Inspect', icon: 'inspect', disabled: !selectedPatternPiece },
          { id: 'apply-seam-allowance', label: 'Seam', icon: 'seam', disabled: selectedShapeCount === 0 },
        ],
      },
      {
        id: 'piece-layout',
        title: 'Layout',
        items: [
          { id: 'open-nesting', label: 'Nest', icon: 'nest' },
          { id: 'piece-tab', label: 'Piece Tab', icon: 'inspect', disabled: !selectedPatternPiece },
        ],
      },
    ],
    stitch: [
      {
        id: 'stitch-main',
        title: 'Stitch',
        items: [
          { id: 'place-fixed-stitch', label: 'Fixed', icon: 'stitch' },
          { id: 'place-variable-stitch', label: 'Var', icon: 'stitch-var' },
          { id: 'count-stitches', label: 'Count', icon: 'dimensions', disabled: selectedShapeCount === 0 },
        ],
      },
      {
        id: 'stitch-order',
        title: 'Order',
        items: [
          { id: 'resequence-stitches', label: 'Reseq', icon: 'resequence', disabled: !selectedStitchHole },
          { id: 'next-stitch', label: 'Next', icon: 'next', disabled: !selectedStitchHole },
          { id: 'clear-stitches', label: 'Clear', icon: 'clear' },
        ],
      },
      {
        id: 'stitch-tools',
        title: 'Tools',
        items: [
          { id: 'stitch-simulator', label: 'Simulate', icon: 'simulator' },
          { id: 'box-stitch', label: 'Box Stitch', icon: 'box-stitch' },
        ],
      },
    ],
    output: [
      {
        id: 'output-file',
        title: 'File',
        items: [
          { id: 'save-json', label: 'Save', icon: 'save' },
          { id: 'local-projects', label: 'Projects', icon: 'open' },
          { id: 'load-json', label: 'Open', icon: 'open' },
          { id: 'import-svg', label: 'SVG In', icon: 'import' },
        ],
      },
      {
        id: 'output-export',
        title: 'Export',
        items: [
          { id: 'export-center', label: 'Center', icon: 'export' },
          { id: 'export-options', label: 'Options', icon: 'export-options' },
          { id: 'export-svg', label: 'SVG', icon: 'svg' },
          { id: 'export-pdf', label: 'PDF', icon: 'pdf' },
          { id: 'export-dxf', label: 'DXF', icon: 'dxf' },
          { id: 'print-preview', label: 'Print', icon: 'print' },
        ],
      },
      {
        id: 'output-tools',
        title: 'Tools',
        items: [
          { id: 'options', label: 'Options', icon: 'settings' },
          { id: 'template-repository', label: 'Templates', icon: 'templates' },
          { id: 'tracing', label: 'Tracing', icon: 'tracing' },
          { id: 'ai-builder', label: 'AI', icon: 'ai' },
        ],
      },
      {
        id: 'output-wizards',
        title: 'Wizards',
        items: [
          { id: 'pattern-wizard', label: 'Wizard', icon: 'wizard' },
          { id: 'mandala', label: 'Mandala', icon: 'mandala' },
          { id: 'letter-stamp', label: 'Stamp', icon: 'stamp' },
        ],
      },
    ],
  }

  return groupsByTab[activeTab]
}

export function buildQuickActions(params: {
  canUndo: boolean
  canRedo: boolean
}): QuickAction[] {
  return [
    { id: 'save-json', label: 'Save', icon: 'save' },
    { id: 'undo', label: 'Undo', icon: 'undo', disabled: !params.canUndo },
    { id: 'redo', label: 'Redo', icon: 'redo', disabled: !params.canRedo },
    { id: 'options', label: 'Options', icon: 'settings' },
    { id: 'help', label: 'Help', icon: 'help' },
  ]
}
