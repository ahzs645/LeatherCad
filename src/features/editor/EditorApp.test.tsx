import { createElement } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanupRender, renderForTest } from '../../test/render'
import { EditorApp } from './EditorApp'

const mocks = vi.hoisted(() => ({
  useEditorScreenController: vi.fn(),
}))

vi.mock('./useEditorScreenController', () => ({
  useEditorScreenController: mocks.useEditorScreenController,
}))

vi.mock('./components/EditorMobileShell', () => ({
  EditorMobileShell: () => createElement('div', { 'data-mobile-shell': true }, 'mobile'),
}))

vi.mock('./components/EditorDesktopShell', () => ({
  EditorDesktopShell: () => createElement('div', { 'data-desktop-shell': true }, 'desktop'),
}))

vi.mock('./components/EditorOverlayHost', () => ({
  EditorOverlayHost: () => createElement('div', { 'data-overlay-host': true }, 'overlay'),
}))

let lastRender: ReturnType<typeof renderForTest> | null = null

afterEach(() => {
  cleanupRender(lastRender)
  lastRender = null
  mocks.useEditorScreenController.mockReset()
})

describe('EditorApp', () => {
  it('renders the mobile shell when the controller reports a mobile layout', () => {
    mocks.useEditorScreenController.mockReturnValue({
      layout: {
        isMobileLayout: true,
        resolvedThemeMode: 'light',
        shouldLoadThreeWorkbench: false,
      },
      mobileShell: {} as never,
      desktopShell: {} as never,
      overlay: {} as never,
      webMcp: { supported: false, registered: false, toolNames: [], error: null },
    })

    lastRender = renderForTest(createElement(EditorApp))

    expect(lastRender.container.querySelector('[data-mobile-shell]')).not.toBeNull()
    expect(lastRender.container.querySelector('[data-desktop-shell]')).toBeNull()
    expect(lastRender.container.querySelector('[data-overlay-host]')).not.toBeNull()
    expect(lastRender.container.querySelector('.webmcp-panel')).not.toBeNull()
  })

  it('renders the desktop shell when the controller reports a desktop layout', () => {
    mocks.useEditorScreenController.mockReturnValue({
      layout: {
        isMobileLayout: false,
        resolvedThemeMode: 'dark',
        shouldLoadThreeWorkbench: true,
      },
      mobileShell: {} as never,
      desktopShell: {} as never,
      overlay: {} as never,
      webMcp: { supported: false, registered: false, toolNames: [], error: null },
    })

    lastRender = renderForTest(createElement(EditorApp))

    expect(lastRender.container.querySelector('[data-mobile-shell]')).toBeNull()
    expect(lastRender.container.querySelector('[data-desktop-shell]')).not.toBeNull()
    expect(lastRender.container.querySelector('[data-overlay-host]')).not.toBeNull()
  })
})
