import { createElement } from 'react'
import { afterEach, beforeAll, describe, expect, it } from 'vitest'
import { cleanupRender, renderForTest } from '../../test/render'
import { EditorStateProviders } from './state/providers/EditorStateProviders'
import { useEditorScreenController } from './useEditorScreenController'

function Harness() {
  const controller = useEditorScreenController()

  return createElement('div', {
    'data-layout-mobile': String(controller.layout.isMobileLayout),
    'data-layout-theme': controller.layout.resolvedThemeMode,
    'data-has-mobile-shell': String(Boolean(controller.mobileShell.topbarProps)),
    'data-has-desktop-shell': String(Boolean(controller.desktopShell.workbenchProps)),
    'data-has-overlay': String(Boolean(controller.overlay.modalStackProps)),
  })
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
})

afterEach(() => {
  cleanupRender(lastRender)
  lastRender = null
})

describe('useEditorScreenController', () => {
  it('returns grouped layout, shell, and overlay models under the real providers', () => {
    lastRender = renderForTest(
      createElement(
        EditorStateProviders,
        null,
        createElement(Harness),
      ),
    )

    const root = lastRender.container.firstElementChild
    expect(root?.getAttribute('data-layout-mobile')).not.toBeNull()
    expect(root?.getAttribute('data-layout-theme')).toMatch(/light|dark/)
    expect(root?.getAttribute('data-has-mobile-shell')).toBe('true')
    expect(root?.getAttribute('data-has-desktop-shell')).toBe('true')
    expect(root?.getAttribute('data-has-overlay')).toBe('true')
  })
})
