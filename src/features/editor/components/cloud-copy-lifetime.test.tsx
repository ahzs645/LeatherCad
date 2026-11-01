import { act, createElement } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanupRender, click, renderForTest } from '../../../test/render'
import { parseImportedJsonDocument } from '../editor-json-import'
import { configureEditorCloudAuth } from '../localdb/editor-cloud-connection'
import { CloudCommunityDialog } from './CloudCommunityDialog'

const local = vi.hoisted(() => ({ create: vi.fn(), delete: vi.fn() }))
vi.mock('../localdb/editor-local-data-client', () => ({ getEditorLocalDataClient: () => ({ documents: local }) }))
let rendered: ReturnType<typeof renderForTest> | null = null
let disconnect: (() => void) | undefined
const settle = () => act(async () => { await new Promise(resolve => window.setTimeout(resolve, 15)) })
const document = (name: string) => parseImportedJsonDocument(JSON.stringify({ documentName: name, objects: [], layers: [{ id: 'main', name: 'Main', visible: true, locked: false }] })).doc
afterEach(() => { cleanupRender(rendered); rendered = null; disconnect?.(); vi.unstubAllGlobals(); local.create.mockReset(); local.delete.mockReset() })
function setup() {
  disconnect = configureEditorCloudAuth({ getUser: () => ({ id: 'alice', displayName: 'Alice' }), getToken: async () => 'identity-token', signIn: async () => undefined, signOut: async () => undefined }, { url: 'https://example.convex.cloud' })
  vi.stubGlobal('fetch', vi.fn(async (_url: string, init: RequestInit) => {
    if (typeof init.body !== 'string') throw new Error('Expected JSON request')
    const { path } = JSON.parse(init.body) as { path: string }
    let value: unknown = { page: [], continueCursor: '', isDone: true }
    if (path === 'cloudLifecycle:list') value = { page: [{ id: 'cloud-id', name: 'Remote drawing', revision: 1, updatedAt: 1, deletedAt: null }], continueCursor: '', isDone: true }
    if (path === 'cloudDocuments:get') value = { id: 'cloud-id', name: 'Remote drawing', revision: 1, createdAt: 1, updatedAt: 1, docJson: JSON.stringify(document('Remote drawing')) }
    if (path === 'communityModeration:capabilities') value = { moderator: false }
    return new Response(JSON.stringify({ status: 'success', value }))
  }))
  let resolveCreate: (value: { id: string }) => void = () => undefined
  local.create.mockReturnValue(new Promise<{ id: string }>(resolve => { resolveCreate = resolve }))
  local.delete.mockResolvedValue(undefined)
  const onLoadDocument = vi.fn(), onClose = vi.fn()
  const props = { open: true, onClose, currentDoc: document('Unsaved local draft'), onLoadDocument }
  rendered = renderForTest(createElement(CloudCommunityDialog, props))
  const button = (label: string) => [...rendered!.container.querySelectorAll('button')].find(node => node.textContent === label) ?? null
  return { props, button, resolveCreate, onLoadDocument, onClose }
}
describe('pending cloud copy lifetime', () => {
  it.each(['close', 'newer drawing'] as const)('rolls back the local copy when superseded by %s', async reason => {
    const { props, button, resolveCreate, onLoadDocument, onClose } = setup()
    await settle()
    click(button('Remote drawing · revision 1'))
    click(button('Open a local copy'))
    await settle()
    expect(local.create).toHaveBeenCalledTimes(1)
    if (reason === 'close') { click(button('Done')); expect(onClose).toHaveBeenCalledTimes(1) }
    else rendered!.rerender(createElement(CloudCommunityDialog, { ...props, currentDoc: document('Newer local intent') }))
    await act(async () => { resolveCreate({ id: 'pending-copy' }); await Promise.resolve() })
    await settle()
    expect(onLoadDocument).not.toHaveBeenCalled()
    expect(local.delete).toHaveBeenCalledWith('pending-copy')
  })
})
