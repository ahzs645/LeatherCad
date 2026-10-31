import { getEditorLocalDataClient } from '../localdb/editor-local-data-client'
import { safeLocalStorageGet, safeLocalStorageSet } from './safe-storage'

export type DraftReason = 'autosave' | 'signin'
export type DraftSnapshot = {
  version: 1
  id: string
  savedAt: number
  reason: DraftReason
  localDocumentId: string | null
  serializedDoc: string
}
export type RecoveryDraft = { key: string; raw: string; snapshot: DraftSnapshot | null; error?: string; warning?: string; unavailable?: boolean }
export type DraftWriteResult = { localStorage: boolean; indexedDb: boolean }
export const DRAFT_KEYS = { autosave: 'leathercad-recovery-autosave-v2', signin: 'leathercad-recovery-signin-v1' } as const
const LEGACY_KEY = 'leathercad-autosave-v1'
let operation: Promise<unknown> = Promise.resolve()
let lastTimestamp = 0

/** A blocked database upgrade must not hold the local editor or redirect UI
 * indefinitely. Late results never change the acknowledgment already returned. */
function databaseOperation<T>(run: () => Promise<T>): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Local database did not respond')), 2500)
    void Promise.resolve().then(run).then(
      value => { clearTimeout(timer); resolve(value) },
      error => { clearTimeout(timer); reject(error instanceof Error ? error : new Error('Local database failed')) },
    )
  })
}

function serialized<T>(run: () => Promise<T>): Promise<T> {
  const next = operation.then(run, run)
  operation = next.catch(() => undefined)
  return next
}

function client() {
  try { return getEditorLocalDataClient() } catch { return null }
}

function parseSnapshot(raw: string, reason: DraftReason): DraftSnapshot | null {
  try {
    const value = JSON.parse(raw) as Partial<DraftSnapshot>
    if (value.version !== 1 || typeof value.id !== 'string' || !value.id ||
      !Number.isFinite(value.savedAt) || value.reason !== reason ||
      !(value.localDocumentId === null || typeof value.localDocumentId === 'string') ||
      typeof value.serializedDoc !== 'string') return null
    return value as DraftSnapshot
  } catch { return null }
}

/** Each slot keeps its last acknowledged draft until a user resolves recovery.
 * Callers pause autosave while recovery is pending; sign-in has a separate slot. */
export function persistDraftSnapshot(snapshot: DraftSnapshot): Promise<DraftWriteResult> {
  return serialized(async () => {
    const key = DRAFT_KEYS[snapshot.reason], raw = JSON.stringify(snapshot)
    const newer = parseSnapshot(safeLocalStorageGet(key) ?? '', snapshot.reason)
    // A synchronous page-exit flush may overtake a queued database write. Never
    // let that older job overwrite the acknowledged final edits afterward.
    if (newer && newer.savedAt > snapshot.savedAt) return { localStorage: true, indexedDb: false }
    const localStorage = safeLocalStorageSet(key, raw)
    let indexedDb = false
    try {
      const local = client()
      if (local) { await databaseOperation(() => local.settings.set(key, raw)); indexedDb = true }
    } catch { /* The other acknowledged store can still preserve this draft. */ }
    if (!localStorage && !indexedDb) throw new Error('Could not save a recovery draft. Download your drawing before leaving this page.')
    return { localStorage, indexedDb }
  })
}

export function createDraftSnapshot(serializedDoc: string, reason: DraftReason, localDocumentId: string | null = null): DraftSnapshot {
  lastTimestamp = Math.max(Date.now(), lastTimestamp + 1)
  return { version: 1, id: globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`, savedAt: lastTimestamp, reason, localDocumentId, serializedDoc }
}

/** Page exit cannot await IndexedDB. A synchronous localStorage acknowledgment
 * is the only successful result here; callers warn if this final attempt fails. */
export function persistExitDraft(serializedDoc: string, localDocumentId: string | null = null): boolean {
  return safeLocalStorageSet(DRAFT_KEYS.autosave, JSON.stringify(createDraftSnapshot(serializedDoc, 'autosave', localDocumentId)))
}

async function readSlot(reason: DraftReason): Promise<RecoveryDraft | null> {
  const key = DRAFT_KEYS[reason], raws: string[] = []
  let incomplete = false, raw: string | null = null
  try { raw = localStorage.getItem(key) } catch { incomplete = true }
  if (raw) raws.push(raw)
  try {
    const local = client()
    const stored = local ? await databaseOperation(() => local.settings.get(key)) : null
    if (stored && !raws.includes(stored)) raws.push(stored)
  } catch { incomplete = true }
  const warning = incomplete ? 'Another browser store could not be checked. This may not be the newest draft; check again or choose this copy explicitly.' : undefined
  if (!raws.length) return incomplete ? { key, raw: '', snapshot: null, unavailable: true } : null
  const valid = raws.map(value => ({ raw: value, snapshot: parseSnapshot(value, reason) }))
    .filter((entry): entry is { raw: string; snapshot: DraftSnapshot } => entry.snapshot !== null)
    .sort((a, b) => b.snapshot.savedAt - a.snapshot.savedAt)
  if (valid[0]) {
    lastTimestamp = Math.max(lastTimestamp, valid[0].snapshot.savedAt)
    return { key, ...valid[0], warning }
  }
  return { key, raw: raws[0], snapshot: null, error: 'This saved draft is damaged. Download it before discarding it.', warning }
}

export async function readRecoveryDrafts(): Promise<RecoveryDraft[]> {
  await operation
  const [signin, autosave] = await Promise.all([readSlot('signin'), readSlot('autosave')])
  let incomplete = Boolean(signin?.unavailable || autosave?.unavailable || signin?.warning || autosave?.warning)
  const usable = (items: Array<RecoveryDraft | null>) => {
    const result = items.filter((item): item is RecoveryDraft => item !== null && !item.unavailable)
    if (!result.length && incomplete) throw new Error('Saved drafts could not be fully checked. Automatic saving and sign-in are paused; download your current drawing or check again.')
    return incomplete ? result.map(item => ({ ...item, warning: item.warning ?? 'Another browser store could not be checked. Choose a copy explicitly or check again.' })) : result
  }
  if (autosave && !autosave.unavailable) return usable([signin, autosave])
  let legacy = safeLocalStorageGet(LEGACY_KEY)
  try {
    const local = client()
    legacy = (local ? await databaseOperation(() => local.documents.getAutoSaveSnapshot()) : null) || legacy
  } catch { incomplete = true }
  const old = legacy ? { key: LEGACY_KEY, raw: legacy, snapshot: {
    version: 1 as const, id: 'legacy-autosave', savedAt: 0, reason: 'autosave' as const, localDocumentId: null, serializedDoc: legacy,
  } } : null
  return usable([signin, old])
}

/** Clear both copies, including the legacy slot. Do not dismiss a failed clear:
 * otherwise its stale database copy can unexpectedly reappear next session. */
export function discardRecoveryDrafts(reasons: DraftReason[] = ['autosave', 'signin']): Promise<void> {
  return serialized(async () => {
    let failed = false
    const keys = reasons.map(reason => DRAFT_KEYS[reason])
    for (const key of [...keys, ...(reasons.includes('autosave') ? [LEGACY_KEY] : [])]) {
      try { localStorage.removeItem(key) } catch { if (safeLocalStorageGet(key)) failed = true }
    }
    try {
      const local = client()
      if (local) {
        await databaseOperation(() => Promise.all(keys.map(key => local.settings.set(key, ''))))
        if (reasons.includes('autosave')) await databaseOperation(() => local.documents.clearAutoSaveSnapshot())
      }
    } catch { failed = true }
    if (failed) throw new Error('Could not discard every stored copy. Keep this page open to download your draft, or try again.')
  })
}

/** Consume only the sign-in marker after a replacement autosave is durable. */
export function consumeSignInDraft(id: string): Promise<void> {
  return serialized(async () => {
    const current = await readSlot('signin')
    if (current?.snapshot?.id !== id) return
    let failed = false
    try { localStorage.removeItem(DRAFT_KEYS.signin) } catch { failed = true }
    try {
      const local = client()
      if (local) await databaseOperation(() => local.settings.set(DRAFT_KEYS.signin, ''))
    } catch { failed = true }
    if (failed) throw new Error('The draft was restored, but its sign-in recovery marker could not be cleared.')
  })
}
