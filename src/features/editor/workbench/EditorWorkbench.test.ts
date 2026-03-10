import { createElement, useMemo, useState } from 'react'
import { afterEach, describe, expect, it } from 'vitest'
import { PieceInspectorContent } from '../components/PieceInspectorContent'
import { cleanupRender, changeValue, click, getByText, pointerDown, renderForTest } from '../../../test/render'
import { EditorWorkbench } from './EditorWorkbench'
import type {
  DocumentBrowserNode,
  SecondaryPreviewMode,
  WorkbenchInspectorTab,
  WorkbenchRibbonTab,
  WorkspaceMode,
} from './workbench-types'

let lastRender: ReturnType<typeof renderForTest> | null = null

afterEach(() => {
  cleanupRender(lastRender)
  lastRender = null
})

function createHarnessElement() {
  function Harness() {
    const shellRef = { current: null as HTMLElement | null }
    const [workspaceMode, setWorkspaceMode] = useState<WorkspaceMode>('2d')
    const [secondaryPreviewMode, setSecondaryPreviewMode] = useState<SecondaryPreviewMode>('3d-peek')
    const [activeRibbonTab, setActiveRibbonTab] = useState<WorkbenchRibbonTab>('draft')
    const [activeInspectorTab, setActiveInspectorTab] = useState<WorkbenchInspectorTab>('inspect')
    const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null)
    const [selectionText, setSelectionText] = useState('No selection')
    const [lastCommand, setLastCommand] = useState('')
    const [resizeCounts, setResizeCounts] = useState({ browser: 0, peek: 0, inspector: 0 })
    const [piece, setPiece] = useState({
      id: 'piece-1',
      name: 'Body Panel',
      quantity: 1,
      code: 'A1',
      annotation: '',
      material: '',
      materialSide: 'either',
      orientation: 'any',
      notes: '',
      onFold: false,
      mirrorPair: false,
      allowFlip: true,
      includeInLayout: true,
      locked: false,
    })

    const browserNodes = useMemo<DocumentBrowserNode[]>(
      () => [
        {
          id: 'section-pieces',
          kind: 'section',
          label: 'Pieces',
          children: [
            {
              id: 'piece:piece-1',
              kind: 'piece',
              label: piece.name,
              selected: selectedNodeId === 'piece:piece-1',
            },
          ],
        },
        {
          id: 'section-layers',
          kind: 'section',
          label: 'Layers',
          children: [
            {
              id: 'layer:layer-1',
              kind: 'layer',
              label: 'Front Layer',
              selected: selectedNodeId === 'layer:layer-1',
            },
          ],
        },
      ],
      [piece.name, selectedNodeId],
    )

    const ribbonGroups =
      activeRibbonTab === 'output'
        ? [
            {
              id: 'output',
              title: 'Output',
              items: [{ id: 'print-preview', label: 'Print' }],
            },
          ]
        : [
            {
              id: 'draft',
              title: 'Draft',
              items: [{ id: 'fit-view', label: 'Fit' }],
            },
          ]

    const handleSetWorkspaceMode = (nextMode: WorkspaceMode) => {
      setWorkspaceMode(nextMode)
      setSecondaryPreviewMode((previous) => {
        if (previous === 'hidden') {
          return previous
        }
        return nextMode === '2d' ? '3d-peek' : '2d-peek'
      })
    }

    const handleTogglePeek = () => {
      setSecondaryPreviewMode((previous) => {
        if (previous === 'hidden') {
          return workspaceMode === '2d' ? '3d-peek' : '2d-peek'
        }
        return 'hidden'
      })
    }

    return createElement(
      'div',
      null,
      createElement(EditorWorkbench, {
        docLabel: 'Harness Draft',
        shellRef,
        workspaceMode,
        secondaryPreviewMode,
        showPeek: secondaryPreviewMode !== 'hidden',
        browserWidth: 260,
        inspectorWidth: 340,
        peekWidth: 360,
        splitterWidth: 10,
        toolRailWidth: 58,
        quickActions: [{ id: 'save-json', label: 'Save' }],
        onInvokeQuickAction: () => undefined,
        onSetWorkspaceMode: handleSetWorkspaceMode,
        onTogglePeek: handleTogglePeek,
        activeRibbonTab,
        ribbonGroups,
        onSetRibbonTab: setActiveRibbonTab,
        onInvokeRibbonCommand: setLastCommand,
        browserNodes,
        onActivateNode: (node: DocumentBrowserNode) => {
          setSelectedNodeId(node.id)
          setSelectionText(node.label)
          if (node.kind === 'piece') {
            setActiveInspectorTab('piece')
          }
          if (node.kind === 'layer') {
            setActiveInspectorTab('document')
          }
        },
        onToggleLayerVisibility: () => undefined,
        onToggleLayerGroupVisibility: () => undefined,
        onToggleLayerLock: () => undefined,
        onToggleTracingVisibility: () => undefined,
        onToggleTracingLock: () => undefined,
        tool: 'pan',
        onSetActiveTool: () => undefined,
        activeInspectorTab,
        onSetActiveInspectorTab: setActiveInspectorTab,
        inspectContent: createElement('div', null, `Inspect ${selectionText}`),
        pieceContent: createElement(PieceInspectorContent, {
          piece,
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
          autoFocusName: true,
          onUpdatePiece: (patch: Partial<typeof piece>) => setPiece((previous) => ({ ...previous, ...patch })),
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
        }),
        previewContent: createElement('div', null, 'Preview Inspector'),
        documentContent: createElement('div', null, 'Document Inspector'),
        twoDPane: createElement('div', { 'data-testid': 'pane-2d' }, '2D Workspace'),
        threeDPane: createElement('div', { 'data-testid': 'pane-3d' }, '3D Workspace'),
        precisionDrawer: null,
        onStartBrowserResize: () =>
          setResizeCounts((previous) => ({ ...previous, browser: previous.browser + 1 })),
        onStartPeekResize: () =>
          setResizeCounts((previous) => ({ ...previous, peek: previous.peek + 1 })),
        onStartInspectorResize: () =>
          setResizeCounts((previous) => ({ ...previous, inspector: previous.inspector + 1 })),
        toolLabel: 'Pan',
        selectionText,
        zoomPercent: 100,
        displayUnit: 'mm',
        activeLayerName: 'Front Layer',
        activeLineTypeName: 'Cut',
        onTogglePrecision: () => undefined,
      }),
      createElement('output', { 'data-testid': 'last-command' }, lastCommand),
      createElement('output', { 'data-testid': 'piece-name-output' }, piece.name),
      createElement(
        'output',
        { 'data-testid': 'resize-summary' },
        `${resizeCounts.browser}/${resizeCounts.peek}/${resizeCounts.inspector}`,
      ),
    )
  }

  return createElement(Harness)
}

describe('EditorWorkbench', () => {
  it('switches between 2D and 3D primary surfaces without losing selected piece context', () => {
    lastRender = renderForTest(createHarnessElement())

    click(lastRender.container.querySelector('[data-testid="browser-node-piece:piece-1"]'))
    expect(lastRender.container.querySelector('[data-testid="inspector-tab-piece"]')?.getAttribute('aria-selected')).toBe('true')
    expect(lastRender.container.textContent).toContain('Body Panel')

    click(lastRender.container.querySelector('[data-testid="workspace-mode-3d"]'))

    expect(lastRender.container.querySelector('.workbench-3d-surface.in-main')).not.toBeNull()
    expect(lastRender.container.querySelector('.workbench-2d-surface.in-peek.read-only')).not.toBeNull()
    expect(lastRender.container.textContent).toContain('Body Panel')
  })

  it('syncs browser selections, piece editing, ribbon commands, and dock splitters', () => {
    lastRender = renderForTest(createHarnessElement())

    click(lastRender.container.querySelector('[data-testid="browser-node-piece:piece-1"]'))
    changeValue(lastRender.container.querySelector('.workbench-inspector-content .layer-field input'), 'Back Panel')
    expect(lastRender.container.querySelector('[data-testid="piece-name-output"]')?.textContent).toBe('Back Panel')

    click(lastRender.container.querySelector('[data-testid="ribbon-tab-output"]'))
    click(lastRender.container.querySelector('[data-testid="ribbon-command-print-preview"]'))
    expect(lastRender.container.querySelector('[data-testid="last-command"]')?.textContent).toBe('print-preview')

    pointerDown(lastRender.container.querySelector('[data-testid="browser-splitter"]'))
    pointerDown(lastRender.container.querySelector('[data-testid="peek-splitter"]'))
    pointerDown(lastRender.container.querySelector('[data-testid="inspector-splitter"]'))
    expect(lastRender.container.querySelector('[data-testid="resize-summary"]')?.textContent).toBe('1/1/1')

    click(getByText<HTMLButtonElement>(lastRender.container, 'button', 'Front Layer'))
    expect(lastRender.container.querySelector('[data-testid="inspector-tab-document"]')?.getAttribute('aria-selected')).toBe('true')
  })
})
