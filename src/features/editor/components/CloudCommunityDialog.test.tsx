import { act, createElement } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanupRender, click, renderForTest } from '../../../test/render'
import { parseImportedJsonDocument } from '../editor-json-import'
import { configureEditorCloudAuth, getEditorCloudClients, type EditorCloudUser } from '../localdb/editor-cloud-connection'
import { CloudCommunityDialog } from './CloudCommunityDialog'

const localStore = vi.hoisted(() => ({ create: vi.fn(), delete: vi.fn() }))
vi.mock('../localdb/editor-local-data-client', () => ({ getEditorLocalDataClient: () => ({ documents: localStore }) }))

const document = () => parseImportedJsonDocument(JSON.stringify({ documentName: 'Current', objects: [], layers: [{ id: 'main', name: 'Main', visible: true, locked: false }] })).doc
let rendered: ReturnType<typeof renderForTest> | null = null
let disconnect: (() => void) | undefined
afterEach(() => { cleanupRender(rendered); rendered = null; disconnect?.(); disconnect = undefined; vi.unstubAllGlobals(); localStore.create.mockReset(); localStore.delete.mockReset() })

describe('cloud account boundaries', () => {
  it('drops cached private content immediately on an account switch even when the next refresh fails', async () => {
    let user: EditorCloudUser | null = { id: 'alice', displayName: 'Same display name' }
    let changed: () => void = () => undefined
    disconnect = configureEditorCloudAuth({
      getUser: () => user, getToken: async () => user?.id ?? null,
      signIn: async () => undefined, signOut: async () => { user = null },
      subscribe: listener => { changed = listener; return () => undefined },
    }, { url: 'https://example.convex.cloud' })
    let offline = false
    const fetcher = vi.fn().mockImplementation(async (_url: string, init: RequestInit) => {
      if (offline) throw new Error('Offline')
      if (typeof init.body !== 'string') throw new Error('Expected a JSON request body')
      const request = JSON.parse(init.body) as { path: string }
      const page = request.path === 'cloudLifecycle:list'
        ? [{ id: 'private-1', name: 'Alice private drawing', docJson: JSON.stringify(document()), createdAt: 1, updatedAt: 1, revision: 1 }]
        : []
      return new Response(JSON.stringify({ status: 'success', value: { page, continueCursor: '', isDone: true } }))
    })
    vi.stubGlobal('fetch', fetcher)
    rendered = renderForTest(createElement(CloudCommunityDialog, { open: true, onClose: () => undefined, currentDoc: document() }))
    await act(async () => { await new Promise(resolve => window.setTimeout(resolve, 20)) })
    expect(rendered.container.textContent).toContain('Alice private drawing')
    expect(fetcher.mock.calls.every(call => String(call[0]).endsWith('/api/query'))).toBe(true)
    offline = true
    user = { id: 'bob', displayName: 'Same display name' }
    act(() => changed())
    expect(rendered.container.textContent).not.toContain('Alice private drawing')
    expect(rendered.container.textContent).not.toContain('Open a local copy')
    await act(async () => { await new Promise(resolve => window.setTimeout(resolve, 20)) })
    expect(rendered.container.textContent).not.toContain('Alice private drawing')
  })
  it('does not send a retained client request using a different account token', async () => {
    const user: EditorCloudUser = { id: 'alice', displayName: 'Alice' }
    let changed: () => void = () => undefined
    disconnect = configureEditorCloudAuth({ getUser: () => user, getToken: async () => user?.id ?? null,
      signIn: async () => undefined, signOut: async () => undefined,
      subscribe: listener => { changed = listener; return () => undefined },
    }, { url: 'https://example.convex.cloud' })
    const fetcher = vi.fn()
    vi.stubGlobal('fetch', fetcher)
    const retained = getEditorCloudClients()
    // SDKs may mutate a shared user object before notifying listeners.
    user.id = 'bob'; user.displayName = 'Bob'
    changed()
    await expect(retained.documents.documents.list()).rejects.toThrow('session changed')
    expect(fetcher).not.toHaveBeenCalled()
  })
  it('discards a download response arriving after account change before creating or opening a local copy', async () => {
    let user: EditorCloudUser | null = { id: 'alice', displayName: 'Alice' }
    let changed: () => void = () => undefined
    disconnect = configureEditorCloudAuth({ getUser: () => user, getToken: async () => user?.id ?? null,
      signIn: async () => undefined, signOut: async () => undefined,
      subscribe: listener => { changed = listener; return () => undefined },
    }, { url: 'https://example.convex.cloud' })
    const summary = { id: 'pattern-1', title: 'Wallet', description: '', author: 'Alice', license: 'CC-BY-4.0', attribution: 'Alice', visibility: 'public', version: 1, publishedAt: 1 }
    let resolveDownload: (response: Response) => void = () => undefined
    const pendingResponse = new Promise<Response>(resolve => { resolveDownload = resolve })
    let downloadStarted = false
    const fetcher = vi.fn().mockImplementation(async (_url: string, init: RequestInit) => {
      if (typeof init.body !== 'string') throw new Error('Expected JSON request')
      const { path } = JSON.parse(init.body) as { path: string }
      if (path === 'community:get') { downloadStarted = true; return pendingResponse }
      return new Response(JSON.stringify({ status: 'success', value: { page: path === 'community:listPublic' ? [summary] : [], continueCursor: '', isDone: true } }))
    })
    vi.stubGlobal('fetch', fetcher)
    localStore.create.mockResolvedValue({ id: 'local-copy', name: 'Wallet', doc: document() })
    const onLoadDocument = vi.fn()
    rendered = renderForTest(createElement(CloudCommunityDialog, { open: true, onClose: () => undefined, currentDoc: document(), onLoadDocument }))
    await act(async () => { await new Promise(resolve => window.setTimeout(resolve, 20)) })
    click([...rendered.container.querySelectorAll('button')].find(button => button.textContent === 'Open an attributed local copy') ?? null)
    await act(async () => { await Promise.resolve() })
    expect(downloadStarted).toBe(true)
    user = { id: 'bob', displayName: 'Bob' }; act(() => changed())
    await act(async () => {
      resolveDownload(new Response(JSON.stringify({ status: 'success', value: { ...summary, docJson: JSON.stringify(document()) } })))
      await new Promise(resolve => window.setTimeout(resolve, 20))
    })
    expect(localStore.create).not.toHaveBeenCalled()
    expect(onLoadDocument).not.toHaveBeenCalled()
  })
})
