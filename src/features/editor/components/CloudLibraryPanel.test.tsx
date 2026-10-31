import { act, createElement } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanupRender, click, renderForTest } from '../../../test/render'
import { parseImportedJsonDocument } from '../editor-json-import'
import { configureEditorCloudAuth } from '../localdb/editor-cloud-connection'
import { CloudLibraryPanel } from './CloudLibraryPanel'

let rendered: ReturnType<typeof renderForTest> | null = null
let disconnect: (() => void) | undefined
const settle = () => act(async () => { await new Promise(resolve => window.setTimeout(resolve, 15)) })
afterEach(() => { cleanupRender(rendered); rendered = null; disconnect?.(); vi.unstubAllGlobals() })
function setup() {
  disconnect = configureEditorCloudAuth({ getUser: () => ({ id: 'alice', displayName: 'Alice' }), getToken: async () => 'identity-token', signIn: async () => undefined, signOut: async () => undefined }, { url: 'https://example.convex.cloud' })
  const doc = parseImportedJsonDocument(JSON.stringify({ documentName: 'Newest local drawing', objects: [], layers: [{ id: 'main', name: 'Main', visible: true, locked: false }] })).doc
  const requests: { path: string; args: Record<string, unknown> }[] = []
  let revision = 1
  const fetcher = vi.fn(async (_url: string, init: RequestInit) => {
    if (typeof init.body !== 'string') throw new Error('Expected JSON request')
    const request = JSON.parse(init.body) as { path: string; args: Record<string, unknown> }
    requests.push(request)
    const row = { id: 'cloud-id', name: 'Cloud drawing', revision, updatedAt: 1, deletedAt: null }
    let value: unknown
    if (request.path === 'cloudLifecycle:list') value = request.args.cursor ? { page: [{ ...row, id: 'next-id', name: 'Next drawing' }], continueCursor: '', isDone: true } : { page: [row], continueCursor: 'next-page', isDone: false }
    else if (request.path === 'cloudDocuments:save') return new Response(JSON.stringify({ status: 'error', errorMessage: 'Cloud drawing changed; refresh before saving' }))
    else throw new Error(`Unexpected request ${request.path}`)
    return new Response(JSON.stringify({ status: 'success', value }))
  })
  vi.stubGlobal('fetch', fetcher)
  const saveLocalCopy = vi.fn(async () => 'Opened')
  rendered = renderForTest(createElement(CloudLibraryPanel, { currentDoc: doc, saveLocalCopy, onChanged: async () => undefined }))
  const button = (text: string) => [...rendered!.container.querySelectorAll('button')].find(node => node.textContent === text) ?? null
  return { requests, button, setRevision: (value: number) => { revision = value }, saveLocalCopy }
}
describe('cloud library editing snapshots', () => {
  it('loads metadata incrementally and retains the selected revision after refresh', async () => {
    const { requests, button, setRevision, saveLocalCopy } = setup()
    await settle()
    expect(requests.map(row => row.path)).toEqual(['cloudLifecycle:list'])
    click(button('Cloud drawing · revision 1'))
    setRevision(2)
    click(button('Refresh'))
    await settle()
    click(button('Update selected cloud drawing with current drawing'))
    await settle()
    const save = requests.find(row => row.path === 'cloudDocuments:save')
    expect(save?.args).toMatchObject({ id: 'cloud-id', expectedRevision: 1 })
    const savedDoc = JSON.parse(String(save?.args.docJson)) as { documentName: string }
    expect(savedDoc.documentName).toBe('Newest local drawing')
    expect(rendered!.container.querySelector('[role="alert"]')?.textContent).toContain('changed')
    expect(saveLocalCopy).not.toHaveBeenCalled()
    click(button('Load more drawings'))
    await settle()
    expect(rendered!.container.textContent).toContain('Next drawing')
    expect(requests.some(row => row.path === 'cloudLifecycle:list' && row.args.cursor === 'next-page')).toBe(true)
    expect(requests.some(row => row.path === 'cloudDocuments:get')).toBe(false)
  })
})
