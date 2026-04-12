import { createElement, type ReactNode } from 'react'
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

vi.mock('./ErrorBoundary', () => ({
  ErrorBoundary: ({ children }: { children: ReactNode }) => createElement('div', { 'data-error-boundary': true }, children),
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
  })

  it('renders the desktop shell through the extracted workspace wrapper', () => {
    lastRender = renderForTest(
      createElement(EditorDesktopShell, {
        shouldLoadThreeWorkbench: true,
        renderDesktopWorkbench: (threeDPane, previewContent) =>
          createElement('div', { 'data-desktop-shell': true }, threeDPane, previewContent),
        threeWorkspaceLoadingState: createElement('div', null, 'loading'),
        threeWorkspaceRoutePrompt: createElement('div', null, 'prompt'),
        workbenchProps: {
          workspaceMode: '3d',
        } as never,
      }),
    )

    expect(lastRender.container.querySelector('[data-desktop-shell]')).not.toBeNull()
    expect(lastRender.container.querySelector('[data-three-workspace]')).not.toBeNull()
    expect(lastRender.container.querySelector('[data-three-pane]')).not.toBeNull()
    expect(lastRender.container.querySelector('[data-three-preview]')).not.toBeNull()
  })

  it('mounts the overlay host contents independently of the active shell', () => {
    lastRender = renderForTest(
      createElement(EditorOverlayHost, {
        modalStack: createElement('div', { 'data-modal-stack': true }, 'modal'),
        projectMemoModal: createElement('div', { 'data-project-memo': true }, 'memo'),
        pieceInspectorModal: createElement('div', { 'data-piece-inspector': true }, 'piece'),
        nestingModal: createElement('div', { 'data-nesting': true }, 'nesting'),
        hiddenInputs: createElement('div', { 'data-hidden-inputs': true }, 'inputs'),
        fontInput: createElement('input', { 'data-font-input': true }),
      }),
    )

    expect(lastRender.container.querySelector('[data-modal-stack]')).not.toBeNull()
    expect(lastRender.container.querySelector('[data-project-memo]')).not.toBeNull()
    expect(lastRender.container.querySelector('[data-piece-inspector]')).not.toBeNull()
    expect(lastRender.container.querySelector('[data-nesting]')).not.toBeNull()
    expect(lastRender.container.querySelector('[data-hidden-inputs]')).not.toBeNull()
    expect(lastRender.container.querySelector('[data-font-input]')).not.toBeNull()
  })
})
