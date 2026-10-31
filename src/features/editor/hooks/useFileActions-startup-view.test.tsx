import { act, createElement, useState } from 'react'
import { afterEach, expect, it, vi } from 'vitest'
import { cleanupRender, renderForTest } from '../../../test/render'
import type { DocFile } from '../cad/cad-types'
import type { MobileViewMode } from '../editor-types'
import { useMobileWorkbenchRouteSync } from '../workbench/useWorkbenchRouteSync'
import { useFileActions } from './useFileActions'

const deferredSample = vi.hoisted(() => {
  let release!: () => void
  const ready = new Promise<void>(resolve => { release = resolve })
  return { ready, release }
})
vi.mock('../data/sample-doc', async () => {
  await deferredSample.ready
  return { DEFAULT_PRESET_ID: 'sample', PRESET_DOCS: [{ id: 'sample', label: 'Sample', doc: { version: 1, units: 'mm', layers: [], lineTypes: [], activeLayerId: '', activeLineTypeId: '', objects: [], foldLines: [] } }] }
})
vi.mock('../localdb/editor-local-data-client', () => ({ withEditorLocalDataClient: vi.fn(async () => null) }))

let rendered: ReturnType<typeof renderForTest> | null = null
afterEach(() => { cleanupRender(rendered); rendered = null; window.history.replaceState(null, '', '/') })

it('keeps 3D and Split deep links when startup sample data resolves, while manual presets retain their view reset', async () => {
  for (const [path, expectedMode] of [['/workbench/3d', 'preview'], ['/workbench/split', 'split']] as const) {
    window.history.replaceState(null, '', path)
    const current: DocFile = { version: 1, units: 'mm', layers: [{ id: 'L', name: 'Layer', visible: true, locked: false }], lineTypes: [], activeLayerId: 'L', activeLineTypeId: '', objects: [], foldLines: [] }
    const applyLoadedDocument = vi.fn(), noop = () => undefined
    let actions!: ReturnType<typeof useFileActions>
    function Harness() {
      const [mobileViewMode, setMobileViewMode] = useState<MobileViewMode>('editor')
      const [showMobileMenu, setShowMobileMenu] = useState(true)
      const [showThreePreview, setShowThreePreview] = useState(true)
      useMobileWorkbenchRouteSync({ enabled: true, mobileViewMode, setMobileViewMode })
      actions = useFileActions({ documentSessionKey: 1, buildCurrentDocFile: () => current, applyLoadedDocument, activeLocalDocumentId: null, setActiveLocalDocumentId: noop, selectedPresetId: '', setSelectedPresetId: noop, isMobileLayout: true, activeLayer: current.layers[0], activeLineTypeId: '', activeSketchGroup: null, setShapes: noop, setSketchGroups: noop, setActiveSketchGroupId: noop, setSelectedShapeIds: noop, setStatus: noop, setShowThreePreview, setMobileViewMode, setShowMobileMenu })
      return createElement('output', null, JSON.stringify({ mobileViewMode, showMobileMenu, showThreePreview }))
    }
    rendered = renderForTest(createElement(Harness))
    let pending!: Promise<void>
    await act(async () => { pending = actions.handleLoadPreset(undefined, () => true); await Promise.resolve() })
    expect(window.location.pathname).toBe(path)
    await act(async () => { deferredSample.release(); await pending })
    expect(applyLoadedDocument).toHaveBeenCalledOnce()
    expect(JSON.parse(rendered.container.querySelector('output')!.textContent)).toEqual({ mobileViewMode: expectedMode, showMobileMenu: true, showThreePreview: true })
    expect(window.location.pathname).toBe(path)
    await act(async () => { await actions.handleLoadPreset() })
    expect(JSON.parse(rendered.container.querySelector('output')!.textContent)).toEqual({ mobileViewMode: 'editor', showMobileMenu: false, showThreePreview: true })
    expect(window.location.pathname).toBe('/')
    cleanupRender(rendered); rendered = null
  }
})
