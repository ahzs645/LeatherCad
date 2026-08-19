import { act, createElement } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanupRender, renderForTest } from '../../../test/render'
import { useResponsiveLayout } from './useResponsiveLayout'

type MediaListener = () => void

let lastRender: ReturnType<typeof renderForTest> | null = null

/**
 * Minimal matchMedia stub so a test can flip the match state and fire the
 * `change` event a real browser fires when the viewport crosses the breakpoint.
 */
function stubMatchMedia(initialMatches: boolean) {
  const listeners = new Set<MediaListener>()
  const media = {
    matches: initialMatches,
    addEventListener: (_type: string, listener: MediaListener) => listeners.add(listener),
    removeEventListener: (_type: string, listener: MediaListener) => listeners.delete(listener),
  }
  vi.stubGlobal('matchMedia', () => media)
  return {
    setMatches(next: boolean) {
      media.matches = next
      act(() => {
        listeners.forEach((listener) => listener())
      })
    },
  }
}

function renderResponsiveLayout() {
  const setMobileViewMode = vi.fn()
  function Harness() {
    useResponsiveLayout({
      setIsMobileLayout: vi.fn(),
      setMobileViewMode,
      setShowMobileMenu: vi.fn(),
      setMobileOptionsTab: vi.fn(),
      setTool: vi.fn(),
    })
    return null
  }
  lastRender = renderForTest(createElement(Harness))
  return setMobileViewMode
}

describe('useResponsiveLayout', () => {
  afterEach(() => {
    cleanupRender(lastRender)
    lastRender = null
    vi.unstubAllGlobals()
    window.history.replaceState(null, '', '/')
  })

  it('adopts the mode named by the URL when entering the mobile layout', () => {
    window.history.replaceState(null, '', '/workbench/3d')
    stubMatchMedia(true)

    expect(renderResponsiveLayout()).toHaveBeenCalledWith('preview')
  })

  it('adopts the split mode from a /workbench/split deep link', () => {
    window.history.replaceState(null, '', '/workbench/split')
    stubMatchMedia(true)

    expect(renderResponsiveLayout()).toHaveBeenCalledWith('split')
  })

  it('falls back to the editor pane when the URL names no 3D route', () => {
    window.history.replaceState(null, '', '/')
    stubMatchMedia(true)

    expect(renderResponsiveLayout()).toHaveBeenCalledWith('editor')
  })

  // Regression: this hook used to force 'editor' on every matchMedia change. That
  // event lands after the route sync has applied the deep link, so the flip back to
  // 'editor' made the route sync push "/" and the deep link was silently lost.
  it('does not clobber a 3D deep link when a later change event fires', () => {
    window.history.replaceState(null, '', '/workbench/3d')
    const media = stubMatchMedia(true)
    const setMobileViewMode = renderResponsiveLayout()

    setMobileViewMode.mockClear()
    media.setMatches(true)

    expect(setMobileViewMode).toHaveBeenCalledWith('preview')
    expect(setMobileViewMode).not.toHaveBeenCalledWith('editor')
  })

  it('still restores the split pane when leaving the mobile layout', () => {
    window.history.replaceState(null, '', '/workbench/3d')
    const media = stubMatchMedia(true)
    const setMobileViewMode = renderResponsiveLayout()

    setMobileViewMode.mockClear()
    media.setMatches(false)

    expect(setMobileViewMode).toHaveBeenCalledWith('split')
  })
})
