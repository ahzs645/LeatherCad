import { createElement, useEffect } from 'react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { cleanupRender, click, renderForTest } from '../../../test/render'
import { clampDockLayoutState, useWorkbenchShellState } from './useWorkbenchShellState'

const STORAGE_KEY = 'leathercad.workbench.layout.v1'

describe('clampDockLayoutState', () => {
  it('shrinks dock widths to preserve the minimum main workspace', () => {
    expect(
      clampDockLayoutState(
        {
          browserWidth: 360,
          inspectorWidth: 420,
          peekWidth: 420,
          activeInspectorTab: 'inspect',
        },
        1200,
        true,
      ),
    ).toEqual({
      browserWidth: 220,
      inspectorWidth: 300,
      peekWidth: 300,
      activeInspectorTab: 'inspect',
    })
  })
})

describe('useWorkbenchShellState', () => {
  const OriginalResizeObserver = globalThis.ResizeObserver
  const originalLocalStorageDescriptor = Object.getOwnPropertyDescriptor(window, 'localStorage')
  const storage = new Map<string, string>()
  let lastRender: ReturnType<typeof renderForTest> | null = null

  beforeEach(() => {
    storage.clear()
    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      value: {
        getItem: (key: string) => storage.get(key) ?? null,
        setItem: (key: string, value: string) => {
          storage.set(key, value)
        },
        removeItem: (key: string) => {
          storage.delete(key)
        },
        clear: () => {
          storage.clear()
        },
      },
    })
    globalThis.ResizeObserver = class ResizeObserver {
      constructor(private readonly callback: ResizeObserverCallback) {}

      observe(target: Element) {
        this.callback(
          [
            {
              target,
              contentRect: {
                width: 1600,
                height: 900,
                x: 0,
                y: 0,
                top: 0,
                left: 0,
                right: 1600,
                bottom: 900,
                toJSON() {
                  return {}
                },
              },
            } as ResizeObserverEntry,
          ],
          this as unknown as ResizeObserver,
        )
      }

      unobserve() {}

      disconnect() {}
    } as unknown as typeof ResizeObserver
  })

  afterEach(() => {
    cleanupRender(lastRender)
    lastRender = null
    globalThis.ResizeObserver = OriginalResizeObserver
    if (originalLocalStorageDescriptor) {
      Object.defineProperty(window, 'localStorage', originalLocalStorageDescriptor)
    }
    storage.clear()
  })

  it('persists the active inspector tab and clamped dock layout', () => {
    function Harness() {
      const shell = useWorkbenchShellState({
        enabled: true,
        secondaryPreviewMode: '3d-peek',
      })

      useEffect(() => {
        shell.setActiveInspectorTab('piece')
      }, [])

      return createElement('main', { ref: shell.shellRef, 'data-testid': 'shell-harness' })
    }

    lastRender = renderForTest(createElement(Harness))

    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}')
    expect(stored.activeInspectorTab).toBe('piece')
    expect(stored.browserWidth).toBe(260)
    expect(stored.inspectorWidth).toBe(340)
    expect(stored.peekWidth).toBe(360)
  })

  it('exposes an imperative setter for inspector tabs', () => {
    function Harness() {
      const shell = useWorkbenchShellState({
        enabled: true,
        secondaryPreviewMode: '3d-peek',
      })

      return createElement(
        'div',
        null,
        createElement('main', { ref: shell.shellRef }),
        createElement(
          'button',
          {
            type: 'button',
            onClick: () => shell.setActiveInspectorTab('document'),
          },
          'Activate Document Tab',
        ),
      )
    }

    lastRender = renderForTest(createElement(Harness))
    click(lastRender.container.querySelector('button'))

    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}')
    expect(stored.activeInspectorTab).toBe('document')
  })
})
