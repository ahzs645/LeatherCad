import { act, createElement, useState, type ChangeEvent } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanupRender, renderForTest } from '../../../test/render'
import type { DocFile } from '../cad/cad-types'
import { useFileActions } from './useFileActions'

let rendered: ReturnType<typeof renderForTest> | null = null
afterEach(() => { cleanupRender(rendered); rendered = null })

function renderImportActions(documentSessionKey?: number) {
  const current: DocFile = { version: 1, units: 'mm', layers: [{ id: 'layer', name: 'Wallet', visible: true, locked: false }], activeLayerId: 'layer', lineTypes: [{ id: 'cut', name: 'Cut', role: 'cut', color: '#000000', style: 'solid', visible: true }], activeLineTypeId: 'cut', objects: [], foldLines: [] }
  const applyLoadedDocument = vi.fn(), setStatus = vi.fn(), noop = () => undefined
  let actions!: ReturnType<typeof useFileActions>
  function Harness({ doc, localId = null, session }: { doc: DocFile; localId?: string | null; session?: number }) {
    actions = useFileActions({ documentSessionKey: session, buildCurrentDocFile: () => doc, applyLoadedDocument, activeLocalDocumentId: localId, setActiveLocalDocumentId: noop, selectedPresetId: '', setSelectedPresetId: noop, isMobileLayout: false, activeLayer: doc.layers[0], activeLineTypeId: 'cut', activeSketchGroup: null, setShapes: noop, setSketchGroups: noop, setActiveSketchGroupId: noop, setSelectedShapeIds: noop, setStatus, setShowThreePreview: noop, setMobileViewMode: noop, setShowMobileMenu: noop })
    return createElement('div')
  }
  rendered = renderForTest(createElement(Harness, { doc: current, session: documentSessionKey }))
  return { current, applyLoadedDocument, setStatus, actions: () => actions, advance: () => rendered?.rerender(createElement(Harness, { doc: { ...current, objects: [] }, session: (documentSessionKey ?? 0) + 1 })), associate: () => rendered?.rerender(createElement(Harness, { doc: current, localId: 'startup-saved', session: documentSessionKey })), replace: () => rendered?.rerender(createElement(Harness, { doc: { ...current, objects: [] }, session: documentSessionKey })) }
}
const importEvent = (text: () => Promise<string>, size = 100) => ({ target: { value: 'drawing.lcad', files: [{ name: 'drawing.lcad', size, type: 'application/json', text }] } } as unknown as ChangeEvent<HTMLInputElement>)
const validLcad = JSON.stringify({ version: 2, shapes: [{ type: 'line', x1: 0, y1: 0, x2: 10, y2: 0, alpha: 0.5 }] })

describe('file imports preserve the current document on errors', () => {
  it('stages warnings and geometry before replacing a drawing, and cancel changes nothing', async () => {
    const hook = renderImportActions()
    await act(async () => hook.actions().handleLoadJson(importEvent(async () => validLcad)))
    expect(hook.applyLoadedDocument).not.toHaveBeenCalled()
    const review = hook.actions().svgImportOptionsModalProps.transferReview!
    expect(review.shapes).toHaveLength(1)
    expect(review.shapes[0].opacity).toBe(0.5)
    act(() => review.onClose())
    expect(hook.applyLoadedDocument).not.toHaveBeenCalled()
    expect(hook.actions().svgImportOptionsModalProps.open).toBe(false)
    await act(async () => hook.actions().handleLoadJson(importEvent(async () => validLcad)))
    const apply = hook.actions().svgImportOptionsModalProps.transferReview!.onApply
    act(() => { apply(); apply() })
    expect(hook.applyLoadedDocument).toHaveBeenCalledTimes(1)
  })

  it('discards a slow file result and staged confirmation after the current document changes', async () => {
    const hook = renderImportActions()
    let resolve!: (raw: string) => void
    const read = new Promise<string>(complete => { resolve = complete })
    let pending!: Promise<void>
    act(() => { pending = hook.actions().handleLoadJson(importEvent(() => read)) })
    hook.replace()
    await act(async () => { resolve(validLcad); await pending })
    expect(hook.applyLoadedDocument).not.toHaveBeenCalled()
    expect(hook.actions().svgImportOptionsModalProps.open).toBe(false)
    await act(async () => hook.actions().handleLoadJson(importEvent(async () => validLcad)))
    const staleApply = hook.actions().svgImportOptionsModalProps.transferReview!.onApply
    hook.replace()
    act(() => staleApply())
    expect(hook.applyLoadedDocument).not.toHaveBeenCalled()
  })

  it('rejects oversized files before starting their read', async () => {
    const hook = renderImportActions(), read = vi.fn(async () => validLcad)
    await act(async () => hook.actions().handleLoadJson(importEvent(read, 51 * 1024 * 1024)))
    expect(read).not.toHaveBeenCalled()
    expect(hook.setStatus).toHaveBeenLastCalledWith(expect.stringContaining('50 MB'))
  })

  it('does not discard a pending file when a startup database save only assigns a local ID', async () => {
    const hook = renderImportActions()
    let resolve!: (raw: string) => void
    const read = new Promise<string>(complete => { resolve = complete })
    let pending!: Promise<void>
    act(() => { pending = hook.actions().handleLoadJson(importEvent(() => read)) })
    hook.associate()
    await act(async () => { resolve(validLcad); await pending })
    expect(hook.actions().svgImportOptionsModalProps.transferReview?.shapes).toHaveLength(1)
    expect(hook.applyLoadedDocument).not.toHaveBeenCalled()
  })

  it('gives an explicit file read priority over a later automatic demo effect', async () => {
    const hook = renderImportActions()
    let resolve!: (raw: string) => void
    const read = new Promise<string>(complete => { resolve = complete })
    let pending!: Promise<void>
    act(() => { pending = hook.actions().handleLoadJson(importEvent(() => read)) })
    await act(async () => { await hook.actions().handleLoadPreset(undefined, () => true) })
    await act(async () => { resolve(validLcad); await pending })
    expect(hook.actions().svgImportOptionsModalProps.transferReview?.shapes).toHaveLength(1)
    expect(hook.applyLoadedDocument).not.toHaveBeenCalled()
  })

  it('uses the document epoch to preserve same-project edits and cancel a genuine replacement', async () => {
    const hook = renderImportActions(7)
    let resolve!: (raw: string) => void
    const read = new Promise<string>(complete => { resolve = complete })
    let pending!: Promise<void>
    act(() => { pending = hook.actions().handleLoadJson(importEvent(() => read)) })
    hook.replace() // New immutable artwork array in the same document session.
    await act(async () => { resolve(validLcad); await pending })
    const staleApply = hook.actions().svgImportOptionsModalProps.transferReview!.onApply
    expect(staleApply).toBeTypeOf('function')
    hook.advance()
    act(() => staleApply())
    expect(hook.applyLoadedDocument).not.toHaveBeenCalled()
    expect(hook.actions().svgImportOptionsModalProps.open).toBe(false)
  })

  it('commits a resolved preset and its document epoch before another file intent can begin', async () => {
    const base = renderImportActions().current
    cleanupRender(rendered); rendered = null
    let observedEpoch = -1, actions!: ReturnType<typeof useFileActions>
    const noop = () => undefined
    function Harness() {
      const [doc, setDoc] = useState(base), [epoch, setEpoch] = useState(0)
      observedEpoch = epoch
      actions = useFileActions({ documentSessionKey: epoch, buildCurrentDocFile: () => doc, applyLoadedDocument: next => { setDoc(next); setEpoch(value => value + 1) }, activeLocalDocumentId: null, setActiveLocalDocumentId: noop, selectedPresetId: '', setSelectedPresetId: noop, isMobileLayout: false, activeLayer: doc.layers[0], activeLineTypeId: 'cut', activeSketchGroup: null, setShapes: noop, setSketchGroups: noop, setActiveSketchGroupId: noop, setSelectedShapeIds: noop, setStatus: noop, setShowThreePreview: noop, setMobileViewMode: noop, setShowMobileMenu: noop })
      return createElement('div')
    }
    rendered = renderForTest(createElement(Harness))
    await act(async () => {
      await actions.handleLoadPreset()
      // An async preset dispatch cannot remain queued behind a newer file event.
      expect(observedEpoch).toBe(1)
      await actions.handleLoadJson(importEvent(async () => validLcad))
    })
    expect(actions.svgImportOptionsModalProps.transferReview?.shapes).toHaveLength(1)
  })
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
