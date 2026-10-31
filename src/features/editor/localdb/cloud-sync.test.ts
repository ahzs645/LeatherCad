import { describe, expect, it, vi } from 'vitest'
import { parseImportedJsonDocument } from '../editor-json-import'
import type { AppDataClient } from './app-data-client'
import { makeAttributedPatternCopy, uploadLocalProjects } from './cloud-sync'
import { createConvexTransport, normalizeConvexUrl } from './convex-transport'
import { readAllCloudPages } from './convex-data-client'

const doc = () => parseImportedJsonDocument(JSON.stringify({ documentName: 'Wallet', objects: [], layers: [{ id: 'main', name: 'Main', visible: true, locked: false }] })).doc
describe('explicit cloud copy operations', () => {
  it('does not overwrite existing cloud drawings during bulk upload', async () => {
    const source = { documents: { list: async () => [
      { id: 'new', name: 'New', doc: doc() }, { id: 'same', name: 'Same', doc: doc() }, { id: 'conflict', name: 'Conflict', doc: doc() },
    ] } } as unknown as AppDataClient
    const create = vi.fn()
    const target = { documents: {
      create, get: async (id: string) => id === 'new' ? null : { doc: id === 'same' ? doc() : { ...doc(), projectMemo: 'Remote change' } },
    } } as unknown as AppDataClient
    const result = await uploadLocalProjects(source, target)
    expect(result).toEqual({ uploaded: 1, unchanged: 1, conflicts: ['Conflict'] })
    expect(create).toHaveBeenCalledOnce()
    expect(create.mock.calls[0][0]).toMatchObject({ id: 'new' })
  })
  it('preserves license and version credit in independent downloaded copies', () => {
    const original = doc()
    const copy = makeAttributedPatternCopy({ id: 'p1', title: 'Wallet', description: '', author: 'Alice', attribution: 'Alice Example', license: 'CC-BY-NC-4.0', visibility: 'public', version: 3, publishedAt: 1, doc: original })
    expect(copy.projectMemo).toContain('version 3, by Alice')
    expect(copy.projectMemo).toContain('CC-BY-NC-4.0')
    expect(original.projectMemo).toBe('')
    copy.objects.push({ id: 'x', type: 'line', layerId: 'main', lineTypeId: 'cut', start: { x: 0, y: 0 }, end: { x: 2, y: 0 } })
    expect(original.objects).toHaveLength(0)
  })
  it('keeps attribution through an export/import roundtrip even when the original memo is full', () => {
    const original = { ...doc(), projectMemo: 'Original notes '.repeat(1000).slice(0, 8000) }
    const copy = makeAttributedPatternCopy({ id: 'p1', title: 'Wallet', description: '', author: 'Alice', attribution: 'Alice Example', license: 'CC-BY-NC-4.0', visibility: 'public', version: 3, publishedAt: 1, doc: original })
    const reopened = parseImportedJsonDocument(JSON.stringify(copy)).doc
    expect(reopened.projectMemo).toContain('CC-BY-NC-4.0')
    expect(reopened.projectMemo).toContain('Alice Example')
    expect(reopened.projectMemo).toContain('version 3')
    expect(reopened.projectMemo?.length).toBeLessThanOrEqual(8000)
    expect(reopened.communityProvenance).toMatchObject([{ patternId: 'p1', version: 3, license: 'CC-BY-NC-4.0' }])
  })
})
describe('Convex HTTP transport', () => {
  it('refreshes tokens per request, uses the documented API envelope, and never stores browser credentials', async () => {
    const fetcher = vi.fn().mockImplementation(() => Promise.resolve(new Response(JSON.stringify({ status: 'success', value: [] }), { status: 200 })))
    const getAuthToken = vi.fn().mockResolvedValueOnce('first-test-token').mockResolvedValueOnce('refreshed-test-token')
    const transport = createConvexTransport({ url: 'https://example.convex.cloud', getAuthToken, fetch: fetcher })
    await transport.query('cloudDocuments:list', { cursor: null })
    await transport.query('cloudDocuments:list', { cursor: null })
    expect(fetcher.mock.calls[0][1]).toMatchObject({ credentials: 'omit', body: JSON.stringify({ path: 'cloudDocuments:list', args: { cursor: null }, format: 'json' }) })
    expect((fetcher.mock.calls[1][1] as RequestInit).headers).toMatchObject({ Authorization: 'Bearer refreshed-test-token' })
  })
  it('surfaces failed requests and does not claim success', async () => {
    const transport = createConvexTransport({ url: 'https://example.convex.cloud', fetch: vi.fn().mockResolvedValue(new Response('', { status: 401 })) })
    await expect(transport.mutation('cloudDocuments:create', {})).rejects.toThrow('Sign in')
    expect(() => normalizeConvexUrl('http://remote.example')).toThrow('HTTPS')
    expect(() => normalizeConvexUrl('https://user:password@remote.example')).toThrow('credentials')
  })
  it('rejects a stuck pagination cursor instead of hanging or duplicating indefinitely', async () => {
    await expect(readAllCloudPages(async () => ({ page: [], continueCursor: 'same', isDone: false }))).rejects.toThrow('did not advance')
  })
  it('rejects malformed success envelopes with a controlled cloud error', async () => {
    for (const envelope of [null, {}, { status: 'success' }, { status: 'error', errorMessage: 42 }]) {
      const transport = createConvexTransport({ url: 'https://example.convex.cloud', fetch: vi.fn().mockResolvedValue(new Response(JSON.stringify(envelope))) })
      await expect(transport.query('cloudDocuments:list', {})).rejects.toThrow(/Cloud/)
    }
  })
})
