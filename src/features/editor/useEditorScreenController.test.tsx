import { act, createElement } from 'react'
import { afterEach, beforeAll, describe, expect, it } from 'vitest'
import { cleanupRender, renderForTest } from '../../test/render'
import type { MobileViewMode } from './editor-types'
import { EditorStateProviders } from './state/providers/EditorStateProviders'
import { useEditorScreenController } from './useEditorScreenController'

type HarnessHandle = {
  setMobileViewMode: (mode: MobileViewMode) => void
}

const handles: HarnessHandle[] = []

function Harness() {
  const controller = useEditorScreenController()

  handles.push({ setMobileViewMode: controller.mobileShell.topbarProps.onSetMobileViewMode })

  return createElement('div', {
    'data-layout-mobile': String(controller.layout.isMobileLayout),
    'data-layout-theme': controller.layout.resolvedThemeMode,
    'data-has-mobile-shell': String(Boolean(controller.mobileShell.topbarProps)),
    'data-has-desktop-shell': String(Boolean(controller.desktopShell.workbenchProps)),
    'data-has-overlay': String(Boolean(controller.overlay.modalStackProps)),
    'data-mobile-view-mode': controller.mobileShell.previewPaneProps.mobileViewMode,
    'data-hide-canvas-pane': String(controller.mobileShell.hideCanvasPane),
  })
}

function renderHarness() {
  return renderForTest(
    createElement(
      EditorStateProviders,
      null,
      createElement(Harness),
    ),
  )
}

function readAttribute(attribute: string) {
  return lastRender?.container.firstElementChild?.getAttribute(attribute) ?? null
}

let lastRender: ReturnType<typeof renderForTest> | null = null

beforeAll(() => {
  Object.defineProperty(window, 'localStorage', {
    configurable: true,
    value: {
      getItem: () => null,
      setItem: () => undefined,
      removeItem: () => undefined,
      clear: () => undefined,
    },
  })

  // Reproduce the iPhone 13 viewport from the bug report. The editor's mobile
  // breakpoint is `max-width: 1100px`, so this puts the controller on the
  // mobile side of the split for every test in this file.
  const testWindow = window as unknown as {
    happyDOM?: { setViewport?: (viewport: { width: number; height: number }) => void }
  }
  testWindow.happyDOM?.setViewport?.({ width: 390, height: 664 })
})

afterEach(() => {
  cleanupRender(lastRender)
  lastRender = null
  handles.length = 0
  window.history.pushState(null, '', '/')
})

describe('useEditorScreenController', () => {
  it('returns grouped layout, shell, and overlay models under the real providers', () => {
    lastRender = renderHarness()

    const root = lastRender.container.firstElementChild
    expect(root?.getAttribute('data-layout-mobile')).not.toBeNull()
    expect(root?.getAttribute('data-layout-theme')).toMatch(/light|dark/)
    expect(root?.getAttribute('data-has-mobile-shell')).toBe('true')
    expect(root?.getAttribute('data-has-desktop-shell')).toBe('true')
    expect(root?.getAttribute('data-has-overlay')).toBe('true')
  })
})

describe('useEditorScreenController mobile route sync', () => {
  it('opens a /workbench/3d deep link in the mobile 3D tab', () => {
    window.history.pushState(null, '', '/workbench/3d')
    lastRender = renderHarness()

    expect(readAttribute('data-layout-mobile')).toBe('true')
    expect(readAttribute('data-mobile-view-mode')).toBe('preview')
    // The 3D pane replaces the 2D canvas rather than rendering behind it.
    expect(readAttribute('data-hide-canvas-pane')).toBe('true')
    expect(window.location.pathname).toBe('/workbench/3d')
  })

  it('opens a /workbench/split deep link in the mobile Split tab', () => {
    window.history.pushState(null, '', '/workbench/split')
    lastRender = renderHarness()

    expect(readAttribute('data-mobile-view-mode')).toBe('split')
    expect(window.location.pathname).toBe('/workbench/split')
  })

  it('pushes the workbench path when the mobile 3D tab is selected and restores 2D on back', () => {
    lastRender = renderHarness()

    expect(readAttribute('data-layout-mobile')).toBe('true')
    expect(readAttribute('data-mobile-view-mode')).toBe('editor')
    expect(window.location.pathname).toBe('/')

    act(() => {
      handles.at(-1)!.setMobileViewMode('preview')
    })

    expect(readAttribute('data-mobile-view-mode')).toBe('preview')
    expect(window.location.pathname).toBe('/workbench/3d')

    act(() => {
      window.history.replaceState(null, '', '/')
      window.dispatchEvent(new PopStateEvent('popstate'))
    })

    expect(readAttribute('data-mobile-view-mode')).toBe('editor')
    expect(readAttribute('data-hide-canvas-pane')).toBe('false')
  })
})
