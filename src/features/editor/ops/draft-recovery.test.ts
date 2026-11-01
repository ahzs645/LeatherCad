import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { consumeSignInDraft, createDraftSnapshot, discardRecoveryDrafts, DRAFT_KEYS, persistDraftSnapshot, persistExitDraft, readRecoveryDrafts } from './draft-recovery'

const storage = vi.hoisted(() => ({ values: new Map<string, string>(), set: vi.fn(), get: vi.fn(), legacy: null as string | null, clearLegacy: vi.fn() }))
vi.mock('../localdb/editor-local-data-client', () => ({ getEditorLocalDataClient: () => ({
  settings: { set: storage.set, get: storage.get },
  documents: { getAutoSaveSnapshot: async () => storage.legacy, clearAutoSaveSnapshot: storage.clearLegacy },
}) }))
beforeEach(() => {
  const memory = new Map<string, string>()
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => memory.get(key) ?? null,
    setItem: (key: string, value: string) => { memory.set(key, value) },
    removeItem: (key: string) => { memory.delete(key) },
    clear: () => memory.clear(),
  })
  localStorage.clear(); storage.values.clear(); storage.legacy = null
  storage.set.mockReset().mockImplementation(async (key: string, value: string) => { storage.values.set(key, value) })
  storage.get.mockReset().mockImplementation(async (key: string) => storage.values.get(key) ?? null)
  storage.clearLegacy.mockReset().mockImplementation(async () => { storage.legacy = null })
})
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.useRealTimers() })

describe('durable recovery drafts', () => {
  it('awaits the database acknowledgment and preserves named project context', async () => {
    const saved = createDraftSnapshot('{"objects":[]}', 'signin', 'named-project')
    let complete!: () => void
    storage.set.mockImplementationOnce(() => new Promise<void>(resolve => { complete = resolve }))
    const pending = persistDraftSnapshot(saved)
    await vi.waitFor(() => expect(storage.set).toHaveBeenCalledOnce())
    let done = false; void pending.then(() => { done = true })
    await Promise.resolve(); expect(done).toBe(false)
    complete()
    expect(await pending).toEqual({ localStorage: true, indexedDb: true })
    expect((await readRecoveryDrafts())[0].snapshot).toEqual(saved)
  })
  it('succeeds with IndexedDB when browser localStorage is full', async () => {
    vi.spyOn(localStorage, 'setItem').mockImplementation(() => { throw new DOMException('full', 'QuotaExceededError') })
    const saved = createDraftSnapshot('{"objects":[]}', 'autosave')
    expect(await persistDraftSnapshot(saved)).toEqual({ localStorage: false, indexedDb: true })
    expect((await readRecoveryDrafts())[0].snapshot?.id).toBe(saved.id)
  })
  it('fails truthfully when neither store acknowledges the write', async () => {
    vi.spyOn(localStorage, 'setItem').mockImplementation(() => { throw new DOMException('blocked', 'SecurityError') })
    storage.set.mockRejectedValue(new Error('IndexedDB unavailable'))
    await expect(persistDraftSnapshot(createDraftSnapshot('{}', 'signin'))).rejects.toThrow('Download your drawing')
  })
  it('recovers the newest valid store copy and retains damaged content for download', async () => {
    const old = { ...createDraftSnapshot('{"objects":[]}', 'autosave'), savedAt: 1 }
    const newer = { ...old, id: 'newer', savedAt: 2, serializedDoc: '{"objects":[],"documentName":"Newest"}' }
    localStorage.setItem(DRAFT_KEYS.autosave, JSON.stringify(old))
    storage.values.set(DRAFT_KEYS.autosave, JSON.stringify(newer))
    expect((await readRecoveryDrafts())[0].snapshot?.id).toBe('newer')
    localStorage.setItem(DRAFT_KEYS.autosave, 'broken draft bytes')
    storage.values.delete(DRAFT_KEYS.autosave)
    const damaged = (await readRecoveryDrafts())[0]
    expect(damaged.snapshot).toBeNull()
    expect(damaged.raw).toBe('broken draft bytes')
    expect(damaged.error).toContain('damaged')
  })
  it('recovers legacy snapshots and discards every store copy explicitly', async () => {
    storage.legacy = '{"objects":[],"documentName":"Old draft"}'
    localStorage.setItem('leathercad-autosave-v1', storage.legacy)
    expect((await readRecoveryDrafts())[0].snapshot?.serializedDoc).toBe(storage.legacy)
    await persistDraftSnapshot(createDraftSnapshot('{}', 'signin'))
    await discardRecoveryDrafts()
    expect(await readRecoveryDrafts()).toEqual([])
  })
  it('does not consume a different sign-in draft and surfaces failed marker removal', async () => {
    const saved = createDraftSnapshot('{}', 'signin')
    await persistDraftSnapshot(saved)
    await consumeSignInDraft('old marker')
    expect((await readRecoveryDrafts())[0].snapshot?.id).toBe(saved.id)
    storage.set.mockRejectedValueOnce(new Error('read only'))
    await expect(consumeSignInDraft(saved.id)).rejects.toThrow('could not be cleared')
    expect((await readRecoveryDrafts())[0].snapshot?.id).toBe(saved.id)
  })
  it('does not let a queued older autosave overwrite a synchronous exit draft', async () => {
    const pending = persistDraftSnapshot(createDraftSnapshot('{"documentName":"Earlier"}', 'autosave'))
    expect(persistExitDraft('{"documentName":"Final edits"}')).toBe(true)
    await pending
    expect((await readRecoveryDrafts())[0].snapshot?.serializedDoc).toBe('{"documentName":"Final edits"}')
  })
  it('recovers localStorage without hanging when IndexedDB never responds', async () => {
    const saved = createDraftSnapshot('{"documentName":"Available local draft"}', 'autosave')
    localStorage.setItem(DRAFT_KEYS.autosave, JSON.stringify(saved))
    vi.useFakeTimers()
    storage.get.mockImplementation(() => new Promise<string | null>(() => undefined))
    const pending = readRecoveryDrafts()
    await vi.advanceTimersByTimeAsync(3000)
    expect((await pending)[0].snapshot?.id).toBe(saved.id)
  })
})
