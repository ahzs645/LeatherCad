import { createElement, useState } from 'react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { cleanupRender, click, renderForTest } from '../../../../test/render'
import { EditorHistoryStateProvider, useEditorHistoryActions, useEditorHistoryRefs, useEditorHistorySelector } from './EditorHistoryStateProvider'
import { EditorPanelStateProvider, useEditorPanelActions, useEditorPanelSelector } from './EditorPanelStateProvider'
import { EditorToolStateProvider, useEditorToolActions, useEditorToolSelector } from './EditorToolStateProvider'
import { EditorUIStateProvider, useEditorUISelector } from './EditorUIStateProvider'

describe('editor state providers', () => {
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
  })

  afterEach(() => {
    cleanupRender(lastRender)
    lastRender = null
    if (originalLocalStorageDescriptor) {
      Object.defineProperty(window, 'localStorage', originalLocalStorageDescriptor)
    }
    storage.clear()
  })

  it('updates tool state and mirrored UI status through tool actions', () => {
    function Harness() {
      const tool = useEditorToolSelector((state) => state.tool)
      const status = useEditorUISelector((state) => state.status)
      const { setActiveTool } = useEditorToolActions()

      return createElement(
        'div',
        null,
        createElement('span', { 'data-testid': 'tool' }, tool),
        createElement('span', { 'data-testid': 'status' }, status),
        createElement(
          'button',
          {
            type: 'button',
            onClick: () => setActiveTool('stitch-hole'),
          },
          'Activate Stitch Tool',
        ),
      )
    }

    lastRender = renderForTest(
      createElement(
        EditorUIStateProvider,
        null,
        createElement(EditorToolStateProvider, null, createElement(Harness)),
      ),
    )

    click(lastRender.container.querySelector('button'))

    expect(lastRender.container.querySelector('[data-testid="tool"]')?.textContent).toBe('stitch-hole')
    expect(lastRender.container.querySelector('[data-testid="status"]')?.textContent).toBe('Tool selected: Stitch Hole')
  })

  it('updates panel selectors through reducer-backed actions', () => {
    function Harness() {
      const scale = useEditorPanelSelector((state) => state.printScalePercent)
      const previewOpen = useEditorPanelSelector((state) => state.showPrintPreviewModal)
      const { setPrintScalePercent, setShowPrintPreviewModal } = useEditorPanelActions()

      return createElement(
        'div',
        null,
        createElement('span', { 'data-testid': 'scale' }, String(scale)),
        createElement('span', { 'data-testid': 'preview' }, previewOpen ? 'open' : 'closed'),
        createElement(
          'button',
          {
            type: 'button',
            onClick: () => {
              setPrintScalePercent(85)
              setShowPrintPreviewModal(true)
            },
          },
          'Update Print Controls',
        ),
      )
    }

    lastRender = renderForTest(
      createElement(EditorPanelStateProvider, null, createElement(Harness)),
    )

    click(lastRender.container.querySelector('button'))

    expect(lastRender.container.querySelector('[data-testid="scale"]')?.textContent).toBe('85')
    expect(lastRender.container.querySelector('[data-testid="preview"]')?.textContent).toBe('open')
  })

  it('updates history state and exposes mutable refs', () => {
    function Harness() {
      const pastCount = useEditorHistorySelector((state) => state.historyState.past.length)
      const opCount = useEditorHistorySelector((state) => state.opHistory.past.length)
      const { setHistoryState } = useEditorHistoryActions()
      const { applyingHistoryRef, lastSnapshotSignatureRef } = useEditorHistoryRefs()
      const [refSnapshot, setRefSnapshot] = useState({ applying: 'no', signature: 'none' })

      return createElement(
        'div',
        null,
        createElement('span', { 'data-testid': 'past' }, String(pastCount)),
        createElement('span', { 'data-testid': 'ops' }, String(opCount)),
        createElement('span', { 'data-testid': 'applying' }, refSnapshot.applying),
        createElement('span', { 'data-testid': 'signature' }, refSnapshot.signature),
        createElement(
          'button',
          {
            type: 'button',
            onClick: () => {
              applyingHistoryRef.current = true
              lastSnapshotSignatureRef.current = 'snapshot-1'
              setRefSnapshot({ applying: 'yes', signature: 'snapshot-1' })
              setHistoryState((previous) => ({
                ...previous,
                past: [...previous.past, {} as never],
              }))
            },
          },
          'Update History',
        ),
      )
    }

    lastRender = renderForTest(
      createElement(EditorHistoryStateProvider, null, createElement(Harness)),
    )

    click(lastRender.container.querySelector('button'))

    expect(lastRender.container.querySelector('[data-testid="past"]')?.textContent).toBe('1')
    expect(lastRender.container.querySelector('[data-testid="ops"]')?.textContent).toBe('0')
    expect(lastRender.container.querySelector('[data-testid="applying"]')?.textContent).toBe('yes')
    expect(lastRender.container.querySelector('[data-testid="signature"]')?.textContent).toBe('snapshot-1')
  })
})
