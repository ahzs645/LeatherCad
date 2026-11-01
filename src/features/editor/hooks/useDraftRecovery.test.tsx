import { act, createElement, useState } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanupRender, renderForTest } from '../../../test/render'
import { parseImportedJsonDocument } from '../editor-json-import'
import { configureEditorCloudAuth, signInToEditorCloud } from '../localdb/editor-cloud-connection'
import { createDraftSnapshot, DRAFT_KEYS, persistDraftSnapshot, readRecoveryDrafts } from '../ops/draft-recovery'
import { useDraftRecovery } from './useDraftRecovery'
import { useAutoSave } from './useAutoSave'
import type { DocFile } from '../cad/cad-types'

const stores = vi.hoisted(() => ({ values: new Map<string, string>(), set: vi.fn(), get: vi.fn() }))
vi.mock('../localdb/editor-local-data-client', () => ({ getEditorLocalDataClient: () => ({
  settings: { set: stores.set, get: stores.get }, documents: { getAutoSaveSnapshot: async () => null, clearAutoSaveSnapshot: async () => undefined },
}) }))
const doc = (name: string) => parseImportedJsonDocument(JSON.stringify({ documentName: name, objects: [], layers: [{ id: 'main', name: 'Main', visible: true, locked: false }] })).doc
let rendered: ReturnType<typeof renderForTest> | null = null
let unregister: (() => void) | undefined
beforeEach(() => {
  const memory = new Map<string, string>()
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => memory.get(key) ?? null,
    setItem: (key: string, value: string) => { memory.set(key, value) },
    removeItem: (key: string) => { memory.delete(key) },
    clear: () => memory.clear(),
  })
  localStorage.clear(); stores.values.clear(); window.history.replaceState(null, '', '/')
  stores.set.mockReset().mockImplementation(async (key: string, value: string) => { stores.values.set(key, value) })
  stores.get.mockReset().mockImplementation(async (key: string) => stores.values.get(key) ?? null)
})
afterEach(() => { cleanupRender(rendered); rendered = null; unregister?.(); unregister = undefined; vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.useRealTimers() })

function mount(initialName = 'Current', autoSave = false) {
  let recovery!: ReturnType<typeof useDraftRecovery>
  const apply = vi.fn<(doc: DocFile, status: string) => void>(), active = vi.fn(), status = vi.fn()
  function Harness({ name }: { name: string }) {
    recovery = useDraftRecovery({ buildDoc: () => doc(name), applyLoadedDocument: apply,
      activeLocalDocumentId: 'named-project', setActiveLocalDocumentId: active, setStatus: status })
    useAutoSave({ enabled: autoSave && recovery.ready, intervalMs: 50, buildDoc: () => doc(name), setStatus: status, onFailure: recovery.onAutoSaveFailure })
    return createElement('output', { 'data-ready': recovery.ready }, recovery.props.error)
  }
  rendered = renderForTest(createElement(Harness, { name: initialName }))
  return { recovery: () => recovery, apply, active, status, rerender: (name: string) => rendered?.rerender(createElement(Harness, { name })) }
}

describe('startup draft recovery and sign-in navigation', () => {
  it('pauses automatic saving until the previous draft is explicitly recovered or discarded', async () => {
    const previous = createDraftSnapshot(JSON.stringify(doc('Previous draft')), 'autosave')
    await persistDraftSnapshot(previous)
    const view = mount('Current', true)
    await act(async () => { await Promise.resolve(); await Promise.resolve() })
    await vi.waitFor(() => expect(view.recovery().props.draft?.snapshot?.id).toBe(previous.id))
    await act(async () => { await new Promise(resolve => setTimeout(resolve, 90)) })
    expect(view.recovery().ready).toBe(false)
    expect((await readRecoveryDrafts())[0].snapshot?.id).toBe(previous.id)
    expect(view.status).not.toHaveBeenCalledWith(expect.stringContaining('Auto-saved'))
    await act(async () => { await view.recovery().props.onRecover() })
    expect(view.apply.mock.calls[0][0].documentName).toBe('Previous draft')
    expect(view.recovery().ready).toBe(true)
  })
  it('keeps damaged drafts available and does not mutate the open drawing', async () => {
    localStorage.setItem(DRAFT_KEYS.autosave, 'damaged recovery bytes')
    const view = mount()
    await vi.waitFor(() => expect(view.recovery().props.draft?.raw).toBe('damaged recovery bytes'))
    await act(async () => { await view.recovery().props.onRecover() })
    expect(view.apply).not.toHaveBeenCalled()
    expect(view.recovery().props.error).toContain('damaged')
    expect(localStorage.getItem(DRAFT_KEYS.autosave)).toBe('damaged recovery bytes')
    await act(async () => { await view.recovery().props.onDiscard() })
    expect(view.recovery().ready).toBe(true)
    expect(await readRecoveryDrafts()).toEqual([])
  })
  it('preserves the latest edits with autosave disabled and restores after a provider failure/reload', async () => {
    const view = mount('Initial')
    await vi.waitFor(() => expect(view.recovery().ready).toBe(true))
    view.rerender('Edited less than a minute ago')
    const navigate = vi.fn().mockRejectedValue(new Error('Provider cancelled'))
    unregister = configureEditorCloudAuth({ getUser: () => null, getToken: async () => null, signIn: navigate, signOut: async () => undefined })
    await act(async () => { await expect(signInToEditorCloud()).rejects.toThrow('Provider cancelled') })
    const saved = (await readRecoveryDrafts())[0].snapshot!
    expect((JSON.parse(saved.serializedDoc) as { documentName: string }).documentName).toBe('Edited less than a minute ago')
    expect(saved.localDocumentId).toBe('named-project')
    cleanupRender(rendered); rendered = null
    const reopened = mount('Default sample')
    await vi.waitFor(() => expect(reopened.apply).toHaveBeenCalledOnce())
    expect(reopened.apply.mock.calls[0][0].documentName).toBe('Edited less than a minute ago')
    expect(reopened.active).toHaveBeenCalledWith('named-project')
    await vi.waitFor(() => expect(reopened.recovery().ready).toBe(true))
    expect((await readRecoveryDrafts()).every(item => item.snapshot?.reason !== 'signin')).toBe(true)
    expect((await readRecoveryDrafts())[0].snapshot?.reason).toBe('autosave')
  })
  it('does not redirect when storage cannot preserve the latest draft', async () => {
    const view = mount(); await vi.waitFor(() => expect(view.recovery().ready).toBe(true))
    const navigate = vi.fn()
    unregister = configureEditorCloudAuth({ getUser: () => null, getToken: async () => null, signIn: navigate, signOut: async () => undefined })
    vi.spyOn(localStorage, 'setItem').mockImplementation(() => { throw new DOMException('full', 'QuotaExceededError') })
    stores.set.mockRejectedValue(new Error('Database blocked'))
    await expect(signInToEditorCloud()).rejects.toThrow('Download your drawing')
    expect(navigate).not.toHaveBeenCalled()
    expect(view.apply).not.toHaveBeenCalled()
  })
  it('preserves explicit project-opening precedence over sign-in recovery', async () => {
    await persistDraftSnapshot(createDraftSnapshot(JSON.stringify(doc('Before sign-in')), 'signin'))
    window.history.replaceState(null, '', '/?openLocalDoc=explicit-project')
    const view = mount('Explicit project')
    await vi.waitFor(() => expect(view.recovery().props.loading).toBe(false))
    expect(view.apply).not.toHaveBeenCalled()
    expect(view.recovery().props.explicitTransfer).toBe(true)
    expect(view.recovery().ready).toBe(false)
    await act(async () => { await view.recovery().props.onRecover() })
    expect(view.apply).not.toHaveBeenCalled()
    expect(view.recovery().props.error).toContain('finish loading')
  })
  it('never announces success before acknowledgment and exposes failed autosave backup action', async () => {
    const view = mount('Unsaved', true)
    await vi.waitFor(() => expect(view.recovery().ready).toBe(true))
    vi.spyOn(localStorage, 'setItem').mockImplementation(() => { throw new DOMException('full', 'QuotaExceededError') })
    let rejectWrite!: (error: Error) => void
    stores.set.mockImplementationOnce(() => new Promise<void>((_resolve, reject) => { rejectWrite = reject }))
    await vi.waitFor(() => expect(rejectWrite).toBeTypeOf('function'))
    expect(view.status).not.toHaveBeenCalledWith(expect.stringContaining('Auto-saved'))
    await act(async () => { rejectWrite(new Error('Write failed')); await Promise.resolve() })
    await vi.waitFor(() => expect(view.recovery().props.failure).toContain('Download a backup'))
    expect(view.status).toHaveBeenCalledWith(expect.stringContaining('Auto-save failed'))
  })
  it('preserves short-session edits synchronously on page exit when autosave is enabled', async () => {
    const view = mount('Started', true)
    await vi.waitFor(() => expect(view.recovery().ready).toBe(true))
    view.rerender('Edited immediately before exit')
    window.dispatchEvent(new Event('pagehide'))
    const raw = localStorage.getItem(DRAFT_KEYS.autosave)!
    const saved = JSON.parse(raw) as { serializedDoc: string }
    expect((JSON.parse(saved.serializedDoc) as { documentName: string }).documentName).toBe('Edited immediately before exit')
  })
  it('does not overwrite a drawing opened while recovery storage was still loading', async () => {
    const saved = createDraftSnapshot(JSON.stringify(doc('Before sign-in')), 'signin')
    stores.values.set(DRAFT_KEYS.signin, JSON.stringify(saved))
    let finish!: (raw: string | null) => void
    stores.get.mockImplementationOnce(() => new Promise<string | null>(resolve => { finish = resolve }))
    const view = mount('Initial empty editor')
    await vi.waitFor(() => expect(finish).toBeTypeOf('function'))
    view.rerender('Late explicitly opened file')
    await act(async () => { finish(JSON.stringify(saved)); await Promise.resolve() })
    await vi.waitFor(() => expect(view.recovery().props.loading).toBe(false))
    expect(view.apply).not.toHaveBeenCalled()
    expect(view.recovery().props.error).toContain('drawing changed')
    expect(view.recovery().ready).toBe(false)
  })
  it('keeps editing available but pauses saves/sign-in when stored drafts cannot be checked, then retries', async () => {
    stores.get.mockRejectedValue(new Error('Database temporarily unavailable'))
    const view = mount('Current unsaved work', true)
    await vi.waitFor(() => expect(view.recovery().props.loading).toBe(false))
    expect(view.recovery().props.draft).toBeUndefined()
    expect(view.recovery().ready).toBe(false)
    expect(view.recovery().props.failure).toContain('Automatic saving and sign-in are paused')
    expect(view.recovery().props.canDismissFailure).toBe(false)
    expect(stores.set).not.toHaveBeenCalled()
    const navigate = vi.fn()
    unregister = configureEditorCloudAuth({ getUser: () => null, getToken: async () => null, signIn: navigate, signOut: async () => undefined })
    await expect(signInToEditorCloud()).rejects.toThrow('Resolve the saved recovery draft')
    expect(navigate).not.toHaveBeenCalled()
    view.rerender('Work continued while storage was offline')
    window.dispatchEvent(new Event('pagehide'))
    expect(localStorage.getItem(DRAFT_KEYS.autosave)).toBeNull()
    expect(stores.set).not.toHaveBeenCalled()
    stores.get.mockImplementation(async (key: string) => stores.values.get(key) ?? null)
    await act(async () => { view.recovery().props.onRetry(); await Promise.resolve() })
    await vi.waitFor(() => expect(view.recovery().ready).toBe(true))
    expect(view.apply).not.toHaveBeenCalled()
  })
  it('requires an explicit choice for an available sign-in copy when another store could not be checked', async () => {
    localStorage.setItem(DRAFT_KEYS.signin, JSON.stringify(createDraftSnapshot(JSON.stringify(doc('Available local copy')), 'signin')))
    stores.get.mockRejectedValue(new Error('Database unavailable'))
    const view = mount()
    await vi.waitFor(() => expect(view.recovery().props.loading).toBe(false))
    expect(view.apply).not.toHaveBeenCalled()
    expect(view.recovery().props.draft?.warning).toContain('Another browser store')
    expect(view.recovery().ready).toBe(false)
  })
  it('commits recovery before consuming its marker and never reapplies it over a newer file opened during persistence', async () => {
    const saved = createDraftSnapshot(JSON.stringify(doc('Recovered callback draft')), 'signin')
    await persistDraftSnapshot(saved)
    let finishWrite!: () => void, loadExplicit!: () => void
    const committedAtWrite: string[] = []
    stores.set.mockImplementation((key: string, value: string) => {
      if (key === DRAFT_KEYS.autosave) {
        committedAtWrite.push(document.querySelector('[data-testid="live-document"]')?.textContent ?? '')
        return new Promise<void>(resolve => { finishWrite = () => { stores.values.set(key, value); resolve() } })
      }
      stores.values.set(key, value)
      return Promise.resolve()
    })
    function Harness() {
      const [current, setCurrent] = useState(doc('Startup default'))
      loadExplicit = () => setCurrent(doc('Newer explicitly opened file'))
      useDraftRecovery({ buildDoc: () => current, applyLoadedDocument: value => setCurrent(value), activeLocalDocumentId: null, setActiveLocalDocumentId: vi.fn(), setStatus: vi.fn() })
      return createElement('output', { 'data-testid': 'live-document' }, current.documentName)
    }
    rendered = renderForTest(createElement(Harness))
    await vi.waitFor(() => expect(finishWrite).toBeTypeOf('function'))
    expect(committedAtWrite).toEqual(['Recovered callback draft'])
    act(() => { loadExplicit() })
    await act(async () => { finishWrite(); await Promise.resolve(); await Promise.resolve() })
    expect(rendered.container.textContent).toBe('Newer explicitly opened file')
  })
})
