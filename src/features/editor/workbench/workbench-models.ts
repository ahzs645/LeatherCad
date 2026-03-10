import type { Shape, StitchHole, HardwareMarker, PatternPiece } from '../cad/cad-types'
import type {
  DocumentBrowserModelParams,
  DocumentBrowserNode,
  InspectorContext,
  RibbonCommandGroup,
  QuickAction,
  WorkbenchRibbonTab,
} from './workbench-types'

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

  const layerSection: DocumentBrowserNode = {
    id: 'section-layers',
    kind: 'section',
    label: 'Layers',
    meta: `${layers.length}`,
    children: layers.map((layer, index) => ({
      id: `layer:${layer.id}`,
      kind: 'layer',
      label: layer.name,
      meta: `z${layer.stackLevel ?? index}`,
      selected: activeLayerId === layer.id,
      dimmed: !layer.visible,
    })),
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
          { id: 'rotate-5', label: 'Rotate', icon: 'rotate', disabled: selectedShapeCount === 0 },
          { id: 'scale-up', label: 'Scale', icon: 'scale', disabled: selectedShapeCount === 0 },
        ],
      },
    ],
    piece: [
      {
        id: 'piece-main',
        title: 'Piece',
        items: [
          { id: 'create-piece', label: 'Create', icon: 'piece', disabled: selectedShapeCount !== 1 },
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
    ],
    output: [
      {
        id: 'output-file',
        title: 'File',
        items: [
          { id: 'save-json', label: 'Save', icon: 'save' },
          { id: 'load-json', label: 'Open', icon: 'open' },
          { id: 'import-svg', label: 'SVG In', icon: 'import' },
        ],
      },
      {
        id: 'output-export',
        title: 'Export',
        items: [
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
          { id: 'template-repository', label: 'Templates', icon: 'templates' },
          { id: 'tracing', label: 'Tracing', icon: 'tracing' },
          { id: 'ai-builder', label: 'AI', icon: 'ai' },
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
    { id: 'help', label: 'Help', icon: 'help' },
  ]
}
