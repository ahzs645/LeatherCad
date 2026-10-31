import { act, createElement, type ChangeEvent } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanupRender, renderForTest } from '../../../test/render'
import type { DocFile } from '../cad/cad-types'
import { useFileActions } from './useFileActions'

let rendered: ReturnType<typeof renderForTest> | null = null
afterEach(() => { cleanupRender(rendered); rendered = null })

describe('file imports preserve the current document on errors', () => {
  it('does not apply compatibility artwork from sealed LCC or a partially supported LCAD drawing', async () => {
    const applyLoadedDocument = vi.fn()
    const setStatus = vi.fn()
    const noop = () => undefined
    let actions!: ReturnType<typeof useFileActions>
    const current: DocFile = { version: 1, units: 'mm', documentName: 'Existing wallet', layers: [{ id: 'layer', name: 'Wallet', visible: true, locked: false }], activeLayerId: 'layer', lineTypes: [{ id: 'cut', name: 'Cut', role: 'cut', color: '#000000', style: 'solid', visible: true }], activeLineTypeId: 'cut', objects: [{ id: 'existing', type: 'line', layerId: 'layer', lineTypeId: 'cut', start: { x: 0, y: 0 }, end: { x: 20, y: 0 } }], foldLines: [] }
    function Harness() {
      actions = useFileActions({ buildCurrentDocFile: () => current, applyLoadedDocument, activeLocalDocumentId: null, setActiveLocalDocumentId: noop, selectedPresetId: '', setSelectedPresetId: noop, isMobileLayout: false, activeLayer: current.layers[0], activeLineTypeId: 'cut', activeSketchGroup: null, setShapes: noop, setSketchGroups: noop, setActiveSketchGroupId: noop, setSelectedShapeIds: noop, setStatus, setShowThreePreview: noop, setMobileViewMode: noop, setShowMobileMenu: noop })
      return createElement('div')
    }
    rendered = renderForTest(createElement(Harness))
    const load = async (name: string, text: string) => {
      const target = { files: [{ name, type: 'application/json', text: async () => text }], value: name }
      await act(async () => actions.handleLoadJson({ target } as unknown as ChangeEvent<HTMLInputElement>))
      expect(target.value).toBe('')
    }
    await load('reference.lcc', JSON.stringify({ meta: { file_type: 'LeathercraftCAD_Sealed' }, sealed: { data: 'AA==' }, shapes: [{ type: 'TEXT', tx: 'Requires a newer reader' }] }))
    expect(setStatus).toHaveBeenLastCalledWith(expect.stringContaining('Sealed LCC files'))
    await load('reference.lcad', JSON.stringify({ version: 2, shapes: [{ type: 'line', x1: 0, y1: 0, x2: 10, y2: 0 }, { type: 'unsupported-lazy-geometry' }] }))
    expect(setStatus).toHaveBeenLastCalledWith(expect.stringContaining('Unsupported .lcad shape type'))
    expect(applyLoadedDocument).not.toHaveBeenCalled()
    expect(current.objects[0].id).toBe('existing')
  })
})
