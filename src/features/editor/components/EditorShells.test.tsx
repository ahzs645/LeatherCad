import { act, createElement, type ReactNode } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanupRender, renderForTest } from '../../../test/render'
import { EditorDesktopShell } from './EditorDesktopShell'
import { EditorMobileShell } from './EditorMobileShell'
import { EditorOverlayHost } from './EditorOverlayHost'

vi.mock('./EditorTopbar', () => ({
  EditorTopbar: () => createElement('div', { 'data-topbar': true }, 'topbar'),
}))

vi.mock('./EditorCanvasPane', () => ({
  EditorCanvasPane: () => createElement('div', { 'data-canvas-pane': true }, 'canvas'),
}))

vi.mock('./EditorPreviewPane', () => ({
  EditorPreviewPane: () => createElement('div', { 'data-preview-pane': true }, 'preview'),
}))

vi.mock('./PrecisionCommandPanel', () => ({
  PrecisionCommandPanel: () => createElement('div', { 'data-precision-panel': true }, 'precision'),
}))

vi.mock('./EditorStatusBar', () => ({
  EditorStatusBar: () => createElement('div', { 'data-status-bar': true }, 'status'),
}))

vi.mock('./EditorModalStack', () => ({
  EditorModalStack: () => createElement('div', { 'data-modal-stack': true }, 'modal'),
}))

vi.mock('./EditorHiddenInputs', () => ({
  EditorHiddenInputs: () => createElement('div', { 'data-hidden-inputs': true }, 'inputs'),
}))

vi.mock('./PieceInspectorModal', () => ({
  PieceInspectorModal: () => createElement('div', { 'data-piece-inspector': true }, 'piece'),
}))

vi.mock('./PieceInspectorContent', () => ({
  PieceInspectorContent: () => createElement('div', { 'data-piece-content': true }, 'piece-content'),
}))

vi.mock('./ErrorBoundary', () => ({
  ErrorBoundary: ({ children }: { children: ReactNode }) => createElement('div', { 'data-error-boundary': true }, children),
}))

vi.mock('./ProjectMemoModal', () => ({
  ProjectMemoModal: () => createElement('div', { 'data-project-memo': true }, 'memo'),
}))

vi.mock('./NestingModal', () => ({
  NestingModal: () => createElement('div', { 'data-nesting': true }, 'nesting'),
}))

vi.mock('../workbench/EditorWorkbench', () => ({
  EditorWorkbench: ({
    twoDPane,
    threeDPane,
    previewContent,
    inspectContent,
    pieceContent,
    documentContent,
    precisionDrawer,
  }: {
    twoDPane: ReactNode
    threeDPane: ReactNode
    previewContent: ReactNode
    inspectContent: ReactNode
    pieceContent: ReactNode
    documentContent: ReactNode
    precisionDrawer: ReactNode
  }) =>
    createElement(
      'div',
      { 'data-desktop-shell': true },
      twoDPane,
      threeDPane,
      previewContent,
      inspectContent,
      pieceContent,
      documentContent,
      precisionDrawer,
    ),
}))

vi.mock('../workbench/SelectionInspectorPanel', () => ({
  SelectionInspectorPanel: () => createElement('div', { 'data-selection-inspector': true }, 'inspect'),
}))

vi.mock('../workbench/DocumentInspectorPanel', () => ({
  DocumentInspectorPanel: () => createElement('div', { 'data-document-inspector': true }, 'document'),
}))

vi.mock('../workbench/WorkbenchThreeWorkspace', () => ({
  WorkbenchThreeWorkspace: ({
    children,
  }: {
    children: (content: { threeDPane: ReactNode; previewContent: ReactNode }) => ReactNode
  }) =>
    createElement(
      'div',
      { 'data-three-workspace': true },
      children({
        threeDPane: createElement('div', { 'data-three-pane': true }, '3d'),
        previewContent: createElement('div', { 'data-three-preview': true }, 'preview'),
      }),
    ),
}))

let lastRender: ReturnType<typeof renderForTest> | null = null

afterEach(() => {
  cleanupRender(lastRender)
  lastRender = null
})

describe('Editor shells', () => {
  it('renders the mobile shell flow with topbar, canvas, preview, precision panel, and status bar', () => {
    lastRender = renderForTest(
      createElement(EditorMobileShell, {
        workspaceRef: { current: null },
        workspaceClassName: 'workspace',
        topbarProps: {} as never,
        canvasPaneProps: {} as never,
        hideCanvasPane: false,
        previewPaneProps: {} as never,
        precisionPanelProps: {
          open: false,
          onClose: () => undefined,
          toolHint: 'hint',
          onRunCommand: () => '',
        },
        statusBarProps: {} as never,
      }),
    )

    expect(lastRender.container.querySelector('[data-topbar]')).not.toBeNull()
    expect(lastRender.container.querySelector('[data-canvas-pane]')).not.toBeNull()
    expect(lastRender.container.querySelector('[data-preview-pane]')).not.toBeNull()
    expect(lastRender.container.querySelector('[data-precision-panel]')).not.toBeNull()
    expect(lastRender.container.querySelector('[data-status-bar]')).not.toBeNull()
    expect(lastRender.container.querySelector('.canvas-stage')?.className).not.toContain('panel-hidden')
  })

  it('hides the canvas stage wrapper, not just the pane, when the 2D lane is off', () => {
    // The wrapper is a grid item. Leaving it mounted lets it claim the
    // workspace's only explicit row and starves the 3D pane, which is what
    // squeezed the phone 3D canvas down to 195px of a 664px viewport.
    lastRender = renderForTest(
      createElement(EditorMobileShell, {
        workspaceRef: { current: null },
        workspaceClassName: 'workspace mobile-preview',
        topbarProps: {} as never,
        canvasPaneProps: {} as never,
        hideCanvasPane: true,
        previewPaneProps: {} as never,
        precisionPanelProps: {
          open: false,
          onClose: () => undefined,
          toolHint: 'hint',
          onRunCommand: () => '',
        },
        statusBarProps: {} as never,
      }),
    )

    const stage = lastRender.container.querySelector('.canvas-stage')
    expect(stage).not.toBeNull()
    expect(stage?.className).toContain('panel-hidden')
  })

  it('renders the desktop shell from explicit prop bags', async () => {
    lastRender = renderForTest(
      createElement(EditorDesktopShell, {
        shouldLoadThreeWorkbench: true,
        workbenchProps: {} as never,
        selectionInspectorProps: {} as never,
        pieceInspectorContentProps: {} as never,
        documentInspectorProps: {} as never,
        canvasPaneProps: {} as never,
        precisionPanelProps: {
          open: false,
          onClose: () => undefined,
          toolHint: 'hint',
          onRunCommand: () => '',
        },
        workbenchThreeWorkspaceProps: {
          workspaceMode: '3d',
        } as never,
        onOpenThreeWorkspace: () => undefined,
      }),
    )

    await act(async () => {
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(lastRender.container.querySelector('[data-desktop-shell]')).not.toBeNull()
    expect(lastRender.container.querySelector('[data-three-workspace]')).not.toBeNull()
    expect(lastRender.container.querySelector('[data-three-pane]')).not.toBeNull()
    expect(lastRender.container.querySelector('[data-piece-content]')).not.toBeNull()
    expect(lastRender.container.querySelector('[data-precision-panel]')).not.toBeNull()
  })

  it('instantiates overlay components from prop bags', async () => {
    lastRender = renderForTest(
      createElement(EditorOverlayHost, {
        modalStackProps: {} as never,
        projectMemoModalProps: {
          open: true,
          onClose: () => undefined,
          value: '',
          onChange: () => undefined,
        },
        pieceInspectorModalProps: {
          open: true,
          piece: null,
          grainline: null,
          pieceLabel: null,
          patternLabel: null,
          seamAllowance: null,
          seamConnections: [],
          notches: [],
          placementLabels: [],
          edgeCount: 0,
          availableInternalShapes: [],
          selectedInternalShapeIds: new Set<string>(),
          onClose: () => undefined,
          onUpdatePiece: () => undefined,
          onToggleInternalShape: () => undefined,
          onUpdateGrainline: () => undefined,
          onUpdatePieceLabel: () => undefined,
          onUpdatePatternLabel: () => undefined,
          onUpdateSeamAllowance: () => undefined,
          onUpdateSeamConnection: () => undefined,
          onDeleteSeamConnection: () => undefined,
          onUpdateNotch: () => undefined,
          onDeleteNotch: () => undefined,
          onAddPlacementLabel: () => undefined,
          onUpdatePlacementLabel: () => undefined,
          onDeletePlacementLabel: () => undefined,
        },
        nestingModalProps: {
          open: true,
          onClose: () => undefined,
          patternPieces: [],
          pieceGrainlines: [],
          patternPieceChainsByShapeId: new Map(),
          selectedShapeIds: new Set<string>(),
          activeLayerId: 'layer-1',
          activeLineTypeId: 'type-1',
          onApplyNesting: () => undefined,
        },
        hiddenInputsProps: {} as never,
        fontInputRef: { current: null },
        onFontInputChange: () => undefined,
      }),
    )

    await act(async () => {
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(lastRender.container.querySelector('[data-modal-stack]')).not.toBeNull()
    expect(lastRender.container.querySelector('[data-piece-inspector]')).not.toBeNull()
    expect(lastRender.container.querySelector('[data-hidden-inputs]')).not.toBeNull()
    expect(lastRender.container.querySelector('input[type="file"]')).not.toBeNull()
  })
})
